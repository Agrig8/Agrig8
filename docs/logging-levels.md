# Log Level Standard

Backend code logs through `appLogger` (`backend/src/**`). Use these levels consistently.

| Level   | Use for | Examples |
|---------|---------|----------|
| `debug` | Developer diagnostics, off in production. Never log secrets or PII. | Cache hit/miss, query timing, parsed inputs |
| `info`  | Normal lifecycle events worth keeping. | Server start, trade state change, job completed |
| `warn`  | Unexpected but recovered. No operator action needed right away. | Retry attempt, fallback used, rate limit hit |
| `error` | An operation failed and was not recovered. Include the error and a correlation ID. | Failed Stellar submit, DB failure, unhandled exception |

## Rules

- Use `appLogger`, not `console.*`. Audit result (2026-11): 13 `console.error`, 5 `console.log`, and 1 `console.warn` remain in `backend/src` and should migrate.
- Expected client errors (4xx, validation failures) are `warn` or `info`, not `error`.
- Log once per failure at the boundary that handles it. Do not log and rethrow.
- Pass structured fields (`{ tradeId, correlationId }`) instead of interpolating them into the message.
- Never log secrets, tokens, private keys, or decrypted PII (see `docs/pii-encryption.md`).
