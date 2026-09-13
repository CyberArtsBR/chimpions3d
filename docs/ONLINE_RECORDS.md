# Online records and results

The static game now requires character confirmation after Let's Jump. A non-default catalog avatar is randomly previewed; Random Chimpion changes the highlighted selection. Try Again starts the same avatar immediately; Choose your Chimpion opens the selector.

Score = floor(maximum meters reached) × bananas collected. Zero bananas gives zero points. Death plays a descending square-wave sound. At +1 second, a red arcade splash rises from the death boundary at the player's X. At +2 seconds, the results open and convert the banana counter into points over 2.2 seconds. The original multiplication remains visible.

## Backend deployment (requires activation)

The existing render.yaml continues deploying the static site. It does not create paid resources automatically.

1. Approve the cost of a Render Starter web service plus a 1 GB persistent disk.
2. Create a separate Blueprint for this repository using `render-leaderboard.yaml`. The service runs Node's built-in SQLite API and stores data at `/var/data/scores.sqlite`.
3. Copy the backend's actual public HTTPS URL from Render. On the existing static site, set `VITE_LEADERBOARD_URL` to that URL (no trailing `/api`) and redeploy the static build.
4. If using a custom game domain, add its exact origin to backend `ALLOWED_ORIGINS` (comma-separated).

Local development: run `node server/leaderboard.mjs`, then start Vite with `VITE_LEADERBOARD_URL=http://localhost:3001`. Local database files live in ignored `data/`.

Without the backend URL the game remains playable and explicitly identifies runs as offline. Offline runs are not silently presented as saved online records.

## Persistence and scoring

The server issues a seed and secret run token. The browser records quantized input applied to physics; the server replays it to calculate meters and bananas. It rejects unfinished runs, invalid input, excessive payloads and impossible wall-clock duration. A token can finish and name only one score; retries are idempotent. Names accept 1–10 letters/numbers/spaces and simple punctuation and are rendered as text, never HTML. Bump RULESET whenever physics changes; mismatched clients and unfinished runs from older rules are rejected instead of being scored incorrectly.

Top 10 order: highest score first, then earliest finish, then stable run ID. Qualifying players get an ordinal congratulation and name field. Placement is checked again atomically when saving, since other players can finish meanwhile. All verified results remain in SQLite; named historical records remain browsable after dropping out of the Top 10. Server replay deters edited totals, but does not detect automated players/bots.

Keep the persistent disk when redeploying or changing plans. Files on a free ephemeral filesystem would be lost; do not use that configuration for all-time records. Enable Render disk backups according to your account's available options.

## Balance

Platforms are 30% longer, with unchanged thickness and collectible scale. Candidate density target rises 30% (2.7 to 3.51 per row); unsafe positions remain rejected. Jetpack duration is ten seconds and spawn interval remains 30 seconds.

Tests and local builds were not executed at the user's request. Existing automatic checks remain enabled and their flow expectations are updated separately.
