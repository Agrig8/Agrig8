# Dashboard data freshness

Issue #180. Source: `src/lib/dataFreshness.ts`.

Collectors that feed operational dashboards register a source with a stale
threshold and call `recordSuccess` after each successful run. Dashboards read
`GET /health/data-freshness` and show the warning for any source that is not
`fresh`.

## Statuses

- `fresh`: last success is within `staleAfterMs`.
- `stale`: last success is older than `staleAfterMs` (strictly greater).
- `never`: no successful run has been recorded. A `never` source makes the
  overall status `never`.

A timestamp in the future (clock skew) is reported as age 0.

## Usage

```ts
import { dataFreshness } from "../lib/dataFreshness";

dataFreshness.register("pilot_feedback_sync", 15 * 60 * 1000);
// after a successful run:
dataFreshness.recordSuccess("pilot_feedback_sync");
```

`recordSuccess` throws for unregistered sources, so every collector must
register at startup.

## Response

```json
{
  "generatedAt": "2026-11-19T12:00:00.000Z",
  "overall": "stale",
  "sources": [
    {
      "source": "pilot_feedback_sync",
      "status": "stale",
      "lastSuccessAt": "2026-11-19T11:30:00.000Z",
      "ageSeconds": 1800,
      "staleAfterSeconds": 900,
      "warning": "pilot_feedback_sync last succeeded 1800s ago, beyond the 900s threshold. Data may be out of date."
    }
  ]
}
```

The state is in process memory, so each instance reports its own collectors.
