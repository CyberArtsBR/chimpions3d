# Asset tooling

The asset audit uses Node built-ins only, so it adds no runtime dependency and is deterministic under the repository's pinned Node version.

Recommended binary-optimization workflow:
1. npm ci
2. npm run build
3. npm run check:assets
4. Save checks/assets-report.json as the before report.
5. Optimize one asset category with pinned tooling.
6. Re-run build, asset checks, browser checks, and visual comparisons.
7. Compare transfer bytes, estimated GPU texture bytes, skeleton/skin stats, silhouettes, materials, texture seams, and color-space behavior.
8. Tighten asset-budgets.mjs after verified savings land.

Do not enable Draco, Meshopt, or KTX2 output until the runtime integration branch provides matching decoders atomically. Do not route local user-uploaded GLBs through production optimization tooling at runtime.
