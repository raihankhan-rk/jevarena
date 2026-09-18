import type {
  AgentStepRequest,
  ElementObservation,
  GameId,
  PlayerId,
  PlayerRun,
  SharedRaceState,
} from "./types";

export const GAME_COPY: Record<
  GameId,
  {
    label: string;
    eyebrow: string;
    rule: string;
  }
> = {
  "treasure-hunt": {
    label: "Treasure Hunt",
    eyebrow: "Hidden race",
    rule: "One shared grid · first to 3 of 5 treasures wins",
  },
  "claim-race": {
    label: "Claim Race",
    eyebrow: "Grid race",
    rule: "One shared grid · most cells after every claim wins",
  },
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

export function createTreasureCells(seed: string, count = 5) {
  const random = mulberry32(hashSeed(`${seed}:treasures`));
  const cells = Array.from({ length: 25 }, (_, index) => index);
  for (let index = cells.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [cells[index], cells[swapIndex]] = [cells[swapIndex], cells[index]];
  }
  return cells.slice(0, count).sort((first, second) => first - second);
}

export function createPlayer(id: PlayerId): PlayerRun {
  return {
    id,
    name: id === "jev-a" ? "Jev" : "Jev in parallel universe",
    status: "ready",
    history: [],
    latestDecision: null,
    pendingOutcome: "",
  };
}

export function createSharedRace(game: GameId, seed: string): SharedRaceState {
  return {
    game,
    seed,
    round: 0,
    treasures: game === "treasure-hunt" ? createTreasureCells(seed) : [],
    revealed: [],
    treasureOwners: {},
    claimOwners: Array<PlayerId | null>(25).fill(null),
    scores: { "jev-a": 0, "jev-b": 0 },
    attempts: { "jev-a": 0, "jev-b": 0 },
    lastCell: null,
    collisionCell: null,
  };
}

export function availableCellIndices(state: SharedRaceState) {
  if (state.game === "treasure-hunt") {
    const revealed = new Set(state.revealed);
    return Array.from({ length: 25 }, (_, index) => index).filter(
      (index) => !revealed.has(index),
    );
  }
  return state.claimOwners.flatMap((owner, index) =>
    owner === null ? [index] : [],
  );
}

export function raceElements(state: SharedRaceState) {
  return availableCellIndices(state).map(
    (index): ElementObservation => ({
      id: `cell-${index + 1}`,
      index: index + 1,
      role: "button",
      label:
        state.game === "treasure-hunt"
          ? `Unrevealed shared grid cell ${index + 1}`
          : `Unclaimed shared grid cell ${index + 1}, worth one point`,
      state: state.game === "treasure-hunt" ? "hidden" : "available",
    }),
  );
}

function claimedCells(state: SharedRaceState, players: PlayerRun[]) {
  if (state.game === "treasure-hunt") {
    return Object.fromEntries(
      Object.entries(state.treasureOwners).map(([cell, owner]) => [
        `cell-${Number(cell) + 1}`,
        players.find((player) => player.id === owner)?.name ?? "Jev",
      ]),
    );
  }
  return Object.fromEntries(
    state.claimOwners.flatMap((owner, index) =>
      owner
        ? [
            [
              `cell-${index + 1}`,
              players.find((player) => player.id === owner)?.name ?? "Jev",
            ],
          ]
        : [],
    ),
  );
}

export function buildAgentRequest(
  state: SharedRaceState,
  player: PlayerRun,
  players: PlayerRun[],
): AgentStepRequest {
  const elements = raceElements(state);
  const first = players[0];
  const second = players[1];
  const scoreText = `${first.name}: ${state.scores[first.id]}, ${second.name}: ${
    state.scores[second.id]
  }`;
  const visibleText =
    state.game === "treasure-hunt"
      ? [
          "Shared Treasure Hunt board.",
          `${state.revealed.length} of 25 cells are revealed.`,
          `${scoreText} treasures.`,
          `Revealed empty cells: ${state.revealed
            .filter((cell) => !state.treasures.includes(cell))
            .map((cell) => cell + 1)
            .join(", ") || "none"}.`,
          "Treasure positions in unrevealed cells are unknown.",
        ].join(" ")
      : [
          "Shared Claim Race board.",
          `${state.claimOwners.filter(Boolean).length} of 25 cells are claimed.`,
          `${scoreText} cells.`,
          "Every unclaimed cell is worth one point.",
        ].join(" ");

  return {
    agent: player.name,
    game: state.game,
    goal:
      state.game === "treasure-hunt"
        ? "Race the other Jev to find a majority: click one unrevealed shared cell. Keep exploring; hidden cells are actionable."
        : "Claim one currently unclaimed shared cell before the other Jev. Every offered cell is worth one point.",
    page: {
      url: `/fixtures/${state.game}?world=shared`,
      title: GAME_COPY[state.game].label,
      visibleText,
    },
    elements,
    memory: {
      round: state.round,
      revealedCells: [...state.revealed],
      claimedCells: claimedCells(state, players),
      scores: {
        [first.name]: state.scores[first.id],
        [second.name]: state.scores[second.id],
      },
      treasuresFound:
        state.game === "treasure-hunt" ? state.scores[player.id] : undefined,
      goalsComplete:
        state.game === "treasure-hunt"
          ? state.scores[player.id] >= 3
          : elements.length === 0,
    },
    history: player.history.slice(-10).map((item) => ({
      step: item.step,
      operation: item.operation,
      targetId: item.targetId,
      outcome: item.outcome,
    })),
  };
}
