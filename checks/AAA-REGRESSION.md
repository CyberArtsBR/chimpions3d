# Chimp Jump AAA Regression QA

This branch adds release validation only. It does not change gameplay tuning, scoring, art direction, character animation, or backend architecture. The only application-code change gates the mutable browser test API behind `VITE_CHIMP_QA_HOOKS=1`; ordinary production builds cannot enable it with a query string.

## Test tiers

### FAST

Run after a normal production build:

```bash
npm ci
npm run build
npm run qa:fast
```

Covers source/test syntax, deterministic gameplay, existing physics invariants, assets, local GLB validation, asset budgets, source audit, and production test-hook safety.

### STANDARD

Build a dedicated QA bundle and run a preview server:

```bash
VITE_CHIMP_QA_HOOKS=1 VITE_LEADERBOARD_URL=http://127.0.0.1:4173/__qa_leaderboard__ npm run build
npm run preview -- --host 127.0.0.1
npm run qa:standard
```

Covers Chromium gameplay E2E, roster loading, countdown, six responsive viewports, accessibility, network failures including slow/late run tickets, blur/visibility/gamepad/WebGL resilience, frame/resource budgets, 10-minute accelerated soak, 25 restarts, and deterministic visual captures.

The tier runner executes every suite even when one fails, records `qa-standard-status-report.json`, generates `acceptance-matrix.json` / `.md`, and only then returns a failing exit code.

### EXTENDED

The GitHub Actions `workflow_dispatch` path installs Chromium, Firefox and WebKit and runs cross-browser smoke plus the slow-network path. This remains separate from the default deployment gate to control CI time.

### PRODUCTION

The manual production job visits the real public `?play=jump` route without QA hooks. It verifies the version manifest, waits for fonts/images plus rendered frames, checks that `window.chimpJumpTest` is absent, and exercises menu, Field Guide, character picker, countdown, gameplay, input, pause and 1080p layout.

## Current source-level blockers exposed by the new tests

1. **Countdown contract:** current runtime renders `3 → 2 → 1 → 0`; the required visible `GO` state is missing. `checks/countdown-browser.mjs` intentionally fails until the runtime owner implements the required contract.
2. **Slow leaderboard startup:** `start()` enters `starting` but awaits `leaderboard.begin()` before initializing `countdownTime`. A slow or late run-ticket response can therefore hide/delay the visible countdown. `checks/network-failures-browser.mjs` makes this a STANDARD release gate.
3. **Visual regression baselines:** deterministic screenshots are captured for menu, Field Guide, picker, countdown, gameplay, mechanics/hazard coverage, all four biomes, pause and result. Pixel-diff gating remains in baseline-candidate mode until approved baseline images are committed; deployment is not blocked on an unreviewed flaky threshold.

## Reports and artifacts

CI uploads screenshots, visual captures, JSON performance/resource results, asset budgets, network reports, suite status, and the final acceptance matrix. Production and standard browser checks fail on uncaught page errors; production additionally fails on unexpected `console.error` and same-origin HTTP errors.
