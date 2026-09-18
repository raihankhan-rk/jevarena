"use client";

import { GameFixture } from "@/components/game-fixtures";
import type { GameId, PlayerRun } from "@/lib/arena/types";

interface AgentPaneProps {
  game: GameId;
  player: PlayerRun;
  accent: "coral" | "teal";
  onAction: (player: PlayerRun["id"], targetId: string) => void;
}

function topProbabilities(values: Record<string, number>, limit = 3) {
  return Object.entries(values)
    .sort(([, first], [, second]) => second - first)
    .slice(0, limit);
}

function ProbabilityRows({
  title,
  values,
}: {
  title: string;
  values: Record<string, number>;
}) {
  const rows = topProbabilities(values);

  return (
    <div className="probability-group">
      <div className="probability-heading">
        <span>{title}</span>
        <span>p</span>
      </div>
      {rows.length ? (
        rows.map(([label, probability], index) => (
          <div className="probability-row" key={label}>
            <div className="probability-label">
              <span className={index === 0 ? "top-choice" : ""}>
                {label.replaceAll("-", " ").replaceAll("_", " ")}
              </span>
              <b>{Math.round(probability * 100)}%</b>
            </div>
            <span className="probability-track">
              <i style={{ width: `${Math.max(2, probability * 100)}%` }} />
            </span>
          </div>
        ))
      ) : (
        <div className="probability-empty">Awaiting first decision</div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: PlayerRun["status"] }) {
  return (
    <span className={`agent-status status-${status}`}>
      <i />
      {status}
    </span>
  );
}

export function AgentPane({ game, player, accent, onAction }: AgentPaneProps) {
  const decision = player.latestDecision;
  const latestTrace = player.history.at(-1);

  return (
    <article className={`agent-pane accent-${accent}`}>
      <header className="agent-pane-header">
        <div className="agent-identity">
          <span className="agent-avatar" aria-hidden="true">
            {player.name.at(-1)}
          </span>
          <div>
            <div className="agent-name-row">
              <h2>{player.name}</h2>
              <StatusDot status={player.status} />
            </div>
            <p>jev-latest · isolated state</p>
          </div>
        </div>
        <div className="agent-score">
          <span>{game === "whack-a-mole" ? "HITS" : "PAIRS"}</span>
          <strong>
            {game === "whack-a-mole"
              ? player.whack.score
              : player.memory.matched.length / 2}
          </strong>
        </div>
      </header>

      <div className="browser-shell">
        <div className="browser-chrome">
          <span className="browser-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <div className="browser-address">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.75 7V5.6a3.25 3.25 0 0 1 6.5 0V7M3.5 7h9v6.5h-9z" />
            </svg>
            arena.local/{game}
          </div>
          <span className="browser-live">
            <i />
            LIVE
          </span>
        </div>
        <GameFixture game={game} player={player} onAction={onAction} />
        <div className="dom-index-pill">
          <span>&lt;/&gt;</span> indexed DOM · click only
        </div>
      </div>

      <section className="decision-console" aria-label={`${player.name} decision telemetry`}>
        <div className="step-ticker">
          <div>
            <span>STEP</span>
            <strong>{String(player.history.length + (decision ? 1 : 0)).padStart(2, "0")}</strong>
          </div>
          <div>
            <span>OPERATION</span>
            <strong>{decision?.operation ?? "OBSERVE"}</strong>
          </div>
          <div>
            <span>TARGET</span>
            <strong>
              {decision?.targetId
                ? `[${decision.targetId.split("-").at(-1)}] ${decision.targetId
                    .split("-")[0]
                    .toUpperCase()}`
                : "—"}
            </strong>
          </div>
          <div>
            <span>CONF.</span>
            <strong>
              {decision ? `${Math.round(decision.confidence * 100)}%` : "—"}
            </strong>
          </div>
          <div>
            <span>LATENCY</span>
            <strong>{decision ? `${decision.latencyMs}ms` : "—"}</strong>
          </div>
        </div>

        <div className="probability-grid">
          <ProbabilityRows
            title="Operation head"
            values={decision?.operationProbabilities ?? {}}
          />
          <ProbabilityRows
            title="Target head"
            values={decision?.targetProbabilities ?? {}}
          />
        </div>

        <div className="console-footer">
          <span className={`source-chip source-${decision?.source ?? "waiting"}`}>
            {decision?.source === "jev"
              ? decision.model
              : decision?.source === "demo"
                ? "DEMO POLICY"
                : "MODEL READY"}
          </span>
          <p>
            {latestTrace?.outcome ??
              (player.status === "thinking"
                ? "Observing indexed controls…"
                : "Waiting for the bell.")}
          </p>
        </div>
      </section>
    </article>
  );
}
