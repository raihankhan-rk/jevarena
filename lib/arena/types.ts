export type PlayerId = "jev-a" | "jev-b";
export type PlayerName = "Jev" | "Jev in parallel universe";
export type Direction = "up" | "down" | "left" | "right";
export type AgentOperation = "CLICK" | "WAIT" | "BLOCKED";

export interface Point {
  x: number;
  y: number;
}

export interface SnakeSnapshot {
  agentId: PlayerId;
  gridSize: number;
  snake: Point[];
  food: Point;
  direction: Direction;
  safeDirections: Direction[];
  score: number;
  tick: number;
  alive: boolean;
}

export interface ElementObservation {
  id: `direction-${Direction}`;
  index: number;
  role: "button";
  label: string;
  state: "safe" | "legal";
}

export interface AgentStepRequest {
  agent: PlayerName;
  game: "snake";
  goal: string;
  page: {
    url: string;
    title: string;
    visibleText: string;
  };
  elements: ElementObservation[];
  board: SnakeSnapshot;
  history: Array<{
    step: number;
    operation: AgentOperation;
    targetId: string | null;
    outcome: string;
  }>;
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

export interface StepTrace {
  step: number;
  operation: AgentOperation;
  targetId: string | null;
  outcome: string;
  operationProbabilities: Record<string, number>;
  targetProbabilities: Record<string, number>;
  confidence: number;
  targetConfidence: number | null;
  latencyMs: number;
  model: string;
  source: "jev" | "demo";
}

export interface PlayerRun {
  id: PlayerId;
  name: PlayerName;
  status: "loading" | "ready" | "thinking" | "acting" | "done" | "blocked";
  score: number;
  alive: boolean;
  latestDecision: AgentDecision | null;
  history: StepTrace[];
}

export interface MatchResult {
  winner: PlayerId | "draw";
  label: string;
  detail: string;
}
