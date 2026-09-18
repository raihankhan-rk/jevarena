export type GameId = "whack-a-mole" | "memory-match";
export type PlayerId = "jev-a" | "jev-b";
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
  state: "active" | "face-down" | "revealed";
}

export interface AgentMemory {
  activeElementId?: string;
  revealedCards?: Array<{ id: string; symbol: string }>;
  seenCards?: Record<string, string>;
  goalsComplete?: boolean;
}

export interface AgentHistoryItem {
  step: number;
  operation: AgentOperation;
  targetId: string | null;
  outcome: string;
}

export interface AgentStepRequest {
  agent: "Jev A" | "Jev B";
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

export interface WhackState {
  score: number;
  misses: number;
  activeHole: number | null;
  hitHole: number | null;
}

export interface MemoryState {
  deck: string[];
  revealed: number[];
  matched: number[];
  seen: Record<string, string>;
  moves: number;
}

export interface PlayerRun {
  id: PlayerId;
  name: "Jev A" | "Jev B";
  status: "ready" | "thinking" | "acting" | "done" | "blocked";
  whack: WhackState;
  memory: MemoryState;
  history: StepTrace[];
  latestDecision: AgentDecision | null;
  pendingOutcome: string;
}

export interface MatchResult {
  winner: PlayerId | "draw";
  label: string;
  detail: string;
}
