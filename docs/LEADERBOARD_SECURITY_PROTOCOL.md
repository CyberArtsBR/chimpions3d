# Chimp Jump Leaderboard Security Protocol

This document describes the authoritative leaderboard protocol implemented by the leaderboard service on the feat/chimp-jump-leaderboard-hardening branch.

## Security model

The client never supplies an authoritative score. The server issues a cryptographically random run ID and seed, persists their association, receives only the input trace plus permitted metadata, replays the run using the shared game implementation, and computes meters, bananas, score, and leaderboard placement itself.

The current deterministic implementation imports Game, STEP, and RULESET directly from src/physics.js and scoreFor from src/score.js. There is no independent server physics approximation.

This design prevents trivial forged score submissions. It does not prove that a human generated the input trace and should not be described as bot-proof.

## Version contract

Current versions:

- protocolVersion: 1
- rulesetVersion: 2026-09-expedition-v7-no-wind
- traceVersion: 1

Each new run ticket persists protocol version, trace version, ruleset version, seed, creation time, expiry time, and completion state.

For backward compatibility during migration, missing protocolVersion and traceVersion are interpreted as version 1, and the run-start request may use the existing ruleset field instead of rulesetVersion.

A ticket is never silently replayed with different physics. If a future gameplay release changes deterministic behavior, integration must either keep the historical ruleset implementation registered until outstanding tickets expire or deliberately reject those tickets with RULESET_UNAVAILABLE. The gameplay and leaderboard ruleset update must be integrated atomically.

## Trace version strategy

Trace version 1 is the existing run-length form:

- each segment is [axis,count]
- axis is an integer from -1000 through 1000
- count is a positive integer
- the server converts axis to axis / 1000 before each fixed simulation step
- the trace may contain at most 108000 segments
- the total may contain at most 108000 fixed steps
- one segment may contain at most 108000 fixed steps

The server rejects wrong shapes, non-integers, zero or negative counts, out-of-range axes, excessive segment counts, excessive simulation steps, unsupported trace versions, input after death, and traces that do not end the run.

A future compact traceVersion 2 should be a separate, explicitly negotiated decoder. It should not be inferred from payload shape. This branch intentionally does not invent that client protocol while the runtime/input work is proceeding independently.

## Run start protocol

POST /api/runs

Content-Type: application/json

Preferred request fields:

- protocolVersion: 1
- rulesetVersion: current ruleset
- traceVersion: 1

Legacy-compatible request:

- ruleset: current ruleset

Successful response, HTTP 201:

- protocolVersion
- rulesetVersion
- traceVersion
- runId
- id, retained as a compatibility alias for the existing client
- seed
- createdAt
- expiresAt

The run ID is 24 cryptographically random bytes encoded as 48 lowercase hexadecimal characters. The seed is generated server-side and persisted with the ticket. Run lifetime is 24 hours.

Offline gameplay remains possible, but a run without a valid server-issued ticket cannot later become an online leaderboard result.

## Run finish protocol

POST /api/runs/{runId}/finish

Content-Type: application/json

Preferred request fields:

- protocolVersion: 1
- traceVersion: 1
- trace: version-1 input trace
- seed: optional integrity comparison only
- rulesetVersion: optional integrity comparison only

The server always uses the persisted seed and ruleset. A conflicting submitted seed is rejected.

The trace is replayed with the shared deterministic Game at STEP. The resulting meters and bananas are read from the replay and score is computed on the server.

Successful response, HTTP 200:

- protocolVersion
- rulesetVersion
- traceVersion
- score
- meters
- bananas
- rank, or null when outside the top ten
- entries, the bounded top leaderboard

The first successful finish stores a SHA-256 digest of the trace. Repeating the exact same finish request for the same run is idempotent and returns the stored authoritative result. A later different trace for the same completed run is rejected with RUN_ALREADY_FINISHED. A run can therefore create only one score row.

## Timing validation

Timing is intentionally one-sided.

Let simulatedMs be replaySteps multiplied by STEP multiplied by 1000.

The accepted condition is:

elapsed wall-clock milliseconds >= max(0, simulatedMs - 5000)

