"use client";

import { MEMORY_GLYPHS } from "@/lib/arena/games";
import type { GameId, PlayerRun } from "@/lib/arena/types";

interface GameFixtureProps {
  game: GameId;
  player: PlayerRun;
  onAction: (player: PlayerRun["id"], targetId: string) => void;
}

function WhackFixture({ player, onAction }: Omit<GameFixtureProps, "game">) {
  return (
    <div className="whack-fixture" aria-label={`${player.name} Whack-a-Mole fixture`}>
      <div className="fixture-sky" aria-hidden="true">
        <span className="cloud cloud-one" />
        <span className="cloud cloud-two" />
        <span className="sun" />
      </div>
      <div className="whack-scoreline">
        <span>FIELD 01</span>
        <strong>{String(player.whack.score).padStart(2, "0")} HITS</strong>
      </div>
      <div className="mole-grid">
        {Array.from({ length: 9 }, (_, index) => {
          const isActive = player.whack.activeHole === index;
          const isHit = player.whack.hitHole === index;
          const targetId = `hole-${index + 1}`;
          return (
            <button
              className={`mole-hole${isActive ? " is-active" : ""}${
                isHit ? " is-hit" : ""
              }`}
              data-element-id={targetId}
              data-index={index + 1}
              id={`${player.id}-${targetId}`}
              key={targetId}
              onClick={() => onAction(player.id, targetId)}
              aria-label={
                isActive
                  ? `Hole ${index + 1}: live mole, click now`
                  : `Hole ${index + 1}: empty`
              }
              tabIndex={-1}
              type="button"
            >
              <span className="hole-index">{index + 1}</span>
              <span className="mole" aria-hidden="true">
                <span className="mole-ear mole-ear-left" />
                <span className="mole-ear mole-ear-right" />
                <span className="mole-face">
                  <span className="mole-eye mole-eye-left" />
                  <span className="mole-eye mole-eye-right" />
                  <span className="mole-nose" />
                </span>
              </span>
              <span className="hole-rim" aria-hidden="true" />
              {isHit && <span className="hit-pop">+1</span>}
            </button>
          );
        })}
      </div>
      <div className="fixture-ground" aria-hidden="true" />
    </div>
  );
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

export function GameFixture({ game, player, onAction }: GameFixtureProps) {
  return game === "whack-a-mole" ? (
    <WhackFixture player={player} onAction={onAction} />
  ) : (
    <MemoryFixture player={player} onAction={onAction} />
  );
}
