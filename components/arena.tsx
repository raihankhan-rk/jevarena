"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AgentPane } from "@/components/agent-pane";
import { AgentAvatar } from "@/components/agent-avatar";
import { buildAgentRequest, createPlayer } from "@/lib/arena/games";
import type {
  AgentDecision,
  Direction,
  MatchResult,
  PlayerId,
  PlayerRun,
  SnakeSnapshot,
  StepTrace,
} from "@/lib/arena/types";

const MATCH_DURATION_MS = 60_000;
const DECISION_INTERVAL_MS = 360;

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

function blockedDecision(reason: string): AgentDecision {
  return {
    operation: "BLOCKED",
    targetId: null,
    operationProbabilities: { CLICK: 0, WAIT: 0, BLOCKED: 1 },
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
  snapshot: SnakeSnapshot,
  player: PlayerRun,
  signal: AbortSignal,
) {
  const startedAt = performance.now();
  try {
    const response = await fetch("/api/agent/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAgentRequest(snapshot, player)),
      cache: "no-store",
      signal,
    });
    if (!response.ok) {
      return blockedDecision("Invalid Snake snapshot; Jev is BLOCKED.");
    }
    return (await response.json()) as AgentDecision;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      ...blockedDecision("Jev request failed; this browser is BLOCKED."),
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

export function Arena() {
  const [view, setView] = useState<"landing" | "fight">("landing");
  const [phase, setPhase] = useState<
    "idle" | "loading" | "countdown" | "running" | "finished"
  >("idle");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [matchId, setMatchId] = useState(0);
  const [players, setPlayers] = useState<[PlayerRun, PlayerRun]>(() => [
    createPlayer("jev-a"),
    createPlayer("jev-b"),
  ]);

  const playersRef = useRef<PlayerRun[]>(players);
  const snapshotsRef = useRef<Partial<Record<PlayerId, SnakeSnapshot>>>({});
  const readyRef = useRef(new Set<PlayerId>());
  const pendingRef = useRef<Record<PlayerId, boolean>>({
    "jev-a": false,
    "jev-b": false,
  });
  const lastDecisionRef = useRef<Record<PlayerId, number>>({
    "jev-a": 0,
    "jev-b": 0,
  });
  const runningRef = useRef(false);
  const countdownStartedRef = useRef(false);
  const finishedRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const clockRef = useRef<number | null>(null);

  const publish = useCallback(() => {
    setPlayers(
      playersRef.current.map(clonePlayer) as [PlayerRun, PlayerRun],
    );
  }, []);

  const postToFrame = useCallback(
    (agentId: PlayerId, message: Record<string, unknown>) => {
      const frame = document.getElementById(
        `snake-frame-${agentId}`,
      ) as HTMLIFrameElement | null;
      frame?.contentWindow?.postMessage(message, window.location.origin);
    },
    [],
  );

  const stopFrames = useCallback(() => {
    postToFrame("jev-a", { type: "snake-stop" });
    postToFrame("jev-b", { type: "snake-stop" });
  }, [postToFrame]);

  const finishMatch = useCallback(
    (reason: "time" | "crash" | "blocked", stoppedAgent?: PlayerId) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      runningRef.current = false;
      controllerRef.current?.abort();
      if (clockRef.current) window.clearInterval(clockRef.current);
      stopFrames();

      const [first, second] = playersRef.current;
      let winner: PlayerRun | null = null;
      if (stoppedAgent) {
        winner = stoppedAgent === "jev-a" ? second : first;
      } else if (first.score !== second.score) {
        winner = first.score > second.score ? first : second;
      }

      const matchResult: MatchResult = winner
        ? {
            winner: winner.id,
            label: `${winner.name} wins`,
            detail:
              reason === "crash"
                ? `${stoppedAgent === "jev-a" ? first.name : second.name} crashed · ${first.score}–${second.score}`
                : reason === "blocked"
                  ? `Opponent BLOCKED · ${first.score}–${second.score}`
                  : `Time · ${first.score}–${second.score}`,
          }
        : {
            winner: "draw",
            label: "Scores tied",
            detail: `Time · ${first.score}–${second.score}`,
          };

      playersRef.current.forEach((player) => {
        if (player.status !== "blocked") player.status = "done";
      });
      publish();
      setResult(matchResult);
      setPhase("finished");
      setTimeLeft(0);
    },
    [publish, stopFrames],
  );

  const runDecision = useCallback(
    async (agentId: PlayerId, snapshot: SnakeSnapshot) => {
      if (
        !runningRef.current ||
        pendingRef.current[agentId] ||
        !snapshot.alive
      ) {
        return;
      }
      const now = performance.now();
      if (now - lastDecisionRef.current[agentId] < DECISION_INTERVAL_MS) return;
      lastDecisionRef.current[agentId] = now;
      pendingRef.current[agentId] = true;
      const player = playersRef.current.find(
        (candidate) => candidate.id === agentId,
      );
      const signal = controllerRef.current?.signal;
      if (!player || !signal) return;

      player.status = "thinking";
      publish();
      try {
        const decision = await requestDecision(snapshot, player, signal);
        if (!runningRef.current) return;
        player.latestDecision = decision;
        player.status =
          decision.operation === "BLOCKED" ? "blocked" : "acting";
        const direction = decision.targetId?.replace(
          "direction-",
          "",
        ) as Direction | undefined;
        let outcome = "WAIT · current direction continues";

        if (decision.operation === "CLICK" && direction) {
          postToFrame(agentId, {
            type: "snake-direction",
            direction,
          });
          outcome = `Clicked ${direction.toUpperCase()} in ${decision.latencyMs}ms`;
        } else if (decision.operation === "BLOCKED") {
          outcome = decision.blockedReason ?? "No safe move";
        }

        const trace: StepTrace = {
          step: player.history.length + 1,
          operation: decision.operation,
          targetId: decision.targetId,
          outcome,
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
        publish();
        if (decision.operation === "BLOCKED") {
          finishMatch("blocked", agentId);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          player.status = "blocked";
          publish();
          finishMatch("blocked", agentId);
        }
      } finally {
        pendingRef.current[agentId] = false;
      }
    },
    [finishMatch, postToFrame, publish],
  );

  const beginCountdown = useCallback(async () => {
    if (countdownStartedRef.current || readyRef.current.size < 2) return;
    countdownStartedRef.current = true;
    setPhase("countdown");
    const signal = controllerRef.current?.signal;
    if (!signal) return;
    try {
      for (let count = 3; count >= 1; count -= 1) {
        setCountdown(count);
        await sleep(600, signal);
      }
      try {
        await fetch("/api/fights", {
          method: "POST",
          cache: "no-store",
          signal,
        });
      } catch {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      }
      runningRef.current = true;
      setPhase("running");
      const deadline = Date.now() + MATCH_DURATION_MS;
      setTimeLeft(60);
      postToFrame("jev-a", { type: "snake-start" });
      postToFrame("jev-b", { type: "snake-start" });
      clockRef.current = window.setInterval(() => {
        const remaining = Math.max(
          0,
          Math.ceil((deadline - Date.now()) / 1_000),
        );
        setTimeLeft(remaining);
        if (remaining === 0) finishMatch("time");
      }, 250);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        finishMatch("blocked");
      }
    }
  }, [finishMatch, postToFrame]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data as {
        type?: string;
        agentId?: PlayerId;
        state?: SnakeSnapshot;
      };
      if (!message.agentId || !message.state) return;
      if (
        message.type !== "snake-ready" &&
        message.type !== "snake-state" &&
        message.type !== "snake-crash"
      ) {
        return;
      }

      snapshotsRef.current[message.agentId] = message.state;
      const player = playersRef.current.find(
        (candidate) => candidate.id === message.agentId,
      );
      if (!player) return;
      player.score = message.state.score;
      player.alive = message.state.alive;
      if (message.type === "snake-ready") {
        player.status = "ready";
        readyRef.current.add(message.agentId);
        publish();
        void beginCountdown();
      } else if (message.type === "snake-crash") {
        publish();
        if (runningRef.current) finishMatch("crash", message.agentId);
      } else {
        publish();
        void runDecision(message.agentId, message.state);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [beginCountdown, finishMatch, publish, runDecision]);

  const startFight = useCallback(() => {
    controllerRef.current?.abort();
    if (clockRef.current) window.clearInterval(clockRef.current);
    const controller = new AbortController();
    controllerRef.current = controller;
    runningRef.current = false;
    finishedRef.current = false;
    countdownStartedRef.current = false;
    readyRef.current = new Set();
    snapshotsRef.current = {};
    pendingRef.current = { "jev-a": false, "jev-b": false };
    lastDecisionRef.current = { "jev-a": 0, "jev-b": 0 };
    playersRef.current = [createPlayer("jev-a"), createPlayer("jev-b")];
    publish();
    setResult(null);
    setTimeLeft(60);
    setPhase("loading");
    setMatchId((current) => current + 1);
    setView("fight");
  }, [publish]);

  const backToLobby = useCallback(() => {
    controllerRef.current?.abort();
    if (clockRef.current) window.clearInterval(clockRef.current);
    runningRef.current = false;
    stopFrames();
    setView("landing");
    setPhase("idle");
    setResult(null);
  }, [stopFrames]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (clockRef.current) window.clearInterval(clockRef.current);
    },
    [],
  );

  const frameA = `/play/snake?agent=jev-a&seed=snake-a-${matchId}`;
  const frameB = `/play/snake?agent=jev-b&seed=snake-b-${matchId}`;

  return (
    <main className={`site snake-site view-${view}`}>
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
        <section className="snake-landing">
          <div className="snake-hero-copy">
            <span className="snake-hero-kicker">
              LIVE · DUAL BROWSER SPECTACLE
            </span>
            <h1>JevArena</h1>
            <p>
              Jev fights Jev in parallel universe.
              <br />
              Sixty seconds of live Snake.
            </p>
            <button
              className="snake-hero-fight"
              onClick={startFight}
              type="button"
            >
              <span>FIGHT</span>
              <small>START 60s MATCH</small>
              <b>↗</b>
            </button>
          </div>

          <div className="snake-hero-preview" aria-hidden="true">
            <div className="preview-browser preview-browser-a">
              <div className="preview-chrome">
                <span>
                  <i />
                  <i />
                  <i />
                </span>
                <em>arena.local/snake/a</em>
              </div>
              <div className="preview-agent">
                <AgentAvatar agentId="jev-a" size="small" />
                <strong>Jev</strong>
                <b>04</b>
              </div>
              <div className="preview-board">
                <i className="preview-food food-a" />
                <span className="preview-snake snake-a">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>

            <span className="preview-vs">VS</span>

            <div className="preview-browser preview-browser-b">
              <div className="preview-chrome">
                <span>
                  <i />
                  <i />
                  <i />
                </span>
                <em>arena.local/snake/b</em>
              </div>
              <div className="preview-agent">
                <AgentAvatar agentId="jev-b" size="small" />
                <strong>Jev in parallel universe</strong>
                <b>06</b>
              </div>
              <div className="preview-board">
                <i className="preview-food food-b" />
                <span className="preview-snake snake-b">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="snake-fight">
          <div className="snake-matchbar">
            <button onClick={backToLobby} type="button">
              ← Lobby
            </button>
            <div>
              <span>DUAL BROWSER MATCH</span>
              <h1>Snake</h1>
            </div>
            <div className="snake-clock">
              <span>{phase === "finished" ? "FINAL" : "TIME"}</span>
              <strong>00:{String(timeLeft).padStart(2, "0")}</strong>
            </div>
          </div>

          {result && (
            <div className="snake-result">
              <div>
                <span>MATCH RESULT</span>
                <strong>{result.label}</strong>
                <p>{result.detail}</p>
              </div>
              <button onClick={startFight} type="button">
                Rematch ↻
              </button>
            </div>
          )}

          <div className="snake-duel">
            <AgentPane player={players[0]} frameSrc={frameA} />
            <span className="snake-versus" aria-hidden="true">
              VS
            </span>
            <AgentPane player={players[1]} frameSrc={frameB} />
          </div>

          {(phase === "loading" || phase === "countdown") && (
            <div className="snake-countdown" aria-live="assertive">
              <span>{phase === "loading" ? "OPENING BROWSERS" : "READY"}</span>
              <strong>{phase === "loading" ? "••" : countdown}</strong>
            </div>
          )}
        </section>
      )}

      <footer className="site-footer">
        <span>TypeSafe System One</span>
        <a href="https://x.com/raihankhan_rk" rel="noreferrer" target="_blank">
          Built by <XIcon /> <b>@raihankhan_rk</b>
        </a>
        <a className="stats-link" href="/stats">
          stats
        </a>
      </footer>
    </main>
  );
}
