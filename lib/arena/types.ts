export type GameId =
  | "memory-match"
  | "2048"
  | "treasure-hunt";
export type PlayerId = "jev-a" | "jev-b";
export type PlayerName = "Jev" | "Jev in parallel universe";
export type Direction = "up" | "down" | "left" | "right";
export type AgentOperation =
  | "CLICK"
  | "SCROLL"
  | "WAIT"
  | "DONE"
  | "BLOCKED";

export interface ElementObservation {
  id: string;
  index: number;
  role: "button";
  label: string;
  state: "active" | "face-down" | "revealed" | "available" | "hidden";
}

export interface AgentMemory {
  activeElementId?: string;
  revealedCards?: Array<{ id: string; symbol: string }>;
  seenCards?: Record<string, string>;
  board?: number[];
  availableDirections?: Direction[];
  score?: number;
  movesRemaining?: number;
  revealedCells?: number[];
  treasuresFound?: number;
  goalsComplete?: boolean;
}

export interface AgentHistoryItem {
  step: number;
  operation: AgentOperation;
  targetId: string | null;
  outcome: string;
}

export interface AgentStepRequest {
  agent: PlayerName;
  game: GameId;
  goal: string;
  page: {
    url: string;
    title: string;
    visibleText: string;
  };
  elements: ElementObservation[];
  memory: AgentMemory;
  history: AgentHistoryItem[];
}

export interface AgentDecision {
  operation: AgentOperation;
  targetId: string | null;
  operationProbabilities: Record<string, number>;
  targetProbabilities: Record<string, number>;
  confidence: number;
  targetConfidence: number | null;
  latencyMs: number;
  model: string;
  source: "jev" | "demo";
  blockedReason?: string;
}

export interface StepTrace extends AgentHistoryItem {
  operationProbabilities: Record<string, number>;
  targetProbabilities: Record<string, number>;
  confidence: number;
  targetConfidence: number | null;
  latencyMs: number;
  model: string;
  source: "jev" | "demo";
}

export interface MemoryState {
  deck: string[];
  revealed: number[];
  matched: number[];
  seen: Record<string, string>;
  moves: number;
  flips: number;
}

export interface Game2048State {
  board: number[];
  score: number;
  steps: number;
  spawnCursor: number;
  lastMoved: Direction | null;
}

export interface TreasureState {
  treasures: number[];
  revealed: number[];
  found: number;
  clicks: number;
  lastCell: number | null;
}

export interface PlayerRun {
  id: PlayerId;
  name: PlayerName;
  status: "ready" | "thinking" | "acting" | "done" | "blocked";
  memory: MemoryState;
  game2048: Game2048State;
  treasure: TreasureState;
  history: StepTrace[];
  latestDecision: AgentDecision | null;
  pendingOutcome: string;
}

export interface MatchResult {
  winner: PlayerId | "draw";
  label: string;
  detail: string;
}
