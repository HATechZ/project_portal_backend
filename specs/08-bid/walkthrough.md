# Gate 5 walkthrough — 08 Bid

| Step | Request | Status | Envelope / correlation | Result |
|---|---|---:|---|---|
| Authentication rejection | `GET /api/v1/bids` without bearer token | 401 | `AUTH_REQUIRED`; `x-request-id` echoed | PASS |
| Fixture prerequisite | create Client with seeded tenant-super-admin | 404 | `NOT_FOUND: Company not found`; request ID present | BLOCKED |

The API was started on the local verification port and authenticated against the applied database. The seeded administrator has no Company record, so current Client creation cannot produce the required scoped Client fixture. No Bid/Project state was written. Complete the Company/tenant fixture before rerunning the full authorization, RLS, file, event, outbox, and cleanup matrix.
