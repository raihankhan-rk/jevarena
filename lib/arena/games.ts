import { legalDirections } from "@/lib/snake/engine";
import type {
  AgentStepRequest,
  Direction,
  ElementObservation,
  PlayerId,
  PlayerRun,
  SnakeSnapshot,
} from "./types";

const DIRECTION_LABELS: Record<Direction, string> = {
  up: "UP ↑",
  down: "DOWN ↓",
  left: "LEFT ←",
  right: "RIGHT →",
};

export function createPlayer(id: PlayerId): PlayerRun {
  return {
    id,
    name: id === "jev-a" ? "Jev" : "Jev in parallel universe",
    status: "loading",
    score: 0,
    alive: true,
    latestDecision: null,
    history: [],
  };
}

export function directionElements(
  snapshot: SnakeSnapshot,
): ElementObservation[] {
  const safe = new Set(snapshot.safeDirections);
  const offered = safe.size
    ? snapshot.safeDirections
    : legalDirections(snapshot.direction);

  return offered.map((direction, index) => ({
    id: `direction-${direction}`,
    index: index + 1,
    role: "button",
    label: `${DIRECTION_LABELS[direction]} — ${
      safe.has(direction) ? "safe next move" : "legal emergency move"
    }`,
    state: safe.has(direction) ? "safe" : "legal",
  }));
}

export function buildAgentRequest(
  snapshot: SnakeSnapshot,
  player: PlayerRun,
): AgentStepRequest {
  const head = snapshot.snake[0];
  return {
    agent: player.name,
    game: "snake",
    goal:
      "Keep the snake alive and eat food. Click one safe direction button that moves the head toward food without hitting a wall or the snake body.",
    page: {
      url: `/play/snake?agent=${player.id}`,
      title: `${player.name} — Snake`,
      visibleText: [
        `Score ${snapshot.score}. Tick ${snapshot.tick}.`,
        `Head at (${head.x}, ${head.y}).`,
        `Food at (${snapshot.food.x}, ${snapshot.food.y}).`,
        `Moving ${snapshot.direction}.`,
        `Safe directions: ${snapshot.safeDirections.join(", ") || "none"}.`,
        `Body: ${snapshot.snake
          .map((point) => `(${point.x},${point.y})`)
          .join(" ")}.`,
      ].join(" "),
    },
    elements: directionElements(snapshot),
    board: snapshot,
    history: player.history.slice(-8).map((item) => ({
      step: item.step,
      operation: item.operation,
      targetId: item.targetId,
      outcome: item.outcome,
    })),
  };
}