The five-second grace accommodates normal scheduling, request latency, and small startup differences. There is no upper wall-clock bound tied to simulated duration, so background tabs, pauses, slow devices, and network delays do not punish legitimate players. A client cannot submit a long simulated run substantially faster than real time.

Exact real-time synchronization is not required.

## Request and CPU bounds

- maximum JSON body: 1,500,000 bytes
- maximum trace segments: 108,000
- maximum fixed simulation steps: 108,000
- maximum one segment count: 108,000
- run expiry: 24 hours
- leaderboard rows: 10
- records page size: 20
- records offset ceiling: 10,000

Oversized bodies are rejected before JSON parsing completes. Replay is never wall-clock paced; it runs as fast as deterministic CPU simulation permits.

## Naming and XSS defense

Names are normalized to NFC, trimmed, and limited to 1–10 Unicode letters or numbers plus spaces, dots, underscores, and hyphens.

Control characters, markup punctuation such as angle brackets, and excessive length are rejected. Names remain plain data. The client must still render them as text rather than HTML.

## Ranking

Competitive ordering remains unchanged:

1. score descending
2. finish timestamp ascending
3. run ID ascending

The name claim is protected by an immediate SQLite transaction so a score that falls out of the top ten during a concurrent claim is not admitted.

## Error response contract

Controlled failures return JSON containing:

- error: stable human-readable message
- code: stable machine-readable code

Important codes include:

- NOT_FOUND
- METHOD_NOT_ALLOWED
- UNSUPPORTED_MEDIA_TYPE
- INVALID_JSON
- BODY_TOO_LARGE
- ORIGIN_REJECTED
- RATE_LIMITED
- RUN_NOT_FOUND
- RUN_EXPIRED
- RUN_NOT_FINISHED
- RUN_ALREADY_FINISHED
- RUN_ALREADY_NAMED
- RULESET_MISMATCH
- RULESET_UNAVAILABLE
- UNSUPPORTED_PROTOCOL
- UNSUPPORTED_TRACE_VERSION
- TRACE_VERSION_MISMATCH
- SEED_MISMATCH
- INVALID_TRACE
- TRACE_TOO_MANY_SEGMENTS
- TRACE_TOO_MANY_STEPS
- INPUT_AFTER_GAME_OVER
- TIMING_REJECTED
- INVALID_PLAYER_NAME
- SCORE_NOT_TOP_10
- INTERNAL_ERROR

Internal stack traces, filesystem paths, SQLite details, and request bodies are not returned to clients.

## Rate limiting

The default in-memory policies are intentionally route-specific:

- run creation: 20 requests per minute per client key
- run finish: 30 per minute
- name submission: 30 per minute
- top leaderboard read: 120 per minute
- records read: 120 per minute

The limiter is exposed behind a small class interface so distributed storage can replace it later. Redis is not required for the current single-instance deployment. Raw client IP addresses are not stored in limiter keys; a short SHA-256-derived ephemeral key is used.

## Proxy and client IP handling

TRUST_PROXY is false by default. With it disabled, only the socket peer address is trusted.

The Render Blueprint explicitly enables TRUST_PROXY because that production service is behind Render's managed ingress. In that trusted deployment only, the first valid X-Forwarded-For client address is used for rate limiting. Do not enable this setting on an origin directly reachable from the public internet through an untrusted forwarding path.

Origin allowlisting remains a browser defense layer, not authentication.

## SQLite persistence

The service preserves SQLite WAL and a 5000 ms busy timeout. Schema upgrades are additive for existing installations.

The runs table now records:

- id
- seed
- started
- expires
- finished
- meters
- bananas
- score
- name
- ruleset
- protocol_version
- trace_version
- trace_hash

New databases receive constraints for run-ID length, seed range, nonnegative result fields, and bounded name length. Existing databases receive missing columns without destructive recreation.

Indexes cover leaderboard ranking, recent records, and unfinished-run expiry. Completed historical scores are not deleted. Old unfinished expired tickets are retained for an additional day before cleanup so clients can receive an explicit expiry response.

## Logging, health and shutdown

Security-relevant events are structured JSON and include run creation/completion, invalid traces, expiry, rate limiting, origin rejection, oversized bodies, and timing rejection. Full traces, raw request bodies, and raw IP addresses are not logged.

GET /health returns only service health and public protocol/ruleset/trace versions.

