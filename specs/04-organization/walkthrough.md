# Organization API walkthrough

Date: 2026-09-03  
Environment: confirmed development database

| Result | Method | Path | Status | Envelope | `x-request-id` |
|---|---|---:|---:|---|---|
| PASS | GET | `/api/v1/company-type` without authentication or Tenant header | 200 | `{ success: true, message, data: [{ id, name, description }], timestamp }`; contained the deterministic EPC Contractor row | Present |
| PASS | POST | `/api/v1/company/signup` with an unknown `companyTypeId` | 400 | `{ success: false, error: { code: "BAD_REQUEST", message }, meta: { requestId, timestamp } }` | Present and matched `meta.requestId` |
| PASS | POST | `/api/v1/company` | 404 | Standard error envelope | Present |

The invalid-reference request verified the public signup route and database-function error translation without creating business records. The successful provisioning path was exercised directly inside a rollback-only database transaction; it created the complete workspace chain and left no persisted records after rollback.
