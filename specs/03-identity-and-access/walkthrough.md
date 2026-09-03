# Identity & Access API walkthrough

Date: 2026-09-03  
Environment: confirmed development database

| Result | Method | Path | Status | Evidence | `x-request-id` |
|---|---|---:|---:|---|---|
| PASS | POST | `/api/v1/auth/login` with `workspaceSlug`, email, and password; no Tenant header | 200 | Existing user/session/token response returned; no Tenant identifier field | Present |
| PASS | POST | `/api/v1/auth/login` using valid email/password from a different workspace | 401 | Generic `Invalid email or password`; cross-workspace lookup blocked | Present |
| PASS | GET | `/api/v1/company` using the issued authentication/session | 200 | Exactly one Company from the authenticated workspace | Present |

Every role uses this same login endpoint. Passwords, hashes, tokens, and internal Tenant IDs are
excluded from this walkthrough.
