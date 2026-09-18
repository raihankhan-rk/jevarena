# JevArena

**Jev fights Jev.**

JevArena is a public, open-source spectator demo by
[Raihan Khan](https://x.com/raihankhan_rk). Pick one of three games in the
landing modal, press **Fight**, and watch **Jev** race
**Jev in parallel universe**. Both independent
[TypeSafe Jev](https://docs.typesafe.ai/introduction) agents choose operations
and indexed DOM targets side by side.

- No typing and no `TEXT_MODEL`
- One server-only `TYPESAFE_API_KEY`
- Live operation and target probability heads
- Self-hosted, deterministic game fixtures
- Railway-ready standalone Docker image

## Games

### Memory Match

Both players receive the same seeded 12-card deck, but maintain separate
reveals, matches, histories, and observed symbol memory. Mismatches turn
face-down before the next decision; matches stay visible. The first agent to
clear all six pairs wins. At the hard limit, matched pairs and then fewer flips
break the tie.

### 2048

Both players receive the same seeded 4×4 board and control it through four
indexed on-screen direction buttons. After 24 moves, the highest merge score
wins; the highest tile breaks a tied score.

### Treasure Hunt

Both players search separate copies of the same seeded 5×5 grid through
indexed cell buttons. Three treasures are hidden in identical positions. The
first agent to find all three wins.

## How the duel works

JevArena follows the
[`jev-ultrafast`](https://github.com/browser-use/jev-ultrafast) operation +
target-head pattern:

```text
fixture DOM → indexed clickable elements ─┐
visible state + recent actions ───────────┼→ one System One request
                                          │   ├─ operation Choice
                                          │   └─ click_target Choice
                                          └→ execute selected real button.click()
```

Every step sends Jev an observable fixture snapshot, the current element table,
and recent action history. The operation and speculative target heads are
evaluated in one `systemOne` call. Only the target selected from the current
indexed action space can execute. The model never generates selectors,
coordinates, JavaScript, or text.

The app uses a small in-page browser driver for the hosted demo. Each target is
a real button with a code-owned `data-element-id`; the executor resolves that
ID from the current DOM and invokes the button click. This keeps Railway
deployments fast and reliable while preserving the key Browser Use invariant:
the model chooses only among controls observed on the current page.

For a local/pro version, the driver boundary can be replaced with Browser Use,
Browser Harness, Playwright, or dual Browserbase sessions without changing the
Jev policy or fixture state format.

## Fairness and failure rules

- Fixtures and random seeds are identical for both agents.
- Player state, memory, action history, and score are isolated.
- Jev requests are launched concurrently each decision cycle.
- A timed-out or invalid model response marks that player `BLOCKED`.
- One blocked player loses; two blocked players draw.
- Memory limits are decided by pairs, then fewer flips.
- 2048 is bounded to 24 direction clicks.
- Treasure Hunt is bounded to the 25-cell grid.
- `DONE` is advisory. Arena code independently verifies every win.

## Run locally

Requirements: Node.js 20 or newer and a TypeSafe API key.

```bash
git clone https://github.com/raihankhan-rk/jevarena.git
cd jevarena
npm install
cp .env.example .env.local
```

Add your key:

```dotenv
TYPESAFE_API_KEY=your_key_here
```

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If no key is present, the UI remains fully playable with a deterministic local
policy clearly labeled **DEMO POLICY**. This mode is useful for UI development
and automated fixture testing; add the key to run both live Jevs. API failures
never silently fall back once a key is configured.

## Production build

```bash
npm run typecheck
npm run lint
npm run build
npm start
```

`npm start` respects the `PORT` environment variable.

## Deploy to Railway

1. Create a Railway service from this GitHub repository.
2. Add `TYPESAFE_API_KEY` as a service variable.
3. Deploy. Railway detects the included multi-stage `Dockerfile`.
4. Point the health check at `/`.

The Next.js build emits a standalone server and listens on `PORT`. No browser
binary, database, queue, or persistent volume is required for the reliable
in-page driver.

## Project map

```text
app/
  api/agent/step/route.ts  validated server-only decision endpoint
  page.tsx                 arena entry point
components/
  arena.tsx                bounded dual-agent match coordinator
  agent-pane.tsx           browser pane and probability telemetry
  game-fixtures.tsx        self-hosted clickable DOM fixtures
lib/
  arena/games.ts           deterministic fixtures and observations
  arena/types.ts           driver and trace contracts
  server/jev.ts            @typesafe-ai/sdk operation/target policy
```

## Security

`@typesafe-ai/sdk`, `TypeSafeClient`, and `systemOne` are imported only by the
server module. `TYPESAFE_API_KEY` is never exposed to client components or
serialized into the page. `.env*` files are ignored; only the empty
`.env.example` is committed.

## License

[MIT](LICENSE) © 2026 Raihan Khan
