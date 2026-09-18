# JevArena

**Jev fights Jev — on one shared board.**

JevArena is a public, open-source spectator demo by
[Raihan Khan](https://x.com/raihankhan_rk). Two independent
[TypeSafe Jev](https://docs.typesafe.ai/introduction) calls race to claim
clickable elements in the same indexed DOM.

- Click-only: no typing and no `TEXT_MODEL`
- One server-only `TYPESAFE_API_KEY`
- Parallel model decisions, serialized board mutations
- Live operation and target probability heads
- Railway-ready standalone Next.js image

## Shared races

### Spot Race

A single cell lights up each round. Both Jevs receive that same indexed target;
the first serialized click scores one point. A different cell lights next.
First to seven wins.

### Treasure Hunt

Five treasures are hidden in one shared 5×5 grid. Both Jevs receive the same
snapshot and can select only unrevealed cell IDs. Their model requests run in
parallel, then clicks acquire a single JavaScript mutation lock in response
completion order. A treasure belongs to the Jev whose click reveals it. The
first to claim three of five wins.

### Claim the Grid

Every cell in one shared 5×5 grid is worth one point. Both Jevs race for
unclaimed cell IDs. The board runs until every cell is owned (or the bounded
round limit is reached), then the most claims wins.

## Race integrity

```text
one shared snapshot
       │
       ├── Jev systemOne() ─────────┐
       └── parallel Jev systemOne() ┤
                                    ▼
                     completion-time ordering
                                    │
                        one serial click lock
                          first claim wins
                                    │
                         next shared snapshot
```

- Both requests start from the same board revision.
- The faster completed response applies first.
- Responses within 4 ms use an alternating round priority.
- A second click on the same cell loses the claim as already taken.
- Revealed and claimed cells leave both agents' next action space.
- Rematches use a fresh deterministic seed and reverse near-tie priority.
- A timeout or invalid model response marks that Jev `BLOCKED`.
- The arena, not a model `DONE`, verifies every result.

## Run locally

Requires Node.js 20 or newer.

```bash
git clone https://github.com/raihankhan-rk/jevarena.git
cd jevarena
npm install
cp .env.example .env.local
```

Set the only credential:

```dotenv
TYPESAFE_API_KEY=your_key_here
```

Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without a key, the app uses a clearly labeled deterministic demo policy for UI
and race testing. If a configured Jev call fails, it becomes `BLOCKED`; the app
never silently falls back.

## Verify

```bash
npm run typecheck
npm run lint
npm run build
```

## Railway

The included multi-stage `Dockerfile` emits Next.js standalone output,
respects `PORT`, and serves the health check at `/`. Connect the repository,
set `TYPESAFE_API_KEY`, and deploy from `main`.

## Project map

```text
app/api/agent/step/route.ts  validated server-only decision endpoint
components/arena.tsx         parallel requests + serialized click lock
components/agent-pane.tsx    per-Jev probability telemetry
components/game-fixtures.tsx one shared clickable board
lib/arena/games.ts           shared race snapshots and seeded boards
lib/arena/types.ts           race, player, and trace contracts
lib/server/jev.ts            @typesafe-ai/sdk operation/target policy
```

## Security

`@typesafe-ai/sdk`, `TypeSafeClient`, and `systemOne` are imported only by the
server module. `.env*` files are ignored; the committed `.env.example` contains
only an empty `TYPESAFE_API_KEY=`.

## License

[MIT](LICENSE) © 2026 Raihan Khan
