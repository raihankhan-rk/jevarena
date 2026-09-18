import type {
  AgentStepRequest,
  ElementObservation,
  GameId,
  MemoryState,
  PlayerRun,
} from "./types";

export const GAME_COPY: Record<
  GameId,
  {
    label: string;
    eyebrow: string;
    description: string;
    rule: string;
    duration: string;
  }
> = {
  "whack-a-mole": {
    label: "Whack-a-Mole",
    eyebrow: "Reflex trial",
    description: "Spot the live target before it drops.",
    rule: "18 shared spawns · highest hit count wins",
    duration: "≈ 20 sec",
  },
  "memory-match": {
    label: "Memory Match",
    eyebrow: "Recall trial",
    description: "Remember every reveal and clear six pairs.",
    rule: "Same shuffled deck · first clear wins",
    duration: "≈ 35 sec",
  },
};

const MEMORY_SYMBOLS = ["Comet", "Bolt", "Crown", "Flame", "Gem", "Orbit"];

export const MEMORY_GLYPHS: Record<string, string> = {
  Comet: "✦",
  Bolt: "ϟ",
  Crown: "♛",
  Flame: "◒",
  Gem: "◆",
  Orbit: "◎",
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

export function createWhackSequence(seed: string, rounds = 18) {
  const random = mulberry32(hashSeed(seed));
  const sequence: number[] = [];

  while (sequence.length < rounds) {
    const next = Math.floor(random() * 9);
    if (next !== sequence.at(-1)) sequence.push(next);
  }

  return sequence;
}

export function createMemoryDeck(seed: string) {
  const random = mulberry32(hashSeed(seed));
  const deck = [...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

export function createPlayer(
  id: PlayerRun["id"],
  deck: string[],
): PlayerRun {
  return {
    id,
    name: id === "jev-a" ? "Jev A" : "Jev B",
    status: "ready",
    whack: { score: 0, misses: 0, activeHole: null, hitHole: null },
    memory: {
      deck: [...deck],
      revealed: [],
      matched: [],
      seen: {},
      moves: 0,
    },
    history: [],
    latestDecision: null,
    pendingOutcome: "",
  };
}

export function whackElements(activeHole: number | null) {
  return Array.from({ length: 9 }, (_, index): ElementObservation => {
    const isActive = activeHole === index;
    return {
      id: `hole-${index + 1}`,
      index: index + 1,
      role: "button",
      label: isActive
        ? `Hole ${index + 1}: LIVE MOLE — click now`
        : `Hole ${index + 1}: empty`,
      state: isActive ? "active" : "face-down",
    };
  });
}

export function memoryElements(state: MemoryState) {
  return state.deck.flatMap((symbol, index): ElementObservation[] => {
    if (state.matched.includes(index) || state.revealed.includes(index)) return [];
    return [
      {
        id: `card-${index + 1}`,
        index: index + 1,
        role: "button",
        label: `Card ${index + 1}: face down`,
        state: "face-down",
      },
    ];
  });
}

export function buildAgentRequest(
  game: GameId,
  player: PlayerRun,
): AgentStepRequest {
  const isWhack = game === "whack-a-mole";
  const elements = isWhack
    ? whackElements(player.whack.activeHole)
    : memoryElements(player.memory);
  const revealedCards = player.memory.revealed.map((index) => ({
    id: `card-${index + 1}`,
    symbol: player.memory.deck[index],
  }));
  const visibleText = isWhack
    ? [
        "Whack-a-Mole arena.",
        `Score: ${player.whack.score}. Misses: ${player.whack.misses}.`,
        player.whack.activeHole === null
          ? "Waiting for the next mole."
          : `A live mole is visible in hole ${player.whack.activeHole + 1}.`,
      ].join(" ")
    : [
        "Memory Match arena.",
        `${player.memory.matched.length / 2} of 6 pairs matched.`,
        revealedCards.length
          ? `Currently revealed: ${revealedCards
              .map((card) => `${card.id} shows ${card.symbol}`)
              .join(", ")}.`
          : "No cards are currently revealed.",
      ].join(" ");

  return {
    agent: player.name,
    game,
    goal: isWhack
      ? "Click the single LIVE MOLE. Never click an empty hole."
      : "Clear the board by clicking face-down cards in matching pairs. Use observed card memory.",
    page: {
      url: `/fixtures/${game}?player=${player.id}`,
      title: GAME_COPY[game].label,
      visibleText,
    },
    elements,
    memory: isWhack
      ? {
          activeElementId:
            player.whack.activeHole === null
              ? undefined
              : `hole-${player.whack.activeHole + 1}`,
        }
      : {
          revealedCards,
          seenCards: { ...player.memory.seen },
          goalsComplete: player.memory.matched.length === player.memory.deck.length,
        },
    history: player.history.slice(-10).map((item) => ({
      step: item.step,
      operation: item.operation,
      targetId: item.targetId,
      outcome: item.outcome,
    })),
  };
}
