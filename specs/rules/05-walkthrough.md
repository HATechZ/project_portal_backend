# Article V — HTTP Verification `[CLAUDE]`

Read at Gate 5. Card: [`../RULES.md`](../RULES.md).

At Gate 5 the module's endpoints MUST be exercised over HTTP against a running server, and
the evidence recorded in the module's `walkthrough.md` with PASS/FAIL per step.

Record, for each endpoint:

| Field | |
|---|---|
| Request | method, full path, body |
| Status | the HTTP status returned |
| Envelope | that the body carries the [`06-standards.md`](06-standards.md) §3 shape |
| Error path | the `error.code` returned for at least one 4xx case |
| Correlation | that `x-request-id` is echoed on the response |

- **Claude:** browser tools against `/api/docs`, or `curl` via Bash.
- **`[ALL]` equivalent:** run the same calls with `curl` and paste the status line and body
  into `walkthrough.md`.

A missing `walkthrough.md` blocks Gate 5. This article is the only thing proving runtime
behavior — [`02-proof.md`](02-proof.md) assertions are static by design and cannot.
