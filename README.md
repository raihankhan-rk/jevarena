# JevArena

**Jev fights Jev in parallel universe — on Snake.**

JevArena is a public, open-source spectator demo by
[Raihan Khan](https://x.com/raihankhan_rk). Two independent
[TypeSafe Jev](https://docs.typesafe.ai/introduction) agents drive two live
Snake browsers side by side using only indexed direction-button clicks.

- Classic Snake, no custom game explanation required
- Two independent same-origin browser contexts
- Click-only: no typing and no `TEXT_MODEL`
- One server-only `TYPESAFE_API_KEY`
- Live operation and direction probabilities
- Railway-ready standalone Next.js image

## How the duel works

Each pane embeds a separate `/play/snake` page in its own iframe browsing
context. Every game owns its own loop, snake, food seed, DOM direction buttons,
score, and crash state.

```text
Snake iframe A state ─→ Jev ─→ CLICK direction button in iframe A
Snake iframe B state ─→ Jev ─→ CLICK direction button in iframe B
```

The iframe streams structured board snapshots to the spectator page with
same-origin `postMessage`. The parent sends each snapshot to the server-only
`/api/agent/step` route. Jev receives:

- head, body, food, score, current direction, and tick
- only legal/safe on-screen direction buttons as indexed targets
- recent actions for that agent

The selected target is sent back to that specific iframe, which resolves the
current `data-element-id` and calls its real direction button. The avatar
flashes over the board and clicked control so viewers can see who acted.

## Why iframe browsers instead of Playwright in production?

The first design considered two Playwright Chromium contexts plus screenshot
or CDP screencast streaming. That requires persistent browser processes and a
stateful stream per viewer, making the public Railway demo materially heavier
and less reliable.

The shipped driver uses two real, isolated same-origin iframe browsing
contexts. It preserves the important browser-agent boundary—live page state,
indexed DOM targets, and real button clicks—without bundling Chromium or
running server-side browser workers. A Playwright driver can replace the
iframe transport later without changing the Jev request contract.

## Match rules

- The match runs for 60 seconds.
- A snake automatically advances every 230 ms.
- Jev can click `UP`, `DOWN`, `LEFT`, or `RIGHT`, or wait.
- Eating food adds one point and grows the snake.
- The first crash loses immediately.
- If both survive, the higher score at time-up wins.
- Each browser uses an independent deterministic food seed.
- Rematch aborts both old loops and opens fresh browser instances.

## Anonymous fight counter

When both iframe browsers are ready and a match is about to start, JevArena
calls `POST /api/fights`. The endpoint atomically increments a local JSON file
and writes one Railway log line:

```text
fight_click total=42 persistence=volume
```

There is no identity, tracking cookie, UTM capture, or analytics SDK.

- `GET /api/fights` returns the current count and persistence mode.
- [`/stats`](http://localhost:3000/stats) shows **Fights started: N**.
- `/data/fights.json` is preferred when `/data` is writable.
- `/tmp/jevarena/fights.json` is the automatic non-durable fallback.

For durable production counts, open the Railway project, select the
`jevarena` service, add a Volume, and mount it at `/data`. Redeploy once; the
container entrypoint assigns the mounted directory to the unprivileged
`nextjs` runtime user, and the stats page will show that Volume storage is
active. No database or paid data service is required.

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

Without a key, JevArena uses a clearly labeled deterministic direction policy
for UI and game testing. A configured Jev failure never silently falls back;
that browser becomes `BLOCKED`.

## Verify

```bash
npm run typecheck
npm run lint
npm run build
```

## Railway

The included multi-stage `Dockerfile` emits Next.js standalone output,
respects `PORT`, and serves `/` with HTTP 200. The iframe driver does not need
Chromium packages. Connect the repository, set `TYPESAFE_API_KEY`, and deploy
from `main`. Mount a Railway Volume at `/data` if the fight count must survive
deploys and restarts.

## Project map

```text
app/play/snake/page.tsx       independent Snake browser route
app/api/agent/step/route.ts   validated server-only Jev endpoint
app/api/fights/route.ts       anonymous file-backed counter API
app/stats/page.tsx            private-by-URL count display
components/snake-game.tsx     canvas game + indexed DOM controls
components/agent-pane.tsx     browser chrome, iframe, and telemetry
components/arena.tsx          match clock and two independent agent loops
lib/snake/engine.ts           deterministic Snake simulation
lib/arena/games.ts            board observation and action-space builder
lib/server/fight-counter.ts   atomic /data counter with /tmp fallback
lib/server/jev.ts             @typesafe-ai/sdk operation/direction policy
```

## Security

`@typesafe-ai/sdk`, `TypeSafeClient`, and `systemOne` are imported only by the
server module. `.env*` files are ignored; `.env.example` contains only
`TYPESAFE_API_KEY=`.

## License

[MIT](LICENSE) © 2026 Raihan Khan
