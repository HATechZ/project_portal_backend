# Organization API walkthrough

Date: 2026-09-03  
Environment: confirmed development database

| Result | Method | Path | Status | Envelope | `x-request-id` |
|---|---|---:|---:|---|---|
| PASS | GET | `/api/v1/company-type` without authentication or Tenant header | 200 | `{ success: true, message, data: [{ id, name, description }], timestamp }`; contained the deterministic EPC Contractor row | Present |
| PASS | POST | `/api/v1/company/signup` with the approved product body and no workspace/Tenant input | 201 | Returned generated collision-safe `workspaceSlug`; no Tenant identifier | Present |
| PASS | GET | `/api/v1/company` after workspace-aware Sign In | 200 | Paginated result contained exactly the newly provisioned Company | Present |
| PASS | POST | `/api/v1/company/signup` with an unknown `companyTypeId` | 400 | `{ success: false, error: { code: "BAD_REQUEST", message }, meta: { requestId, timestamp } }` | Present and matched `meta.requestId` |
| PASS | POST | `/api/v1/company` | 404 | Standard error envelope | Present |

The invalid-reference request verified database-function error translation. Successful signup,
universal Sign In, and tenant-scoped Company retrieval were then exercised end to end. Sensitive
credentials, tokens, and internal Tenant identifiers are intentionally omitted.
