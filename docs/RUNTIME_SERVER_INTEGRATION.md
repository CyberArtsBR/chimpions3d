# Chimp Jump runtime/server integration handoff

## Run start contract

The client no longer waits for `/api/runs` when Play is pressed. `RunSession` opportunistically prefetches a ticket while the menu/avatar flow is idle. At seed-commit time the client atomically chooses one seed:

- ready server ticket -> server seed, online-submit-capable run;
- no ready ticket -> locally generated uint32 seed, offline/non-submit-capable run;
- practice replay -> requested prior seed, always offline/non-submit-capable.

A late `/api/runs` response is discarded after a run commits. Never attempt to attach a ticket to an already-started offline run and never swap a seed during play.

## Trace transition

Client trace format v2 is implemented in `src/runtime/InputTrace.js` but the client keeps sending the legacy array by default so the current server remains compatible. Do not set `VITE_LEADERBOARD_TRACE_V2=1` until the server accepts v2.

Legacy remains:

```text
trace = [[axis1000, count], ...]
axis1000 = q * 8
q range = -125..125
control = axis1000 / 1000 = q / 125
```

V2 transport is:

```json
{
  "v": 2,
  "q": 125,
  "steps": 12345,
  "segments": 321,
  "data": "base64url-without-padding"
}
```

`data` is a byte stream of repeated segments:

1. one unsigned axis byte: `axisByte = q + 125` (valid 0..250);
2. one unsigned LEB128/varint run length (`count >= 1`).

Replay control for each segment is exactly `q / 125`. This is intentionally exactly compatible with the legacy representation because `q * 8 / 1000 === q / 125`.

## Required server changes for v2

Keep legacy support during rollout. For `POST /api/runs/:id/finish`, accept either the current array or the v2 object. For v2, reject unless all of the following hold:

- `v === 2` and `q === 125`;
- `steps` and `segments` are positive integers within existing replay limits;
- base64url decodes successfully with no invalid alphabet/padding assumptions;
- every axis byte is `0..250` and maps to `q = axisByte - 125`;
- every varint terminates, is minimally bounded, and decodes to `count >= 1`;
- decoded segment count equals `segments`;
- sum of all counts equals `steps` and never exceeds `108000`;
- no trailing or partially decoded bytes remain;
- replay still rejects input after death and still enforces existing wall-clock timing/ruleset checks.

The current 1.5 MB request cap may remain. V2 worst-case client encoding for 108,000 single-step segments is below 450 KB of base64url payload before JSON overhead.

After dual-format server support is deployed and verified, enable `VITE_LEADERBOARD_TRACE_V2=1` on the static client. Keep legacy decoding for at least one client release window so cached clients can still finish already-issued runs.
