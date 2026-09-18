"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AgentAvatar } from "@/components/agent-avatar";
import {
  createSnakeEngine,
  setDirection,
  tickSnake,
  toSnapshot,
  type SnakeEngineState,
} from "@/lib/snake/engine";
import type { Direction, PlayerId } from "@/lib/arena/types";

const TICK_MS = 230;

const CONTROLS: Array<{
  direction: Direction;
  glyph: string;
  label: string;
}> = [
  { direction: "up", glyph: "↑", label: "Up" },
  { direction: "left", glyph: "←", label: "Left" },
  { direction: "down", glyph: "↓", label: "Down" },
  { direction: "right", glyph: "→", label: "Right" },
];

export function SnakeGame({
  agentId,
  seed,
}: {
  agentId: PlayerId;
  seed: string;
}) {
  const engineRef = useRef<SnakeEngineState>(
    createSnakeEngine(seed, agentId),
  );
  const runningRef = useRef(false);
  const flashTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [snapshot, setSnapshot] = useState(() =>
    toSnapshot(engineRef.current),
  );
  const [flashDirection, setFlashDirection] = useState<Direction | null>(null);

  const postState = useCallback((type: "snake-ready" | "snake-state" | "snake-crash") => {
    window.parent.postMessage(
      { type, agentId, state: toSnapshot(engineRef.current) },
      window.location.origin,
    );
  }, [agentId]);

  const chooseDirection = useCallback(
    (direction: Direction) => {
      if (!engineRef.current.alive) return;
      engineRef.current = setDirection(engineRef.current, direction);
      setSnapshot(toSnapshot(engineRef.current));
      setFlashDirection(direction);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(
        () => setFlashDirection(null),
        210,
      );
      window.parent.postMessage(
        { type: "snake-move", agentId, direction },
        window.location.origin,
      );
    },
    [agentId],
  );

  useEffect(() => {
    postState("snake-ready");
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data as {
        type?: string;
        direction?: Direction;
      };
      if (message.type === "snake-start") {
        runningRef.current = true;
      } else if (message.type === "snake-stop") {
        runningRef.current = false;
      } else if (
        message.type === "snake-direction" &&
        message.direction
      ) {
        document
          .getElementById(`snake-${agentId}-${message.direction}`)
          ?.click();
      }
    };
    window.addEventListener("message", onMessage);

    const interval = window.setInterval(() => {
      if (!runningRef.current) {
        postState("snake-ready");
        return;
      }
      if (!engineRef.current.alive) return;
      engineRef.current = tickSnake(engineRef.current);
      const next = toSnapshot(engineRef.current);
      setSnapshot(next);
      postState(next.alive ? "snake-state" : "snake-crash");
      if (!next.alive) runningRef.current = false;
    }, TICK_MS);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(interval);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, [agentId, postState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const size = canvas.width;
    const cell = size / snapshot.gridSize;

    context.clearRect(0, 0, size, size);
    context.fillStyle = "#dce8dc";
    context.fillRect(0, 0, size, size);
    context.strokeStyle = "rgba(16, 45, 43, 0.07)";
    context.lineWidth = 1;
    for (let index = 1; index < snapshot.gridSize; index += 1) {
      const point = index * cell;
      context.beginPath();
      context.moveTo(point, 0);
      context.lineTo(point, size);
      context.stroke();
      context.beginPath();
      context.moveTo(0, point);
      context.lineTo(size, point);
      context.stroke();
    }

    const foodX = (snapshot.food.x + 0.5) * cell;
    const foodY = (snapshot.food.y + 0.5) * cell;
    context.fillStyle = "#f0aa36";
    context.beginPath();
    context.arc(foodX, foodY, cell * 0.31, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff5d7";
    context.beginPath();
    context.arc(foodX - cell * 0.09, foodY - cell * 0.1, cell * 0.08, 0, Math.PI * 2);
    context.fill();

    const snakeColor = agentId === "jev-a" ? "#e96850" : "#197d73";
    snapshot.snake.forEach((segment, index) => {
      const inset = index === 0 ? cell * 0.08 : cell * 0.13;
      context.fillStyle = snakeColor;
      context.beginPath();
      context.roundRect(
        segment.x * cell + inset,
        segment.y * cell + inset,
        cell - inset * 2,
        cell - inset * 2,
        cell * 0.22,
      );
      context.fill();
      if (index === 0) {
        context.fillStyle = "#fffdf5";
        context.beginPath();
        context.arc(
          segment.x * cell + cell * 0.38,
          segment.y * cell + cell * 0.38,
          cell * 0.07,
          0,
          Math.PI * 2,
        );
        context.arc(
          segment.x * cell + cell * 0.65,
          segment.y * cell + cell * 0.38,
          cell * 0.07,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    });
  }, [agentId, snapshot]);

  const safe = new Set(snapshot.safeDirections);

  return (
    <main className={`snake-page snake-page-${agentId}`}>
      <div className="snake-hud">
        <span>SCORE</span>
        <strong>{snapshot.score}</strong>
        <i>{snapshot.alive ? "LIVE" : "CRASHED"}</i>
      </div>
      <div className="snake-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={432}
          height={432}
          aria-label={`${agentId} Snake board`}
        />
        {flashDirection && (
          <span className="avatar-move-flash">
            <AgentAvatar agentId={agentId} size="small" />
            <b>{flashDirection.toUpperCase()}</b>
          </span>
        )}
        {!snapshot.alive && <div className="snake-crashed">CRASHED</div>}
      </div>
      <div className="snake-controls" aria-label="Clickable direction controls">
        {CONTROLS.map(({ direction, glyph, label }, index) => (
          <button
            aria-label={`Move ${label.toLowerCase()}`}
            className={`snake-direction direction-${direction}${
              flashDirection === direction ? " is-clicked" : ""
            }`}
            data-element-id={`direction-${direction}`}
            data-index={index + 1}
            disabled={!safe.has(direction)}
            id={`snake-${agentId}-${direction}`}
            key={direction}
            onClick={() => chooseDirection(direction)}
            type="button"
          >
            <span>{glyph}</span>
            <small>{label}</small>
            {flashDirection === direction && (
              <AgentAvatar agentId={agentId} size="small" />
            )}
          </button>
        ))}
      </div>
    </main>
  );
}