SIGTERM and SIGINT stop accepting work, close idle HTTP connections, close SQLite, and then exit. A short forced-shutdown guard prevents a permanently stuck process.

## Tests and fuzzing

The backend suite covers:

- versioned health and run creation
- valid deterministic finish
- duplicate finish idempotency and conflicting replay rejection
- unknown and expired runs
- seed integrity
- unknown trace versions
- malformed trace shapes and values
- maximum-step and segment abuse
- malformed JSON
- request body cap
- method enforcement
- content-type enforcement
- unauthorized browser origin
- player-name validation
- route-specific rate limiting
- unique concurrent run creation
- concurrent valid submissions and reads
- ranking and deterministic ties
- SQLite restart persistence

The deterministic validation fuzzer currently generates 5004 malformed and edge-case values. In the verification run, all cases were either accepted by the documented input contract or rejected with a controlled HttpError; no unexpected exception occurred.

## Deterministic replay parity

This branch began from main commit f2e7b2830651dd2ed53ea47452dae4b908953ec1.

At that baseline the authoritative shared ruleset is 2026-09-expedition-v7-no-wind. The server replay imports the same physics and score implementation directly, so there is no known replay divergence introduced by this branch.

If the parallel physics branch changes deterministic behavior, integration must update the shared ruleset contract atomically. This branch must not guess how future physics behaves.

## Replay benchmark

Verification was run under Node 22.16.0 using a deterministic seed-2 trace and the production replay function. These figures are development-machine measurements, not a hosting SLA.

| Scenario | Fixed steps | Simulated duration | Mean replay CPU time |
| --- | ---: | ---: | ---: |
| approximately 1 minute | 4,122 | 68.70 s | 2.57 ms |
| approximately 5 minutes | 18,742 | 312.37 s | 9.47 ms |
| approximately 10 minutes | 36,043 | 600.72 s | 19.35 ms |
| near maximum allowed run | 107,216 | 1,786.93 s | 90.94 ms |

The benchmark script is checks/leaderboard-benchmark.mjs so these measurements can be repeated on the deployment class before release.

## Render deployment

The optional leaderboard Blueprint remains a single starter web service with a persistent 1 GB disk, Node 22.23.2, /health checking, the production origin allowlist, and auto-deploy only after checks pass.

Its build command now performs a syntax check, the backend integration suite, and deterministic fuzz validation before deployment. TRUST_PROXY is enabled only in that explicit Render configuration.

No secrets are committed.

## Exact runtime/client integration requirements

No immediate client edit is required because protocol version 1 accepts the current client's run-start ruleset field, missing protocolVersion/traceVersion as version 1, the existing id response field, and finish requests containing only trace.

The runtime/input branch should migrate deliberately to the preferred contract:

1. At online run start send protocolVersion 1, rulesetVersion from the shared RULESET, and traceVersion 1.
2. Store runId, server seed, rulesetVersion, traceVersion, and expiresAt from the ticket.
3. Initialize the gameplay run with the server seed.
4. Record only quantized authoritative input segments.
5. At finish send protocolVersion, traceVersion, and trace. Seed and rulesetVersion may also be echoed for integrity diagnostics.
6. Treat the server response as the only authoritative score, meters, bananas, and rank.
7. Never convert an offline run into an online submission.
8. Handle stable error codes, especially RUN_EXPIRED, RULESET_MISMATCH, RULESET_UNAVAILABLE, RATE_LIMITED, and TIMING_REJECTED.
9. A future traceVersion 2 must be negotiated in the run ticket and implemented simultaneously on client and server.
10. Any deterministic physics change must change RULESET and be integrated with compatible replay support before release.

## Remaining risks

- Valid deterministic traces can still be generated by automation or bots. Replay integrity is not proof of human play.
- In-memory rate limits are per process. Multiple replicas would require a shared limiter.
- Only the currently imported deterministic ruleset is executable by this service. A release strategy that allows old tickets to survive a physics deployment needs a historical ruleset registry.
- SQLite with one persistent disk is appropriate for the current single service but is not a multi-writer horizontal database architecture.
- Origin validation is not authentication and non-browser clients can send requests directly.
- Infrastructure-level denial-of-service protection still depends on the hosting edge in addition to application bounds.
