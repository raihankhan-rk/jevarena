import type {
  Direction,
  PlayerId,
  Point,
  SnakeSnapshot,
} from "@/lib/arena/types";

export const GRID_SIZE = 18;

export interface SnakeEngineState extends SnakeSnapshot {
  seed: string;
  foodCursor: number;
}

export const DIRECTION_VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pointKey(point: Point) {
  return `${point.x}:${point.y}`;
}

function nextHead(head: Point, direction: Direction) {
  const vector = DIRECTION_VECTORS[direction];
  return { x: head.x + vector.x, y: head.y + vector.y };
}

function collides(point: Point, snake: Point[]) {
  return (
    point.x < 0 ||
    point.y < 0 ||
    point.x >= GRID_SIZE ||
    point.y >= GRID_SIZE ||
    snake.some((segment) => segment.x === point.x && segment.y === point.y)
  );
}

function spawnFood(seed: string, cursor: number, snake: Point[]) {
  const occupied = new Set(snake.map(pointKey));
  const empty = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => ({
    x: index % GRID_SIZE,
    y: Math.floor(index / GRID_SIZE),
  })).filter((point) => !occupied.has(pointKey(point)));
  const random = mulberry32(hashSeed(`${seed}:food:${cursor}`));
  return empty[Math.floor(random() * empty.length)] ?? { x: 1, y: 1 };
}

export function legalDirections(direction: Direction) {
  return (["up", "down", "left", "right"] as Direction[]).filter(
    (candidate) => candidate !== OPPOSITE[direction],
  );
}

export function safeDirections(state: Pick<SnakeSnapshot, "snake" | "direction">) {
  const head = state.snake[0];
  return legalDirections(state.direction).filter(
    (direction) => !collides(nextHead(head, direction), state.snake),
  );
}

export function createSnakeEngine(
  seed: string,
  agentId: PlayerId,
): SnakeEngineState {
  const snake = [
    { x: 8, y: 9 },
    { x: 7, y: 9 },
    { x: 6, y: 9 },
  ];
  const state: SnakeEngineState = {
    agentId,
    gridSize: GRID_SIZE,
    snake,
    food: spawnFood(seed, 0, snake),
    direction: "right",
    safeDirections: ["up", "down", "right"],
    score: 0,
    tick: 0,
    alive: true,
    seed,
    foodCursor: 1,
  };
  return { ...state, safeDirections: safeDirections(state) };
}

export function setDirection(
  state: SnakeEngineState,
  direction: Direction,
): SnakeEngineState {
  if (!state.alive || !legalDirections(state.direction).includes(direction)) {
    return state;
  }
  const next = { ...state, direction };
  return { ...next, safeDirections: safeDirections(next) };
}

export function tickSnake(state: SnakeEngineState): SnakeEngineState {
  if (!state.alive) return state;
  const head = nextHead(state.snake[0], state.direction);
  if (collides(head, state.snake)) {
    return {
      ...state,
      alive: false,
      tick: state.tick + 1,
      safeDirections: [],
    };
  }

  const ate = head.x === state.food.x && head.y === state.food.y;
  const snake = [head, ...state.snake];
  if (!ate) snake.pop();
  const foodCursor = ate ? state.foodCursor + 1 : state.foodCursor;
  const next: SnakeEngineState = {
    ...state,
    snake,
    food: ate
      ? spawnFood(state.seed, state.foodCursor, snake)
      : state.food,
    foodCursor,
    score: state.score + (ate ? 1 : 0),
    tick: state.tick + 1,
  };
  return { ...next, safeDirections: safeDirections(next) };
}

export function toSnapshot(state: SnakeEngineState): SnakeSnapshot {
  return {
    agentId: state.agentId,
    gridSize: state.gridSize,
    snake: state.snake.map((point) => ({ ...point })),
    food: { ...state.food },
    direction: state.direction,
    safeDirections: [...state.safeDirections],
    score: state.score,
    tick: state.tick,
    alive: state.alive,
  };
}
