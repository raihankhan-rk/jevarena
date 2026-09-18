"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AgentPane } from "@/components/agent-pane";
import {
  add2048Tile,
  buildAgentRequest,
  createPlayer,
  GAME_COPY,
  move2048,
} from "@/lib/arena/games";
import type {
  AgentDecision,
  Direction,
  GameId,
  MatchResult,
  PlayerId,
  PlayerRun,
  StepTrace,
} from "@/lib/arena/types";

const MATCH_SEED = "jevarena-public-demo-v2";
const MEMORY_STEP_LIMIT = 42;
const MEMORY_TIMEOUT_MS = 75_000;
const GAME_2048_STEPS = 24;
const TREASURE_STEP_LIMIT = 25;

const GAME_ORDER: GameId[] = ["memory-match", "2048", "treasure-hunt"];

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
    memory: {
      ...player.memory,
      deck: [...player.memory.deck],
      revealed: [...player.memory.revealed],
      matched: [...player.memory.matched],
      seen: { ...player.memory.seen },
    },
    game2048: {
      ...player.game2048,
      board: [...player.game2048.board],
    },
    treasure: {
      ...player.treasure,
      treasures: [...player.treasure.treasures],
      revealed: [...player.treasure.revealed],
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
    operationProbabilities: { CLICK: 0, BLOCKED: 1 },
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

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.9 2H22l-6.8 7.8L23.2 22H17l-4.9-6.4L6.5 22H3.3l7.3-8.4L2.9 2h6.3l4.4 5.8L18.9 2Zm-1.1 17.9h1.7L8.3 4H6.5l11.3 15.9Z"
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

function isComplete(game: GameId, player: PlayerRun) {
  if (game === "memory-match") {
    return player.memory.matched.length === player.memory.deck.length;
  }
  if (game === "2048") {
    return (
      player.game2048.steps >= GAME_2048_STEPS ||
      Math.max(...player.game2048.board) >= 2048
    );
  }
  return player.treasure.found >= player.treasure.treasures.length;
}

export function Arena() {
  const [selectedGame, setSelectedGame] = useState<GameId>("memory-match");
  const [activeGame, setActiveGame] = useState<GameId>("memory-match");
  const [view, setView] = useState<"landing" | "fight">("landing");
  const [phase, setPhase] = useState<
    "idle" | "countdown" | "running" | "finished"
  >("idle");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [players, setPlayers] = useState<[PlayerRun, PlayerRun]>(() => [
    createPlayer("jev-a", MATCH_SEED),
    createPlayer("jev-b", MATCH_SEED),
  ]);

  const controllerRef = useRef<AbortController | null>(null);
  const runPlayersRef = useRef<PlayerRun[] | null>(null);
  const activeGameRef = useRef<GameId>("memory-match");

  const publish = useCallback((next: PlayerRun[]) => {
    setPlayers(clonePlayers(next));
  }, []);

  const executeFixtureAction = useCallback(
    (playerId: PlayerId, targetId: string) => {
      const player = runPlayersRef.current?.find(
        (candidate) => candidate.id === playerId,
      );
      if (!player || player.status === "blocked") return;

      if (activeGameRef.current === "memory-match") {
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
        memory.flips += 1;
        if (memory.revealed.length === 2) memory.moves += 1;
        player.pendingOutcome = `Clicked [${cardIndex + 1}] · revealed ${memory.deck[cardIndex]}`;
        return;
      }

      if (activeGameRef.current === "2048") {
        const direction = targetId.replace("move-", "") as Direction;
        if (!["up", "down", "left", "right"].includes(direction)) {
          player.pendingOutcome = `Rejected invalid direction ${targetId}`;
          return;
        }
        const moved = move2048(player.game2048.board, direction);
        player.game2048.steps += 1;
        player.game2048.lastMoved = direction;
        if (moved.changed) {
          player.game2048.score += moved.scoreGain;
          player.game2048.board = add2048Tile(
            moved.board,
            MATCH_SEED,
            player.game2048.spawnCursor,
          );
          player.game2048.spawnCursor += 1;
          player.pendingOutcome = `Moved ${direction.toUpperCase()} · +${moved.scoreGain} score`;
        } else {
          player.pendingOutcome = `Moved ${direction.toUpperCase()} · board unchanged`;
        }
        return;
      }

      const cellIndex = Number(targetId.split("-")[1]) - 1;
      if (
        !Number.isInteger(cellIndex) ||
        player.treasure.revealed.includes(cellIndex)
      ) {
        player.pendingOutcome = `Rejected stale target ${targetId}`;
        return;
      }
      player.treasure.revealed.push(cellIndex);
      player.treasure.clicks += 1;
      player.treasure.lastCell = cellIndex;
      const foundTreasure = player.treasure.treasures.includes(cellIndex);
      if (foundTreasure) player.treasure.found += 1;
      player.pendingOutcome = foundTreasure
        ? `Clicked [${cellIndex + 1}] · TREASURE FOUND`
        : `Clicked [${cellIndex + 1}] · empty`;
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
        if (!decision || player.status === "blocked" || player.status === "done")
          return;
        player.latestDecision = decision;
        player.pendingOutcome = "";
        player.status =
          decision.operation === "BLOCKED" ? "blocked" : "acting";
      });
      publish(currentPlayers);
      await sleep(110, signal);

      decisions.forEach((decision, index) => {
        const player = currentPlayers[index];
        if (!decision || player.status === "done") return;

        if (decision.operation === "CLICK" && decision.targetId) {
          const element = document.getElementById(
            `${player.id}-${decision.targetId}`,
          ) as HTMLButtonElement | null;
          if (element && !element.disabled) {
            element.click();
          } else {
            player.pendingOutcome = `Target ${decision.targetId} went stale · no click`;
          }
        } else if (decision.operation === "BLOCKED") {
          player.pendingOutcome =
            decision.blockedReason ?? "No supported action can progress";
        } else {
          player.pendingOutcome = `${decision.operation} rejected · click required`;
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
        if (isComplete(game, player)) {
          player.status = "done";
        } else if (player.status !== "blocked") {
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
      });
      publish(currentPlayers);
      setResult(matchResult);
      setPhase("finished");
      setTimeLeft(0);
    },
    [publish],
  );

  const blockedResult = useCallback((currentPlayers: PlayerRun[]) => {
    const [first, second] = currentPlayers;
    if (first.status === "blocked" && second.status === "blocked") {
      return {
        winner: "draw" as const,
        label: "Double BLOCKED",
        detail: "Neither Jev returned another valid click.",
      };
    }
    if (first.status === "blocked" || second.status === "blocked") {
      const winner = first.status === "blocked" ? second : first;
      return {
        winner: winner.id,
        label: `${winner.name} wins`,
        detail: "Opponent BLOCKED before the game ended.",
      };
    }
    return null;
  }, []);

  const resolveMemoryPairs = useCallback(
    async (currentPlayers: PlayerRun[], signal: AbortSignal) => {
      if (
        !currentPlayers.some((player) => player.memory.revealed.length === 2)
      ) {
        return;
      }
      publish(currentPlayers);
      await sleep(460, signal);

      currentPlayers.forEach((player) => {
        const [first, second] = player.memory.revealed;
        if (first === undefined || second === undefined) return;
        const matched = player.memory.deck[first] === player.memory.deck[second];
        const latest = player.history.at(-1);
        if (matched) {
          player.memory.matched.push(first, second);
          if (latest) latest.outcome += " · PAIR MATCHED";
        } else if (latest) {
          latest.outcome += " · mismatch, flipped face-down";
        }
        player.memory.revealed = [];
      });
      publish(currentPlayers);
      await sleep(120, signal);
    },
    [publish],
  );

  const memoryResult = useCallback(
    (currentPlayers: PlayerRun[]): MatchResult => {
      const blocked = blockedResult(currentPlayers);
      if (blocked) return blocked;
      const [first, second] = currentPlayers;
      const firstComplete = isComplete("memory-match", first);
      const secondComplete = isComplete("memory-match", second);
      if (firstComplete && secondComplete) {
        return {
          winner: "draw",
          label: "Perfect sync",
          detail: "Both Jevs cleared the deck on the same click cycle.",
        };
      }
      if (firstComplete || secondComplete) {
        const winner = firstComplete ? first : second;
        return {
          winner: winner.id,
          label: `${winner.name} clears it`,
          detail: `Six pairs in ${winner.memory.flips} flips.`,
        };
      }
      const firstPairs = first.memory.matched.length / 2;
      const secondPairs = second.memory.matched.length / 2;
      if (firstPairs !== secondPairs) {
        const winner = firstPairs > secondPairs ? first : second;
        return {
          winner: winner.id,
          label: `${winner.name} on pairs`,
          detail: `Limit reached at ${firstPairs}–${secondPairs} pairs.`,
        };
      }
      if (first.memory.flips !== second.memory.flips) {
        const winner =
          first.memory.flips < second.memory.flips ? first : second;
        return {
          winner: winner.id,
          label: `${winner.name} on efficiency`,
          detail: `${firstPairs} pairs each; fewer flips wins.`,
        };
      }
      return {
        winner: "draw",
        label: "Limit reached",
        detail: `${firstPairs} pairs and ${first.memory.flips} flips each.`,
      };
    },
    [blockedResult],
  );

  const runMemory = useCallback(
    async (
      currentPlayers: PlayerRun[],
      signal: AbortSignal,
      deadline: number,
    ) => {
      for (let step = 0; step < MEMORY_STEP_LIMIT; step += 1) {
        if (
          signal.aborted ||
          Date.now() >= deadline ||
          currentPlayers.some((player) => isComplete("memory-match", player)) ||
          currentPlayers.every((player) => player.status === "blocked")
        ) {
          break;
        }
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

  const game2048Result = useCallback(
    (currentPlayers: PlayerRun[]): MatchResult => {
      const blocked = blockedResult(currentPlayers);
      if (blocked) return blocked;
      const [first, second] = currentPlayers;
      if (first.game2048.score !== second.game2048.score) {
        const winner =
          first.game2048.score > second.game2048.score ? first : second;
        return {
          winner: winner.id,
          label: `${winner.name} wins`,
          detail: `${first.game2048.score}–${second.game2048.score} after 24 moves.`,
        };
      }
      const firstMax = Math.max(...first.game2048.board);
      const secondMax = Math.max(...second.game2048.board);
      if (firstMax !== secondMax) {
        const winner = firstMax > secondMax ? first : second;
        return {
          winner: winner.id,
          label: `${winner.name} wins`,
          detail: `Scores tied; ${winner.name} built the higher tile.`,
        };
      }
      return {
        winner: "draw",
        label: "Even boards",
        detail: `${first.game2048.score} points and a ${firstMax} high tile each.`,
      };
    },
    [blockedResult],
  );

  const run2048 = useCallback(
    async (currentPlayers: PlayerRun[], signal: AbortSignal) => {
      for (let step = 0; step < GAME_2048_STEPS; step += 1) {
        if (
          signal.aborted ||
          currentPlayers.some(
            (player) => Math.max(...player.game2048.board) >= 2048,
          ) ||
          currentPlayers.every((player) => player.status === "blocked")
        ) {
          break;
        }
        const decisions = await getDecisions("2048", currentPlayers, signal);
        await executeDecisions(
          "2048",
          currentPlayers,
          decisions,
          signal,
        );
        await sleep(170, signal);
      }
      finishMatch(currentPlayers, game2048Result(currentPlayers));
    },
    [executeDecisions, finishMatch, game2048Result, getDecisions],
  );

  const treasureResult = useCallback(
    (currentPlayers: PlayerRun[]): MatchResult => {
      const blocked = blockedResult(currentPlayers);
      if (blocked) return blocked;
      const [first, second] = currentPlayers;
      const firstComplete = isComplete("treasure-hunt", first);
      const secondComplete = isComplete("treasure-hunt", second);
      if (firstComplete && secondComplete) {
        return {
          winner: "draw",
          label: "Same spot, same time",
          detail: "Both Jevs found all three treasures together.",
        };
      }
      if (firstComplete || secondComplete) {
        const winner = firstComplete ? first : second;
        return {
          winner: winner.id,
          label: `${winner.name} found them`,
          detail: `All three treasures in ${winner.treasure.clicks} clicks.`,
        };
      }
      if (first.treasure.found !== second.treasure.found) {
        const winner =
          first.treasure.found > second.treasure.found ? first : second;
        return {
          winner: winner.id,
          label: `${winner.name} found more`,
          detail: `${first.treasure.found}–${second.treasure.found} treasures.`,
        };
      }
      return {
        winner: "draw",
        label: "Grid exhausted",
        detail: `${first.treasure.found} treasures each.`,
      };
    },
    [blockedResult],
  );

  const runTreasure = useCallback(
    async (currentPlayers: PlayerRun[], signal: AbortSignal) => {
      for (let step = 0; step < TREASURE_STEP_LIMIT; step += 1) {
        if (
          signal.aborted ||
          currentPlayers.some((player) => isComplete("treasure-hunt", player)) ||
          currentPlayers.every((player) => player.status === "blocked")
        ) {
          break;
        }
        const decisions = await getDecisions(
          "treasure-hunt",
          currentPlayers,
          signal,
        );
        await executeDecisions(
          "treasure-hunt",
          currentPlayers,
          decisions,
          signal,
        );
        await sleep(190, signal);
      }
      finishMatch(currentPlayers, treasureResult(currentPlayers));
    },
    [executeDecisions, finishMatch, getDecisions, treasureResult],
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

      const nextPlayers = [
        createPlayer("jev-a", MATCH_SEED),
        createPlayer("jev-b", MATCH_SEED),
      ];
      runPlayersRef.current = nextPlayers;
      publish(nextPlayers);

      try {
        for (let count = 3; count >= 1; count -= 1) {
          setCountdown(count);
          await sleep(600, controller.signal);
        }
        setPhase("running");
        const duration =
          game === "memory-match"
            ? MEMORY_TIMEOUT_MS
            : game === "2048"
              ? 45_000
              : 40_000;
        const deadline = Date.now() + duration;
        setTimeLeft(Math.ceil(duration / 1_000));
        const clock = window.setInterval(() => {
          setTimeLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1_000)));
        }, 250);

        try {
          if (game === "memory-match") {
            await runMemory(nextPlayers, controller.signal, deadline);
          } else if (game === "2048") {
            await run2048(nextPlayers, controller.signal);
          } else {
            await runTreasure(nextPlayers, controller.signal);
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
    [finishMatch, publish, run2048, runMemory, runTreasure],
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
        <a
          className="github-link"
          href="https://github.com/raihankhan-rk/jevarena"
          rel="noreferrer"
          target="_blank"
        >
          <GithubIcon />
          <span>raihankhan-rk/jevarena</span>
        </a>
      </header>

      {view === "landing" ? (
        <section className="simple-landing">
          <h1>Jev fights Jev</h1>
          <div className="game-modal">
            <span className="modal-kicker">SELECT A GAME</span>
            <label className="game-select">
              <span>GAME</span>
              <div>
                <select
                  value={selectedGame}
                  onChange={(event) =>
                    setSelectedGame(event.target.value as GameId)
                  }
                >
                  {GAME_ORDER.map((game) => (
                    <option value={game} key={game}>
                      {GAME_COPY[game].label}
                    </option>
                  ))}
                </select>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m3.5 6 4.5 4 4.5-4" />
                </svg>
              </div>
            </label>
            <div className="modal-game-rule">
              <span>{GAME_COPY[selectedGame].eyebrow}</span>
              <p>{GAME_COPY[selectedGame].rule}</p>
            </div>
            <button
              className="fight-button"
              onClick={() => startFight(selectedGame)}
              type="button"
            >
              <span>FIGHT</span>
              <i aria-hidden="true">↗</i>
            </button>
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

          {phase === "countdown" && (
            <div className="countdown-overlay" aria-live="assertive">
              <div>
                <span>READY</span>
                <strong>{countdown}</strong>
              </div>
            </div>
          )}
        </section>
      )}

      <footer className="site-footer">
        <span>TypeSafe System One</span>
        <a href="https://x.com/raihankhan_rk" rel="noreferrer" target="_blank">
          Built by <XIcon /> <b>@raihankhan_rk</b>
        </a>
        <span aria-hidden="true" />
      </footer>
    </main>
  );
}
