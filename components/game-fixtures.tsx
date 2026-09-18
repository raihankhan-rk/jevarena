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
  const isSpot = state.game === "spot-race";
  const oneLiner =
    state.game === "spot-race"
      ? "A cell lights up. First Jev to click it scores."
      : state.game === "treasure-hunt"
        ? "Hidden treasures on one grid. First to click a treasure owns it. First to 3 wins."
        : "Empty squares. First Jev to click a square owns it. Most squares wins.";

  return (
    <div
      className={`shared-fixture shared-${state.game}`}
      aria-label={`Shared ${
        isSpot ? "Spot Race" : isTreasure ? "Treasure Hunt" : "Claim the Grid"
      } board`}
    >
      <div className="shared-board-topline">
        <span>ROUND {state.round + 1}</span>
        <strong>
          {isSpot
            ? "FIRST TO 7"
            : isTreasure
            ? `${state.revealed.length} / 25 REVEALED`
            : `${state.claimOwners.filter(Boolean).length} / 25 CLAIMED`}
        </strong>
      </div>

      <div className="shared-grid">
        {Array.from({ length: 25 }, (_, index) => {
          const active = isSpot && state.activeCell === index;
          const revealed = isSpot
            ? active && state.spotClaimedBy !== null
            : isTreasure
              ? state.revealed.includes(index)
              : state.claimOwners[index] !== null;
          const treasure = isTreasure && state.treasures.includes(index);
          const owner = isSpot
            ? active
              ? state.spotClaimedBy
              : null
            : isTreasure
              ? state.treasureOwners[index] ?? null
              : state.claimOwners[index];
          const targetId = `cell-${index + 1}`;
          const unavailable = isSpot ? !active || revealed : revealed;

          return (
            <button
              aria-label={
                unavailable
                  ? isSpot
                    ? `Cell ${index + 1}: not lit`
                    : treasure
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
                  : `${
                      isSpot ? "Lit" : isTreasure ? "Unrevealed" : "Unclaimed"
                    } shared cell ${index + 1}`
              }
              className={`shared-cell${revealed ? " is-revealed" : ""}${
                treasure && revealed ? " has-treasure" : ""
              }${active && !revealed ? " is-lit" : ""}${
                owner ? ` owner-${owner}` : ""
              }${
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
              {(revealed || (isSpot && active)) && (
                <span className="shared-cell-result" aria-hidden="true">
                  {isSpot && !owner ? (
                    "●"
                  ) : treasure && owner ? (
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
        <b>{isSpot ? "FIRST CLICK SCORES" : "FIRST CLICK WINS"}</b>
        <span>
          <i className="legend-jev-b" /> Parallel universe
        </span>
      </div>
      <p className="board-one-liner">{oneLiner}</p>
    </div>
  );
}
