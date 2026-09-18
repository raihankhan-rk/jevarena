"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AgentPane } from "@/components/agent-pane";
import {
  buildAgentRequest,
  createMemoryDeck,
  createPlayer,
  createWhackSequence,
  GAME_COPY,
} from "@/lib/arena/games";
import type {
  AgentDecision,
  GameId,
  MatchResult,
  PlayerId,
  PlayerRun,
  StepTrace,
} from "@/lib/arena/types";

const MATCH_SEED = "jevarena-public-demo-v1";
const WHACK_ROUNDS = 18;
const WHACK_ROUND_MS = 1_250;
const MEMORY_TIMEOUT_MS = 45_000;
const MEMORY_STEP_LIMIT = 36;

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timeout = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function clonePlayer(player: PlayerRun): PlayerRun {
  return {
    ...player,
    whack: { ...player.whack },
    memory: {
      ...player.memory,
      deck: [...player.memory.deck],
      revealed: [...player.memory.revealed],
      matched: [...player.memory.matched],
      seen: { ...player.memory.seen },
    },
    history: [...player.history],
    latestDecision: player.latestDecision
      ? {
          ...player.latestDecision,
          operationProbabilities: {
            ...player.latestDecision.operationProbabilities,
          },
          targetProbabilities: { ...player.latestDecision.targetProbabilities },
        }
      : null,
  };
}

function clonePlayers(players: PlayerRun[]) {
  return players.map(clonePlayer) as [PlayerRun, PlayerRun];
}

function blockedClientDecision(reason: string): AgentDecision {
  return {
    operation: "BLOCKED",
    targetId: null,
    operationProbabilities: {
      CLICK: 0,
      SCROLL: 0,
      WAIT: 0,
      DONE: 0,
      BLOCKED: 1,
    },
    targetProbabilities: {},
    confidence: 1,
    targetConfidence: null,
    latencyMs: 0,
    model: "jev-latest",
    source: "jev",
    blockedReason: reason,
  };
}

async function requestDecision(
  game: GameId,
  player: PlayerRun,
  signal: AbortSignal,
) {
  const startedAt = performance.now();
  try {
    const response = await fetch("/api/agent/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAgentRequest(game, player)),
      cache: "no-store",
      signal,
    });
    if (!response.ok) {
      return blockedClientDecision("Invalid browser snapshot; player BLOCKED.");
    }
    return (await response.json()) as AgentDecision;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      ...blockedClientDecision("Agent request failed; player BLOCKED."),
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .8a11.4 11.4 0 0 0-3.6 22.2c.6.1.8-.2.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6a4.7 4.7 0 0 1 1.2-3.2c-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.9.1 3.2a4.7 4.7 0 0 1 1.2 3.2c0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A11.4 11.4 0 0 0 12 .8Z"
      />
    </svg>
  );
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
    </span>
  );
}

