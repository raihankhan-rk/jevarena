"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AgentPane } from "@/components/agent-pane";
import { SharedGameFixture } from "@/components/game-fixtures";
import {
  buildAgentRequest,
  createPlayer,
  createSharedRace,
  GAME_COPY,
  nextSpotCell,
} from "@/lib/arena/games";
import type {
  AgentDecision,
  GameId,
  MatchResult,
  PlayerId,
  PlayerRun,
  SharedRaceState,
  StepTrace,
} from "@/lib/arena/types";

const BASE_SEED = "jevarena-shared-race";
const MAX_ROUNDS = 30;
const GAME_ORDER: GameId[] = [
  "spot-race",
  "treasure-hunt",
  "claim-race",
];

interface CompletedDecision {
  playerId: PlayerId;
  decision: AgentDecision;
  completedAt: number;
}

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

function cloneRace(state: SharedRaceState): SharedRaceState {
  return {
    ...state,
    treasures: [...state.treasures],
    revealed: [...state.revealed],
    treasureOwners: { ...state.treasureOwners },
    claimOwners: [...state.claimOwners],
    scores: { ...state.scores },
    attempts: { ...state.attempts },
  };
}

function blockedDecision(reason: string): AgentDecision {
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
  state: SharedRaceState,
  player: PlayerRun,
  players: PlayerRun[],
  signal: AbortSignal,
): Promise<CompletedDecision> {
  const startedAt = performance.now();
  try {
    const response = await fetch("/api/agent/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAgentRequest(state, player, players)),
      cache: "no-store",
      signal,
    });
    const decision = response.ok
      ? ((await response.json()) as AgentDecision)
      : blockedDecision("Invalid shared-board snapshot; player BLOCKED.");
    return {
      playerId: player.id,
      decision,
      completedAt: performance.now(),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      playerId: player.id,
      decision: {
        ...blockedDecision("Agent request failed; player BLOCKED."),
        latencyMs: Math.round(performance.now() - startedAt),
      },
      completedAt: performance.now(),
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

function availableCount(state: SharedRaceState) {
  return state.game === "spot-race"
    ? state.spotClaimedBy
      ? 0
      : 1
    : state.game === "treasure-hunt"
    ? 25 - state.revealed.length
    : state.claimOwners.filter((owner) => owner === null).length;
}

function raceHasWinner(state: SharedRaceState) {
  return (
    (state.game === "spot-race" &&
      (state.scores["jev-a"] >= 7 || state.scores["jev-b"] >= 7)) ||
    (state.game === "treasure-hunt" &&
      (state.scores["jev-a"] >= 3 || state.scores["jev-b"] >= 3))
  );
}

export function Arena() {
  const [selectedGame, setSelectedGame] =
    useState<GameId>("treasure-hunt");
  const [view, setView] = useState<"landing" | "fight">("landing");
  const [phase, setPhase] = useState<
    "idle" | "countdown" | "running" | "finished"
  >("idle");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [players, setPlayers] = useState<[PlayerRun, PlayerRun]>(() => [
    createPlayer("jev-a"),
    createPlayer("jev-b"),
  ]);
  const [race, setRace] = useState<SharedRaceState>(() =>
    createSharedRace("treasure-hunt", `${BASE_SEED}:0`),
  );

  const controllerRef = useRef<AbortController | null>(null);
  const playersRef = useRef<PlayerRun[] | null>(null);
  const raceRef = useRef<SharedRaceState | null>(null);
  const executingPlayerRef = useRef<PlayerId | null>(null);
  const matchNumberRef = useRef(0);

  const publish = useCallback(
    (nextPlayers: PlayerRun[], nextRace: SharedRaceState) => {
      setPlayers(clonePlayers(nextPlayers));
      setRace(cloneRace(nextRace));
    },
    [],
  );

  const claimCell = useCallback((targetId: string) => {
    const state = raceRef.current;
    const currentPlayers = playersRef.current;
    const playerId = executingPlayerRef.current;
    const player = currentPlayers?.find(
      (candidate) => candidate.id === playerId,
    );
    if (!state || !player || !playerId) return;

    const cell = Number(targetId.split("-")[1]) - 1;
    state.attempts[playerId] += 1;
    const unavailable =
      state.game === "spot-race"
        ? cell !== state.activeCell || state.spotClaimedBy !== null
        : state.game === "treasure-hunt"
        ? state.revealed.includes(cell)
        : state.claimOwners[cell] !== null;

    if (!Number.isInteger(cell) || cell < 0 || cell >= 25 || unavailable) {
      state.collisionCell = Number.isInteger(cell) ? cell : null;
      const owner =
        state.game === "spot-race"
          ? state.spotClaimedBy
          : state.game === "claim-race"
            ? state.claimOwners[cell]
            : null;
      player.pendingOutcome = owner
        ? `[${cell + 1}] already scored by ${
            owner === "jev-a" ? "Jev" : "parallel Jev"
          }`
        : `[${cell + 1}] already revealed · claim lost`;
      return;
    }

    state.lastCell = cell;
    state.collisionCell = null;
    if (state.game === "spot-race") {
      state.spotClaimedBy = playerId;
      state.scores[playerId] += 1;
      player.pendingOutcome = `[${cell + 1}] LIT CELL · +1 point`;
    } else if (state.game === "treasure-hunt") {
      state.revealed.push(cell);
      if (state.treasures.includes(cell)) {
        state.treasureOwners[cell] = playerId;
        state.scores[playerId] += 1;
        player.pendingOutcome = `[${cell + 1}] TREASURE · claim won`;
      } else {
        player.pendingOutcome = `[${cell + 1}] empty · revealed first`;
      }
    } else {
      state.claimOwners[cell] = playerId;
      state.scores[playerId] += 1;
      player.pendingOutcome = `[${cell + 1}] claimed · +1`;
    }
  }, []);

  const addTrace = useCallback(
    (player: PlayerRun, decision: AgentDecision) => {
      const trace: StepTrace = {
        step: player.history.length + 1,
        operation: decision.operation,
        targetId: decision.targetId,
        outcome: player.pendingOutcome || "No claim executed",
        operationProbabilities: decision.operationProbabilities,
        targetProbabilities: decision.targetProbabilities,
        confidence: decision.confidence,
        targetConfidence: decision.targetConfidence,
        latencyMs: decision.latencyMs,
        model: decision.model,
        source: decision.source,
      };
      player.history.push(trace);
    },
    [],
  );

  const applySerially = useCallback(
    async (
      completed: CompletedDecision[],
      currentPlayers: PlayerRun[],
      state: SharedRaceState,
      signal: AbortSignal,
      matchNumber: number,
    ) => {
      completed.forEach(({ playerId, decision }) => {
        const player = currentPlayers.find(
          (candidate) => candidate.id === playerId,
        );
        if (!player) return;
        player.latestDecision = decision;
        player.pendingOutcome = "";
        player.status =
          decision.operation === "BLOCKED" ? "blocked" : "acting";
      });
      publish(currentPlayers, state);
      await sleep(90, signal);

      const preferredFirst: PlayerId =
        (state.round + matchNumber) % 2 === 0 ? "jev-a" : "jev-b";
      completed.sort((first, second) => {
        const delta = first.completedAt - second.completedAt;
        if (Math.abs(delta) > 4) return delta;
        return first.playerId === preferredFirst ? -1 : 1;
      });

      for (const { playerId, decision } of completed) {
        const player = currentPlayers.find(
          (candidate) => candidate.id === playerId,
        );
        if (!player) continue;

        if (raceHasWinner(state)) {
          player.pendingOutcome = "Race ended before this claim acquired the lock";
        } else if (decision.operation === "CLICK" && decision.targetId) {
          executingPlayerRef.current = playerId;
          const element = document.getElementById(
            `shared-${decision.targetId}`,
          ) as HTMLButtonElement | null;
          if (element) {
            element.click();
          } else {
            player.pendingOutcome = `${decision.targetId} left the shared action space`;
          }
          executingPlayerRef.current = null;
        } else {
          player.pendingOutcome =
            decision.blockedReason ?? "No shared-board claim available";
        }

        addTrace(player, decision);
        if (decision.operation !== "BLOCKED") player.status = "ready";
      }

      state.round += 1;
      publish(currentPlayers, state);
      if (state.game === "spot-race" && !raceHasWinner(state)) {
        await sleep(260, signal);
        state.activeCell = nextSpotCell(
          state.seed,
          state.round,
          state.activeCell,
        );
        state.spotClaimedBy = null;
        state.lastCell = null;
        state.collisionCell = null;
        publish(currentPlayers, state);
      }
    },
    [addTrace, publish],
  );

  const getParallelDecisions = useCallback(
    async (
      currentPlayers: PlayerRun[],
      state: SharedRaceState,
      signal: AbortSignal,
    ) => {
      currentPlayers.forEach((player) => {
        if (player.status !== "blocked") player.status = "thinking";
      });
      publish(currentPlayers, state);
      return Promise.all(
        currentPlayers.map((player) =>
          player.status === "blocked"
            ? Promise.resolve({
                playerId: player.id,
                decision: blockedDecision("Player already BLOCKED."),
                completedAt: Number.POSITIVE_INFINITY,
              })
            : requestDecision(state, player, currentPlayers, signal),
        ),
      );
    },
    [publish],
  );

  const resolveResult = useCallback(
    (state: SharedRaceState, currentPlayers: PlayerRun[]): MatchResult => {
      const [first, second] = currentPlayers;
      if (first.status === "blocked" && second.status === "blocked") {
        return {
          winner: "draw",
          label: "Double BLOCKED",
          detail: "Neither Jev returned another valid claim.",
        };
      }
      if (first.status === "blocked" || second.status === "blocked") {
        const winner = first.status === "blocked" ? second : first;
        return {
          winner: winner.id,
          label: `${winner.name} wins`,
          detail: "Opponent BLOCKED during the shared race.",
        };
      }
      if (state.scores[first.id] !== state.scores[second.id]) {
        const winner =
          state.scores[first.id] > state.scores[second.id] ? first : second;
        return {
          winner: winner.id,
          label:
            state.game === "spot-race"
              ? `${winner.name} wins Spot Race`
              : state.game === "treasure-hunt"
              ? `${winner.name} found the majority`
              : `${winner.name} claimed the grid`,
          detail: `${state.scores[first.id]}–${state.scores[second.id]} · first claim wins.`,
        };
      }
      return {
        winner: "draw",
        label: "Dead heat",
        detail: `${state.scores[first.id]} claims each after ${state.round} rounds.`,
      };
    },
    [],
  );

  const finishMatch = useCallback(
    (
      currentPlayers: PlayerRun[],
      state: SharedRaceState,
      matchResult: MatchResult,
    ) => {
      currentPlayers.forEach((player) => {
        if (player.status !== "blocked") player.status = "done";
      });
      publish(currentPlayers, state);
      setResult(matchResult);
      setPhase("finished");
      setTimeLeft(0);
    },
    [publish],
  );

  const runRace = useCallback(
    async (
      currentPlayers: PlayerRun[],
      state: SharedRaceState,
      signal: AbortSignal,
      matchNumber: number,
      deadline: number,
    ) => {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        if (
          signal.aborted ||
          Date.now() >= deadline ||
          raceHasWinner(state) ||
          availableCount(state) === 0 ||
          currentPlayers.some((player) => player.status === "blocked")
        ) {
          break;
        }
        const completed = await getParallelDecisions(
          currentPlayers,
          state,
          signal,
        );
        await applySerially(
          completed,
          currentPlayers,
          state,
          signal,
          matchNumber,
        );
        await sleep(150, signal);
      }
      finishMatch(currentPlayers, state, resolveResult(state, currentPlayers));
    },
    [
      applySerially,
      finishMatch,
      getParallelDecisions,
      resolveResult,
    ],
  );

  const startFight = useCallback(
    async (game: GameId) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      matchNumberRef.current += 1;
      const matchNumber = matchNumberRef.current;
      const nextPlayers = [createPlayer("jev-a"), createPlayer("jev-b")];
      const nextRace = createSharedRace(
        game,
        `${BASE_SEED}:${matchNumber}`,
      );
      playersRef.current = nextPlayers;
      raceRef.current = nextRace;
      setSelectedGame(game);
      setView("fight");
      setResult(null);
      setPhase("countdown");
      publish(nextPlayers, nextRace);

      try {
        for (let count = 3; count >= 1; count -= 1) {
          setCountdown(count);
          await sleep(550, controller.signal);
        }
        setPhase("running");
        const duration = 50_000;
        const deadline = Date.now() + duration;
        setTimeLeft(duration / 1_000);
        const clock = window.setInterval(() => {
          setTimeLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1_000)));
        }, 250);
        try {
          await runRace(
            nextPlayers,
            nextRace,
            controller.signal,
            matchNumber,
            deadline,
          );
        } finally {
          window.clearInterval(clock);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          finishMatch(nextPlayers, nextRace, {
            winner: "draw",
            label: "Race interrupted",
            detail: "The shared board stopped before a result.",
          });
        }
      }
    },
    [finishMatch, publish, runRace],
  );

  const backToLobby = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    playersRef.current = null;
    raceRef.current = null;
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

  const scoreLabel =
    selectedGame === "spot-race"
      ? "POINTS"
      : selectedGame === "treasure-hunt"
        ? "TREASURES"
        : "CLAIMS";

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
            <span className="modal-kicker">SELECT A SHARED RACE</span>
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
        <section className="fight-view shared-fight-view">
          <div className="arena-titlebar">
            <button className="back-button" onClick={backToLobby} type="button">
              ← Lobby
            </button>
            <div>
              <span>{GAME_COPY[selectedGame].eyebrow}</span>
              <h1>{GAME_COPY[selectedGame].label}</h1>
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
                onClick={() => startFight(selectedGame)}
                className="rematch-button"
                type="button"
              >
                Rematch <span>↻</span>
              </button>
            </div>
          )}

          <div className="shared-race-layout">
            <AgentPane
              accent="coral"
              player={players[0]}
              score={race.scores["jev-a"]}
              scoreLabel={scoreLabel}
            />

            <div className="shared-browser-shell">
              <div className="browser-chrome">
                <span className="browser-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <div className="browser-address">
                  arena.local/{selectedGame}?world=shared
                </div>
                <span className="browser-live">
                  <i />
                  SHARED
                </span>
              </div>
              <SharedGameFixture state={race} onAction={claimCell} />
              <div className="dom-index-pill">
                <span>&lt;/&gt;</span> one indexed DOM · first claim wins
              </div>
            </div>

            <AgentPane
              accent="teal"
              player={players[1]}
              score={race.scores["jev-b"]}
              scoreLabel={scoreLabel}
            />
          </div>

          {phase === "countdown" && (
            <div className="countdown-overlay" aria-live="assertive">
              <div>
                <span>SHARED WORLD READY</span>
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
