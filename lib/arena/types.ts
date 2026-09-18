export type GameId = "treasure-hunt" | "claim-race";
export type PlayerId = "jev-a" | "jev-b";
export type PlayerName = "Jev" | "Jev in parallel universe";
export type AgentOperation = "CLICK" | "BLOCKED";

export interface ElementObservation {
  id: string;
  index: number;
  role: "button";
  label: string;
  state: "hidden" | "available";
}

export interface AgentMemory {
  round: number;
  revealedCells: number[];
  claimedCells: Record<string, PlayerName>;
  scores: Record<PlayerName, number>;
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

export interface PlayerRun {
  id: PlayerId;
  name: PlayerName;
  status: "ready" | "thinking" | "acting" | "done" | "blocked";
  history: StepTrace[];
  latestDecision: AgentDecision | null;
  pendingOutcome: string;
}

export interface SharedRaceState {
  game: GameId;
  seed: string;
  round: number;
  treasures: number[];
  revealed: number[];
  treasureOwners: Partial<Record<number, PlayerId>>;
  claimOwners: Array<PlayerId | null>;
  scores: Record<PlayerId, number>;
  attempts: Record<PlayerId, number>;
  lastCell: number | null;
  collisionCell: number | null;
}

export interface MatchResult {
  winner: PlayerId | "draw";
  label: string;
  detail: string;
}
