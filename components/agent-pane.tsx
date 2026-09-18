"use client";

import type { PlayerRun } from "@/lib/arena/types";

interface AgentPaneProps {
  player: PlayerRun;
  score: number;
  scoreLabel: string;
  accent: "coral" | "teal";
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
        <div className="probability-empty">Awaiting decision</div>
      )}
    </div>
  );
}

export function AgentPane({
  player,
  score,
  scoreLabel,
  accent,
}: AgentPaneProps) {
  const decision = player.latestDecision;
  const latestTrace = player.history.at(-1);

  return (
    <article className={`race-agent agent-pane accent-${accent}`}>
      <header className="agent-pane-header">
        <div className="agent-identity">
          <span className="agent-avatar" aria-hidden="true">
            {player.id === "jev-a" ? "J" : "J′"}
          </span>
          <div>
            <div className="agent-name-row">
              <h2>{player.name}</h2>
              <span className={`agent-status status-${player.status}`}>
                <i />
                {player.status}
              </span>
            </div>
            <p>jev-latest</p>
          </div>
        </div>
        <div className="agent-score">
          <span>{scoreLabel}</span>
          <strong>{score}</strong>
        </div>
      </header>

      <section
        className="decision-console"
        aria-label={`${player.name} decision telemetry`}
      >
        <div className="step-ticker">
          <div>
            <span>STEP</span>
            <strong>{String(player.history.length).padStart(2, "0")}</strong>
          </div>
          <div>
            <span>OPERATION</span>
            <strong>{decision?.operation ?? "OBSERVE"}</strong>
          </div>
          <div>
            <span>TARGET</span>
            <strong>
              {decision?.targetId
                ? `[${decision.targetId.split("-").at(-1)}] CELL`
                : "—"}
            </strong>
          </div>
          <div>
            <span>LATENCY</span>
            <strong>{decision ? `${decision.latencyMs}ms` : "—"}</strong>
          </div>
          <div>
            <span>CONFIDENCE</span>
            <strong>
              {decision ? `${Math.round(decision.confidence * 100)}%` : "—"}
            </strong>
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
                ? "Choosing from the shared board…"
                : "Waiting for the race.")}
          </p>
        </div>
      </section>
    </article>
  );
}
