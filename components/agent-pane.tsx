"use client";

import { AgentAvatar } from "@/components/agent-avatar";
import type { PlayerRun } from "@/lib/arena/types";

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
    <div className="snake-probability-group">
      <span className="snake-probability-title">{title}</span>
      {rows.length ? (
        rows.map(([label, probability]) => (
          <div className="snake-probability" key={label}>
            <span>
              {label.replace("direction-", "").replaceAll("_", " ")}
              <b>{Math.round(probability * 100)}%</b>
            </span>
            <i>
              <em style={{ width: `${Math.max(2, probability * 100)}%` }} />
            </i>
          </div>
        ))
      ) : (
        <small>Waiting for Jev…</small>
      )}
    </div>
  );
}

export function AgentPane({
  player,
  frameSrc,
}: {
  player: PlayerRun;
  frameSrc: string;
}) {
  const decision = player.latestDecision;
  const latest = player.history.at(-1);

  return (
    <article className={`snake-browser-pane pane-${player.id}`}>
      <header className="snake-agent-header">
        <div className={`snake-agent-id status-${player.status}`}>
          <AgentAvatar agentId={player.id} size="regular" />
          <div>
            <h2>{player.name}</h2>
            <span>
              <i />
              {player.status}
            </span>
          </div>
        </div>
        <div className="snake-score">
          <span>SCORE</span>
          <strong>{player.score}</strong>
        </div>
      </header>

      <div className="snake-browser-chrome">
        <span className="browser-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <div className="snake-address">
          arena.local/play/snake?agent={player.id}
        </div>
        <span className="browser-live">
          <i />
          LIVE
        </span>
      </div>

      <iframe
        allow="none"
        className="snake-frame"
        id={`snake-frame-${player.id}`}
        src={frameSrc}
        title={`${player.name} live Snake browser`}
      />

      <section className="snake-telemetry">
        <div className="snake-step-ticker">
          <div>
            <span>OP</span>
            <strong>{decision?.operation ?? "OBSERVE"}</strong>
          </div>
          <div>
            <span>TARGET</span>
            <strong>
              {decision?.targetId?.replace("direction-", "").toUpperCase() ??
                "—"}
            </strong>
          </div>
          <div>
            <span>LATENCY</span>
            <strong>{decision ? `${decision.latencyMs}ms` : "—"}</strong>
          </div>
          <div>
            <span>CONF.</span>
            <strong>
              {decision ? `${Math.round(decision.confidence * 100)}%` : "—"}
            </strong>
          </div>
        </div>
        <div className="snake-probability-grid">
          <ProbabilityRows
            title="Operation"
            values={decision?.operationProbabilities ?? {}}
          />
          <ProbabilityRows
            title="Direction"
            values={decision?.targetProbabilities ?? {}}
          />
        </div>
        <div className="snake-event-line">
          <span>{decision?.source === "jev" ? decision.model : "DEMO"}</span>
          <p>{latest?.outcome ?? "Browser ready."}</p>
        </div>
      </section>
    </article>
  );
}
