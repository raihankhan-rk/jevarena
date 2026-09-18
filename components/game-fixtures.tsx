"use client";

import type { PlayerId, SharedRaceState } from "@/lib/arena/types";

interface SharedGameFixtureProps {
  state: SharedRaceState;
  onAction: (targetId: string) => void;
}

function CellOwner({
  owner,
}: {
  owner: PlayerId;
}) {
  return (
    <span className="shared-cell-owner">
      {owner === "jev-a" ? "J" : "J′"}
    </span>
  );
}

export function SharedGameFixture({
  state,
  onAction,
}: SharedGameFixtureProps) {
  const isTreasure = state.game === "treasure-hunt";

  return (
    <div
      className={`shared-fixture shared-${state.game}`}
      aria-label={`Shared ${isTreasure ? "Treasure Hunt" : "Claim Race"} board`}
    >
      <div className="shared-board-topline">
        <span>ROUND {state.round + 1}</span>
        <strong>
          {isTreasure
            ? `${state.revealed.length} / 25 REVEALED`
            : `${state.claimOwners.filter(Boolean).length} / 25 CLAIMED`}
        </strong>
      </div>

      <div className="shared-grid">
        {Array.from({ length: 25 }, (_, index) => {
          const revealed = isTreasure
            ? state.revealed.includes(index)
            : state.claimOwners[index] !== null;
          const treasure = isTreasure && state.treasures.includes(index);
          const owner = isTreasure
            ? state.treasureOwners[index] ?? null
            : state.claimOwners[index];
          const targetId = `cell-${index + 1}`;
          const unavailable = revealed;

          return (
            <button
              aria-label={
                unavailable
                  ? treasure
                    ? `Cell ${index + 1}: treasure claimed by ${
                        owner === "jev-a"
                          ? "Jev"
                          : "Jev in parallel universe"
                      }`
                    : owner
                      ? `Cell ${index + 1}: claimed by ${
                          owner === "jev-a"
                            ? "Jev"
                            : "Jev in parallel universe"
                        }`
                      : `Cell ${index + 1}: revealed empty`
                  : `${isTreasure ? "Unrevealed" : "Unclaimed"} shared cell ${
                      index + 1
                    }`
              }
              className={`shared-cell${revealed ? " is-revealed" : ""}${
                treasure && revealed ? " has-treasure" : ""
              }${owner ? ` owner-${owner}` : ""}${
                state.lastCell === index ? " is-latest" : ""
              }${state.collisionCell === index ? " is-collision" : ""}`}
              data-element-id={targetId}
              data-index={index + 1}
              disabled={unavailable}
              id={`shared-${targetId}`}
              key={targetId}
              onClick={() => onAction(targetId)}
              tabIndex={-1}
              type="button"
            >
              <span className="shared-cell-index">{index + 1}</span>
              {revealed && (
                <span className="shared-cell-result" aria-hidden="true">
                  {treasure && owner ? (
                    <>
                      <b>◆</b>
                      <CellOwner owner={owner} />
                    </>
                  ) : owner ? (
                    <CellOwner owner={owner} />
                  ) : (
                    "·"
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="shared-board-legend">
        <span>
          <i className="legend-jev-a" /> Jev
        </span>
        <b>FIRST CLAIM WINS</b>
        <span>
          <i className="legend-jev-b" /> Parallel universe
        </span>
      </div>
    </div>
  );
}
