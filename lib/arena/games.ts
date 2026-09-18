import type {
  AgentStepRequest,
  Direction,
  ElementObservation,
  Game2048State,
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
  "memory-match": {
    label: "Memory Match",
    eyebrow: "Recall trial",
    description: "Remember every reveal and clear six pairs.",
    rule: "Same shuffled deck · first clear wins",
    duration: "≈ 35 sec",
  },
  "2048": {
    label: "2048",
    eyebrow: "Strategy trial",
    description: "Merge tiles with four indexed direction buttons.",
    rule: "24 moves · highest score wins",
    duration: "≈ 30 sec",
  },
  "treasure-hunt": {
    label: "Treasure Hunt",
    eyebrow: "Search trial",
    description: "Reveal the grid and find three hidden treasures.",
    rule: "First to find all 3 treasures wins",
    duration: "≈ 30 sec",
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

export function createMemoryDeck(seed: string) {
  const random = mulberry32(hashSeed(seed));
  const deck = [...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

export function create2048Board(seed: string) {
  let board = Array<number>(16).fill(0);
  board = add2048Tile(board, seed, 0);
  board = add2048Tile(board, seed, 1);
  return board;
}

export function createTreasureCells(seed: string, count = 3) {
  const random = mulberry32(hashSeed(`${seed}:treasures`));
  const cells = Array.from({ length: 25 }, (_, index) => index);
  for (let index = cells.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [cells[index], cells[swapIndex]] = [cells[swapIndex], cells[index]];
  }
  return cells.slice(0, count).sort((first, second) => first - second);
}

function lineIndices(direction: Direction, line: number) {
  if (direction === "left") return [0, 1, 2, 3].map((col) => line * 4 + col);
  if (direction === "right") return [3, 2, 1, 0].map((col) => line * 4 + col);
  if (direction === "up") return [0, 1, 2, 3].map((row) => row * 4 + line);
  return [3, 2, 1, 0].map((row) => row * 4 + line);
}

export function move2048(board: number[], direction: Direction) {
  const next = [...board];
  let scoreGain = 0;

  for (let line = 0; line < 4; line += 1) {
    const indices = lineIndices(direction, line);
    const values = indices.map((index) => board[index]).filter(Boolean);
    const merged: number[] = [];
    for (let index = 0; index < values.length; index += 1) {
      if (values[index] === values[index + 1]) {
        const value = values[index] * 2;
        merged.push(value);
        scoreGain += value;
        index += 1;
      } else {
        merged.push(values[index]);
      }
    }
    const lineValues = [...merged, ...Array(4 - merged.length).fill(0)];
    indices.forEach((index, offset) => {
      next[index] = lineValues[offset];
    });
  }

  return {
    board: next,
    scoreGain,
    changed: next.some((value, index) => value !== board[index]),
  };
}

export function add2048Tile(board: number[], seed: string, cursor: number) {
  const empty = board.flatMap((value, index) => (value === 0 ? [index] : []));
  if (!empty.length) return [...board];
  const random = mulberry32(hashSeed(`${seed}:spawn:${cursor}`));
  const index = empty[Math.floor(random() * empty.length)];
  const next = [...board];
  next[index] = random() < 0.9 ? 2 : 4;
  return next;
}

export function available2048Directions(board: number[]) {
  return (["up", "down", "left", "right"] as Direction[]).filter(
    (direction) => move2048(board, direction).changed,
  );
}

export function createPlayer(
  id: PlayerRun["id"],
  seed: string,
): PlayerRun {
  return {
    id,
    name: id === "jev-a" ? "Jev" : "Jev in parallel universe",
    status: "ready",
    memory: {
      deck: createMemoryDeck(seed),
      revealed: [],
      matched: [],
      seen: {},
      moves: 0,
      flips: 0,
    },
    game2048: {
      board: create2048Board(seed),
      score: 0,
      steps: 0,
      spawnCursor: 2,
      lastMoved: null,
    },
    treasure: {
      treasures: createTreasureCells(seed),
      revealed: [],
      found: 0,
      clicks: 0,
      lastCell: null,
    },
    history: [],
    latestDecision: null,
    pendingOutcome: "",
  };
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

export function game2048Elements(state: Game2048State) {
  const available = new Set(available2048Directions(state.board));
  const labels: Record<Direction, string> = {
    up: "Move tiles up ↑",
    down: "Move tiles down ↓",
    left: "Move tiles left ←",
    right: "Move tiles right →",
  };
  return (["up", "down", "left", "right"] as Direction[]).map(
    (direction, index): ElementObservation => ({
      id: `move-${direction}`,
      index: index + 1,
      role: "button",
      label: `${labels[direction]} — ${
        available.has(direction) ? "available" : "no tiles would move"
      }`,
      state: available.has(direction) ? "available" : "revealed",
    }),
  );
}

export function treasureElements(state: PlayerRun["treasure"]) {
  return Array.from({ length: 25 }, (_, index) => index).flatMap(
    (index): ElementObservation[] =>
      state.revealed.includes(index)
        ? []
        : [
            {
              id: `cell-${index + 1}`,
              index: index + 1,
              role: "button",
              label: `Hidden grid cell ${index + 1}`,
              state: "hidden",
            },
          ],
  );
}

export function buildAgentRequest(
  game: GameId,
  player: PlayerRun,
): AgentStepRequest {
  const elements =
    game === "memory-match"
      ? memoryElements(player.memory)
      : game === "2048"
        ? game2048Elements(player.game2048)
        : treasureElements(player.treasure);
  const revealedCards = player.memory.revealed.map((index) => ({
    id: `card-${index + 1}`,
    symbol: player.memory.deck[index],
  }));
  const visibleText =
    game === "memory-match"
      ? [
          "Memory Match arena.",
          `${player.memory.matched.length / 2} of 6 pairs matched.`,
          `Matched card IDs: ${
            player.memory.matched.map((index) => `card-${index + 1}`).join(", ") ||
            "none"
          }.`,
          revealedCards.length
            ? `Currently face-up: ${revealedCards
                .map((card) => `${card.id} shows ${card.symbol}`)
                .join(", ")}.`
            : "No cards are currently face-up.",
          `Previously seen symbols: ${
            Object.entries(player.memory.seen)
              .map(([id, symbol]) => `${id}=${symbol}`)
              .join(", ") || "none"
          }.`,
        ].join(" ")
      : game === "2048"
        ? `2048 board, row major: ${player.game2048.board.join(", ")}. Score ${
            player.game2048.score
          }. ${24 - player.game2048.steps} moves remain.`
        : `Treasure Hunt grid. Revealed cells: ${
            player.treasure.revealed.join(", ") || "none"
          }. ${player.treasure.found} of 3 treasures found.`;

  const goals: Record<GameId, string> = {
    "memory-match":
      "Keep clicking available face-down cards until all six pairs are matched. If one card is face-up, click its known matching symbol when available; otherwise reveal an unseen card. Never stop after one pair attempt.",
    "2048":
      "Use one direction button to maximize 2048 merge score within 24 moves. Prefer moves that merge tiles and preserve space.",
    "treasure-hunt":
      "Reveal hidden grid cells and find all three treasures in as few clicks as possible.",
  };

  const memory =
    game === "memory-match"
      ? {
          revealedCards,
          seenCards: { ...player.memory.seen },
          goalsComplete:
            player.memory.matched.length === player.memory.deck.length,
        }
      : game === "2048"
        ? {
            board: [...player.game2048.board],
            availableDirections: available2048Directions(
              player.game2048.board,
            ),
            score: player.game2048.score,
            movesRemaining: 24 - player.game2048.steps,
            goalsComplete:
              player.game2048.steps >= 24 ||
              Math.max(...player.game2048.board) >= 2048,
          }
        : {
            revealedCells: [...player.treasure.revealed],
            treasuresFound: player.treasure.found,
            goalsComplete: player.treasure.found >= 3,
          };

  return {
    agent: player.name,
    game,
    goal: goals[game],
    page: {
      url: `/fixtures/${game}?player=${player.id}`,
      title: GAME_COPY[game].label,
      visibleText,
    },
    elements,
    memory,
    history: player.history.slice(-10).map((item) => ({
      step: item.step,
      operation: item.operation,
      targetId: item.targetId,
      outcome: item.outcome,
    })),
  };
}
