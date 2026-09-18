"use client";

import { MEMORY_GLYPHS } from "@/lib/arena/games";
import type { GameId, PlayerRun } from "@/lib/arena/types";

interface GameFixtureProps {
  game: GameId;
  player: PlayerRun;
  onAction: (player: PlayerRun["id"], targetId: string) => void;
}

function MemoryFixture({ player, onAction }: Omit<GameFixtureProps, "game">) {
  const matchedPairs = player.memory.matched.length / 2;

  return (
    <div className="memory-fixture" aria-label={`${player.name} Memory Match fixture`}>
      <div className="memory-topline">
        <span>PAIR MEMORY / 12</span>
        <strong>{matchedPairs} OF 6 FOUND</strong>
      </div>
      <div className="memory-grid">
        {player.memory.deck.map((symbol, index) => {
          const isRevealed = player.memory.revealed.includes(index);
          const isMatched = player.memory.matched.includes(index);
          const targetId = `card-${index + 1}`;
          const isFaceUp = isRevealed || isMatched;

          return (
            <button
              className={`memory-card${isFaceUp ? " is-flipped" : ""}${
                isMatched ? " is-matched" : ""
              }`}
              data-element-id={targetId}
              data-index={index + 1}
              disabled={isFaceUp}
              id={`${player.id}-${targetId}`}
              key={targetId}
              onClick={() => onAction(player.id, targetId)}
              aria-label={
                isFaceUp
                  ? `Card ${index + 1}: ${symbol}`
                  : `Card ${index + 1}: face down`
              }
              tabIndex={-1}
              type="button"
            >
              <span className="memory-card-inner">
                <span className="memory-card-back">
                  <span>{index + 1}</span>
                  <i />
                </span>
                <span className="memory-card-front">
                  <b aria-hidden="true">{MEMORY_GLYPHS[symbol]}</b>
                  <small>{symbol}</small>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="memory-progress" aria-label={`${matchedPairs} pairs matched`}>
        {Array.from({ length: 6 }, (_, index) => (
          <span className={index < matchedPairs ? "is-filled" : ""} key={index} />
        ))}
      </div>
    </div>
  );
}

const DIRECTIONS = [
  { id: "move-up", glyph: "↑", label: "Up" },
  { id: "move-left", glyph: "←", label: "Left" },
  { id: "move-down", glyph: "↓", label: "Down" },
  { id: "move-right", glyph: "→", label: "Right" },
] as const;

function Game2048Fixture({
  player,
  onAction,
}: Omit<GameFixtureProps, "game">) {
  return (
    <div className="game2048-fixture" aria-label={`${player.name} 2048 fixture`}>
      <div className="game2048-topline">
        <span>MOVE {player.game2048.steps} / 24</span>
        <strong>{player.game2048.score} SCORE</strong>
      </div>
      <div className="game2048-layout">
        <div className="game2048-board">
          {player.game2048.board.map((value, index) => (
            <div
              className={`tile tile-${Math.min(value, 2048)}`}
              key={index}
              aria-label={value ? `Tile ${value}` : "Empty tile"}
            >
              {value || ""}
            </div>
          ))}
        </div>
        <div className="direction-pad" aria-label="Indexed direction controls">
          {DIRECTIONS.map((direction, index) => (
            <button
              aria-label={`Move tiles ${direction.label.toLowerCase()}`}
              className={`direction-button direction-${direction.label.toLowerCase()}`}
              data-element-id={direction.id}
              data-index={index + 1}
              id={`${player.id}-${direction.id}`}
              key={direction.id}
              onClick={() => onAction(player.id, direction.id)}
              tabIndex={-1}
              type="button"
            >
              <span>{direction.glyph}</span>
              <small>{direction.label}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TreasureFixture({
  player,
  onAction,
}: Omit<GameFixtureProps, "game">) {
  return (
    <div
      className="treasure-fixture"
      aria-label={`${player.name} Treasure Hunt fixture`}
    >
      <div className="treasure-topline">
        <span>{player.treasure.clicks} CELLS REVEALED</span>
        <strong>{player.treasure.found} OF 3 FOUND</strong>
      </div>
      <div className="treasure-grid">
        {Array.from({ length: 25 }, (_, index) => {
          const isRevealed = player.treasure.revealed.includes(index);
          const isTreasure = player.treasure.treasures.includes(index);
          const isLatest = player.treasure.lastCell === index;
          const targetId = `cell-${index + 1}`;
          return (
            <button
              aria-label={
                isRevealed
                  ? isTreasure
                    ? `Cell ${index + 1}: treasure found`
                    : `Cell ${index + 1}: empty`
                  : `Hidden grid cell ${index + 1}`
              }
              className={`treasure-cell${isRevealed ? " is-revealed" : ""}${
                isTreasure && isRevealed ? " has-treasure" : ""
              }${isLatest ? " is-latest" : ""}`}
              data-element-id={targetId}
              data-index={index + 1}
              disabled={isRevealed}
              id={`${player.id}-${targetId}`}
              key={targetId}
              onClick={() => onAction(player.id, targetId)}
              tabIndex={-1}
              type="button"
            >
              <span className="treasure-cell-index">{index + 1}</span>
              {isRevealed && (
                <span className="treasure-cell-result" aria-hidden="true">
                  {isTreasure ? "◆" : "·"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GameFixture({ game, player, onAction }: GameFixtureProps) {
  if (game === "memory-match") {
    return <MemoryFixture player={player} onAction={onAction} />;
  }
  if (game === "2048") {
    return <Game2048Fixture player={player} onAction={onAction} />;
  }
  return <TreasureFixture player={player} onAction={onAction} />;
}