export function Arena() {
  const [selectedGame, setSelectedGame] =
    useState<GameId>("whack-a-mole");
  const [activeGame, setActiveGame] = useState<GameId>("whack-a-mole");
  const [view, setView] = useState<"landing" | "fight">("landing");
  const [phase, setPhase] = useState<
    "idle" | "countdown" | "running" | "finished"
  >("idle");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [players, setPlayers] = useState<[PlayerRun, PlayerRun]>(() => {
    const deck = createMemoryDeck(MATCH_SEED);
    return [createPlayer("jev-a", deck), createPlayer("jev-b", deck)];
  });

  const controllerRef = useRef<AbortController | null>(null);
  const runPlayersRef = useRef<PlayerRun[] | null>(null);
  const activeGameRef = useRef<GameId>("whack-a-mole");

  const publish = useCallback((next: PlayerRun[]) => {
    setPlayers(clonePlayers(next));
  }, []);

  const executeFixtureAction = useCallback(
    (playerId: PlayerId, targetId: string) => {
      const current = runPlayersRef.current;
      const player = current?.find((candidate) => candidate.id === playerId);
      if (!player || player.status === "blocked") return;

      if (activeGameRef.current === "whack-a-mole") {
        const hole = Number(targetId.split("-")[1]) - 1;
        if (
          hole === player.whack.activeHole &&
          player.whack.hitHole !== player.whack.activeHole
        ) {
          player.whack.score += 1;
          player.whack.hitHole = hole;
          player.pendingOutcome = `Clicked [${hole + 1}] LIVE MOLE · hit +1`;
        } else {
          player.whack.misses += 1;
          player.pendingOutcome = `Clicked [${hole + 1}] empty hole · miss`;
        }
        return;
      }

      const cardIndex = Number(targetId.split("-")[1]) - 1;
      const memory = player.memory;
      if (
        !Number.isInteger(cardIndex) ||
        memory.revealed.includes(cardIndex) ||
        memory.matched.includes(cardIndex) ||
        memory.revealed.length >= 2
      ) {
        player.pendingOutcome = `Rejected stale target ${targetId}`;
        return;
      }

      memory.revealed.push(cardIndex);
      memory.seen[targetId] = memory.deck[cardIndex];
      if (memory.revealed.length === 2) memory.moves += 1;
      player.pendingOutcome = `Clicked [${cardIndex + 1}] · revealed ${memory.deck[cardIndex]}`;
    },
    [],
  );

  const executeDecisions = useCallback(
    async (
      game: GameId,
      currentPlayers: PlayerRun[],
      decisions: Array<AgentDecision | null>,
      signal: AbortSignal,
    ) => {
      decisions.forEach((decision, index) => {
        const player = currentPlayers[index];
        if (!decision || player.status === "blocked") return;
        player.latestDecision = decision;
        player.pendingOutcome = "";
        player.status =
          decision.operation === "BLOCKED" ? "blocked" : "acting";
      });
      publish(currentPlayers);
      await sleep(115, signal);

      decisions.forEach((decision, index) => {
        const player = currentPlayers[index];
        if (!decision) return;

        if (decision.operation === "CLICK" && decision.targetId) {
          const element = document.getElementById(
            `${player.id}-${decision.targetId}`,
          ) as HTMLButtonElement | null;
          if (element && !element.disabled) {
            element.click();
          } else {
            player.pendingOutcome = `Target ${decision.targetId} went stale · no click`;
          }
        } else if (decision.operation === "WAIT") {
          player.pendingOutcome = "WAIT · fixture unchanged";
        } else if (decision.operation === "SCROLL") {
          player.pendingOutcome = "SCROLL · all fixture controls already visible";
        } else if (decision.operation === "DONE") {
          const complete =
            game === "memory-match" &&
            player.memory.matched.length === player.memory.deck.length;
          player.pendingOutcome = complete
            ? "DONE · board independently verified"
            : "DONE rejected · board is not complete";
        } else if (decision.operation === "BLOCKED") {
          player.pendingOutcome =
            decision.blockedReason ?? "No supported action can progress";
        }

        const trace: StepTrace = {
          step: player.history.length + 1,
          operation: decision.operation,
          targetId: decision.targetId,
          outcome: player.pendingOutcome || "No action executed",
          operationProbabilities: decision.operationProbabilities,
          targetProbabilities: decision.targetProbabilities,
          confidence: decision.confidence,
          targetConfidence: decision.targetConfidence,
          latencyMs: decision.latencyMs,
          model: decision.model,
          source: decision.source,
        };
        player.history.push(trace);
        if (decision.operation !== "BLOCKED") player.status = "ready";
      });
      publish(currentPlayers);
    },
    [publish],
  );

  const getDecisions = useCallback(
    async (game: GameId, currentPlayers: PlayerRun[], signal: AbortSignal) => {
      currentPlayers.forEach((player) => {
        if (player.status !== "blocked" && player.status !== "done") {
          player.status = "thinking";
        }
      });
      publish(currentPlayers);
      return Promise.all(
        currentPlayers.map((player) =>
          player.status === "blocked" || player.status === "done"
            ? Promise.resolve(null)
            : requestDecision(game, player, signal),
        ),
      );
    },
    [publish],
  );

  const finishMatch = useCallback(
    (currentPlayers: PlayerRun[], matchResult: MatchResult) => {
      currentPlayers.forEach((player) => {
        if (player.status !== "blocked") player.status = "done";
        if (matchResult.winner !== "draw" && player.id === matchResult.winner) {
          player.status = "done";
        }
      });
      publish(currentPlayers);
      setResult(matchResult);
      setPhase("finished");
      setTimeLeft(0);
    },
    [publish],
  );

  const resolveWhackResult = useCallback((currentPlayers: PlayerRun[]) => {
    const [first, second] = currentPlayers;
    if (first.status === "blocked" && second.status === "blocked") {
      return {
        winner: "draw" as const,
        label: "Double BLOCKED",
        detail: "Neither Jev returned a valid action before timeout.",
      };
    }
    if (first.status === "blocked" || second.status === "blocked") {
      const winner = first.status === "blocked" ? second : first;
      return {
        winner: winner.id,
        label: `${winner.name} wins`,
        detail: "Opponent BLOCKED. Valid execution takes the round.",
      };
    }
    if (first.whack.score === second.whack.score) {
      return {
        winner: "draw" as const,
        label: "Photo finish",
        detail: `A ${first.whack.score}–${second.whack.score} draw across identical spawns.`,
      };
    }
    const winner =
      first.whack.score > second.whack.score ? first : second;
    return {
      winner: winner.id,
      label: `${winner.name} wins`,
      detail: `${first.whack.score}–${second.whack.score} across 18 identical one-second spawns.`,
    };
  }, []);

  const runWhack = useCallback(
    async (
      currentPlayers: PlayerRun[],
      signal: AbortSignal,
      deadline: number,
    ) => {
      const sequence = createWhackSequence(MATCH_SEED, WHACK_ROUNDS);

      for (const activeHole of sequence) {
        if (signal.aborted || currentPlayers.every((p) => p.status === "blocked"))
          break;
        const roundStarted = performance.now();
        currentPlayers.forEach((player) => {
          player.whack.activeHole = activeHole;
          player.whack.hitHole = null;
        });
        publish(currentPlayers);

        const decisions = await getDecisions(
          "whack-a-mole",
          currentPlayers,
          signal,
        );
        await executeDecisions(
          "whack-a-mole",
          currentPlayers,
          decisions,
          signal,
        );

        const remaining = WHACK_ROUND_MS - (performance.now() - roundStarted);
        if (remaining > 0) await sleep(remaining, signal);
        currentPlayers.forEach((player) => {
          player.whack.activeHole = null;
          player.whack.hitHole = null;
        });
        publish(currentPlayers);
        if (Date.now() >= deadline) break;
      }

      finishMatch(currentPlayers, resolveWhackResult(currentPlayers));
    },
    [
      executeDecisions,
      finishMatch,
      getDecisions,
      publish,
      resolveWhackResult,
    ],
  );

  const resolveMemoryPairs = useCallback(
    async (currentPlayers: PlayerRun[], signal: AbortSignal) => {
      const hasPair = currentPlayers.some(
        (player) => player.memory.revealed.length === 2,
      );
      if (!hasPair) return;
      publish(currentPlayers);
      await sleep(430, signal);

      currentPlayers.forEach((player) => {
        const [first, second] = player.memory.revealed;
        if (first === undefined || second === undefined) return;
        const isMatch =
          player.memory.deck[first] === player.memory.deck[second];
        const latestTrace = player.history.at(-1);
        if (isMatch) {
          player.memory.matched.push(first, second);
          if (latestTrace) latestTrace.outcome += " · PAIR MATCHED";
        } else if (latestTrace) {
          latestTrace.outcome += " · mismatch, cards reset";
        }
        player.memory.revealed = [];
      });
      publish(currentPlayers);
    },
    [publish],
  );

  const memoryResult = useCallback((currentPlayers: PlayerRun[]) => {
    const [first, second] = currentPlayers;
    const firstComplete =
      first.memory.matched.length === first.memory.deck.length;
    const secondComplete =
      second.memory.matched.length === second.memory.deck.length;

    if (firstComplete && secondComplete) {
      return {
        winner: "draw" as const,
        label: "Perfect sync",
        detail: "Both Jevs cleared the shared deck on the same decision cycle.",
      };
    }
    if (firstComplete || secondComplete) {
      const winner = firstComplete ? first : second;
      return {
        winner: winner.id,
        label: `${winner.name} clears it`,
        detail: `All six pairs found in ${winner.memory.moves} moves.`,
      };
    }
    if (first.status === "blocked" && second.status !== "blocked") {
      return {
        winner: second.id,
        label: `${second.name} wins`,
        detail: "Opponent BLOCKED before the board was cleared.",
      };
    }
    if (second.status === "blocked" && first.status !== "blocked") {
      return {
        winner: first.id,
        label: `${first.name} wins`,
        detail: "Opponent BLOCKED before the board was cleared.",
      };
    }

    const firstPairs = first.memory.matched.length / 2;
    const secondPairs = second.memory.matched.length / 2;
    if (firstPairs === secondPairs) {
      return {
        winner: "draw" as const,
        label: "Time. Draw.",
        detail: `Both Jevs found ${firstPairs} pair${firstPairs === 1 ? "" : "s"} before timeout.`,
      };
    }
    const winner = firstPairs > secondPairs ? first : second;
    return {
      winner: winner.id,
      label: `${winner.name} on points`,
      detail: `Timeout: ${firstPairs}–${secondPairs} matched pairs.`,
    };
  }, []);

  const runMemory = useCallback(
    async (
      currentPlayers: PlayerRun[],
      signal: AbortSignal,
      deadline: number,
    ) => {
      for (let step = 0; step < MEMORY_STEP_LIMIT; step += 1) {
        if (signal.aborted || Date.now() >= deadline) break;
        const completed = currentPlayers.filter(
          (player) =>
            player.memory.matched.length === player.memory.deck.length,
        );
        if (completed.length) break;
        if (currentPlayers.every((player) => player.status === "blocked")) break;

        const decisions = await getDecisions(
          "memory-match",
          currentPlayers,
          signal,
        );
        await executeDecisions(
          "memory-match",
          currentPlayers,
          decisions,
          signal,
        );
        await resolveMemoryPairs(currentPlayers, signal);
        await sleep(180, signal);
      }

      finishMatch(currentPlayers, memoryResult(currentPlayers));
    },
    [
      executeDecisions,
      finishMatch,
      getDecisions,
      memoryResult,
      resolveMemoryPairs,
    ],
  );

  const startFight = useCallback(
    async (game: GameId) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      activeGameRef.current = game;
      setActiveGame(game);
      setView("fight");
      setResult(null);
      setPhase("countdown");

      const deck = createMemoryDeck(MATCH_SEED);
      const nextPlayers = [
        createPlayer("jev-a", deck),
        createPlayer("jev-b", deck),
      ];
      runPlayersRef.current = nextPlayers;
      publish(nextPlayers);

      try {
        for (let count = 3; count >= 1; count -= 1) {
          setCountdown(count);
          await sleep(650, controller.signal);
        }

        setPhase("running");
        const duration =
          game === "whack-a-mole"
            ? WHACK_ROUNDS * WHACK_ROUND_MS + 2_000
            : MEMORY_TIMEOUT_MS;
        const deadline = Date.now() + duration;
        setTimeLeft(Math.ceil(duration / 1_000));
        const clock = window.setInterval(() => {
          setTimeLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1_000)));
        }, 250);

        try {
          if (game === "whack-a-mole") {
            await runWhack(nextPlayers, controller.signal, deadline);
          } else {
            await runMemory(nextPlayers, controller.signal, deadline);
          }
        } finally {
          window.clearInterval(clock);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          finishMatch(nextPlayers, {
            winner: "draw",
            label: "Arena interrupted",
            detail: "The duel stopped before a valid result was recorded.",
          });
        }
      }
    },
    [finishMatch, publish, runMemory, runWhack],
  );

  const backToLobby = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    runPlayersRef.current = null;
    setView("landing");
    setPhase("idle");
    setResult(null);
  }, []);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const demoMode =
    players.some((player) => player.latestDecision?.source === "demo") &&
    phase !== "countdown";

  return (
    <main className={view === "fight" ? "site fight-site" : "site"}>
      <header className="site-header">
        <button
          className="brand"
          onClick={backToLobby}
          type="button"
          aria-label="JevArena home"
        >
          <BrandMark />
          <span>JevArena</span>
        </button>
        <div className="header-meta">
          <span className="header-live">
            <i />
            OPEN SOURCE ARENA
          </span>
          <a
            className="github-link"
            href="https://github.com/raihankhan-rk/jevarena"
            rel="noreferrer"
            target="_blank"
          >
            <GithubIcon />
            <span>raihankhan-rk/jevarena</span>
          </a>
        </div>
      </header>

      {view === "landing" ? (
        <section className="landing">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span>01</span>
              TWO JEVS ENTER
            </div>
            <h1>
              Browser agents,
              <br />
              <em>head to head.</em>
            </h1>
            <p>
              Two TypeSafe Jev agents. Two real, indexed DOMs. No language
              model prose, no typing—just fast probabilistic decisions you can
              watch.
            </p>
            <div className="hero-proof">
              <span>
                <i>✓</i> Click only
              </span>
              <span>
                <i>✓</i> Shared seed
              </span>
              <span>
                <i>✓</i> Live probabilities
              </span>
            </div>
          </div>

          <div className="fight-card-wrap">
            <div className="fight-card-orbit orbit-one" />
            <div className="fight-card-orbit orbit-two" />
            <div className="fight-card">
              <div className="fight-card-top">
                <span>CHOOSE THE TRIAL</span>
                <b>LIVE / 02 GAMES</b>
              </div>
              <label className="game-select">
                <span>GAME</span>
                <div>
                  <select
                    value={selectedGame}
                    onChange={(event) =>
                      setSelectedGame(event.target.value as GameId)
                    }
                  >
                    <option value="whack-a-mole">Whack-a-Mole</option>
                    <option value="memory-match">Memory Match</option>
                  </select>
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m3.5 6 4.5 4 4.5-4" />
                  </svg>
                </div>
              </label>

              <div className="selected-game-info">
                <div className="game-number">
                  {selectedGame === "whack-a-mole" ? "01" : "02"}
                </div>
                <div>
                  <span>{GAME_COPY[selectedGame].eyebrow}</span>
                  <p>{GAME_COPY[selectedGame].description}</p>
                </div>
              </div>
              <div className="rules-row">
                <span>
                  <i className="rules-icon rules-icon-grid" />
                  {GAME_COPY[selectedGame].rule}
                </span>
                <span>
                  <i className="rules-icon rules-icon-clock" />
                  {GAME_COPY[selectedGame].duration}
                </span>
              </div>
              <button
                className="fight-button"
                onClick={() => startFight(selectedGame)}
                type="button"
              >
                <span>FIGHT</span>
                <i aria-hidden="true">↗</i>
              </button>
              <p className="fight-card-note">
                Server-only Jev · powered by <b>jev-latest</b>
              </p>
            </div>
          </div>

          <div className="landing-bottom">
            <span>TYPE<span>SAFE</span> SYSTEM ONE</span>
            <p>Built in public by Raihan Khan · @raihankhan_rk</p>
            <span>DOM INDEX / 2026</span>
          </div>
        </section>
      ) : (
        <section className="fight-view">
          <div className="arena-titlebar">
            <button className="back-button" onClick={backToLobby} type="button">
              ← Lobby
            </button>
            <div>
              <span>{GAME_COPY[activeGame].eyebrow}</span>
              <h1>{GAME_COPY[activeGame].label}</h1>
            </div>
            <div className="match-clock">
              <span>{phase === "finished" ? "FINAL" : "MATCH CLOCK"}</span>
              <strong>
                00:{String(timeLeft).padStart(2, "0")}
              </strong>
            </div>
          </div>

          {result && (
            <div className={`winner-banner winner-${result.winner}`}>
              <div className="winner-trophy" aria-hidden="true">
                ✦
              </div>
              <div>
                <span>MATCH RESULT</span>
                <h2>{result.label}</h2>
                <p>{result.detail}</p>
              </div>
              <button
                onClick={() => startFight(activeGame)}
                className="rematch-button"
                type="button"
              >
                Rematch <span>↻</span>
              </button>
            </div>
          )}

          <div className="versus-grid">
            <AgentPane
              accent="coral"
              game={activeGame}
              onAction={executeFixtureAction}
              player={players[0]}
            />
            <div className="versus-badge" aria-hidden="true">
              <span>VS</span>
            </div>
            <AgentPane
              accent="teal"
              game={activeGame}
              onAction={executeFixtureAction}
              player={players[1]}
            />
          </div>

          <div className="arena-rules">
            <div>
              <span className="rule-number">01</span>
              <p>
                <b>Identical fixture</b>
                Shared seed, separate browser state.
              </p>
            </div>
            <div>
              <span className="rule-number">02</span>
              <p>
                <b>Bounded execution</b>
                Timeout or invalid action becomes BLOCKED.
              </p>
            </div>
            <div>
              <span className="rule-number">03</span>
              <p>
                <b>Code verifies wins</b>
                DONE never decides the match by itself.
              </p>
            </div>
            <span className={`runtime-mode${demoMode ? " is-demo" : ""}`}>
              <i />
              {demoMode
                ? "DEMO POLICY · ADD TYPESAFE_API_KEY FOR LIVE JEV"
                : "DUAL AGENT RUNTIME"}
            </span>
          </div>

          {phase === "countdown" && (
            <div className="countdown-overlay" aria-live="assertive">
              <div>
                <span>READY BOTH AGENTS</span>
                <strong>{countdown}</strong>
                <p>Observe → choose → click</p>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
