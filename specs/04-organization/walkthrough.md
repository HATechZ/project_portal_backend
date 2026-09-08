# Company HTTP walkthrough

Executed: 2026-09-08T04:37:40.849Z. Command: `node scripts/verify-company-http.cjs`.

Production AppModule routes, guards, validation, services and repositories were exercised with
`curl.exe` against the configured PostgreSQL database as app_user. Background consumers and
throttler were disabled; Redis reads were uncached and mail captured. Maintenance credentials
were used only for temporary fixture setup, inspection and cleanup. No schema/grants changed.

52 requests: 50 PASS, 2 FAIL. The verifier exits 1 because valid rename/retype must return 200
but returned 500: app_user lacks UPDATE on public.companies (catalog check confirmed SELECT=true,
UPDATE=false). The owner prerequisite is documented in DATA_CONTRACT.md. Successful persisted
rename/retype and slug preservation remain unverified until that privilege is provisioned.

Requests use the bodies in `scripts/verify-company-http.cjs`: randomized example.invalid admin
accounts, matching 8?72 byte passwords, accepted terms and temporary CompanyType UUIDs. Invalid
cases omit/null/array nested objects, omit/mismatch confirmation, and send invalid/immutable
update fields. PATCH success candidates send name alone or companyTypeId alone. Secrets and
access tokens are deliberately not recorded. Base path for every row is /api/v1.

| # | Request/scenario | HTTP | Envelope | Error code | x-request-id | Result |
|---|---|---|---|---|---|---|
| 1 | GET /company-type | 200 | success,message,data,timestamp | - | echoed | PASS |
| 2 | POST /company/signup (company missing) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 3 | POST /company/signup (company null) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 4 | POST /company/signup (company []) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 5 | POST /company/signup (admin missing) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 6 | POST /company/signup (admin null) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 7 | POST /company/signup (admin []) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 8 | POST /company/signup (invalid confirmation) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 9 | POST /company/signup (invalid confirmation) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 10 | POST /company/signup (Tenant A) | 201 | success,message,data,timestamp | - | echoed | PASS |
| 11 | POST /company/signup (Tenant B) | 201 | success,message,data,timestamp | - | echoed | PASS |
| 12 | POST /auth/login (email only) | 200 | success,message,data,timestamp | - | echoed | PASS |
| 13 | POST /auth/login (email only) | 200 | success,message,data,timestamp | - | echoed | PASS |
| 14 | GET /company?page=1&limit=1 | 200 | success,message,data,timestamp | - | echoed | PASS |
| 15 | GET /company?page=2&limit=1 | 200 | success,message,data,timestamp | - | echoed | PASS |
| 16 | GET /company?page=0 | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 17 | GET /company/:id (own) | 200 | success,message,data,timestamp | - | echoed | PASS |
| 18 | PATCH /company/:id (valid update blocked by UPDATE privilege) | 500 | success,error,meta | INTERNAL_ERROR | echoed | FAIL |
| 19 | PATCH /company/:id (valid update blocked by UPDATE privilege) | 500 | success,error,meta | INTERNAL_ERROR | echoed | FAIL |
| 20 | GET /company/:id (own) | 200 | success,message,data,timestamp | - | echoed | PASS |
| 21 | PATCH /company/:id (invalid/immutable update) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 22 | PATCH /company/:id (invalid/immutable update) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 23 | PATCH /company/:id (invalid/immutable update) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 24 | PATCH /company/:id (invalid/immutable update) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 25 | PATCH /company/:id (invalid/immutable update) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 26 | PATCH /company/:id (invalid/immutable update) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 27 | PATCH /company/:id (invalid/immutable update) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 28 | PATCH /company/:id (invalid/immutable update) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 29 | PATCH /company/:id (invalid/immutable update) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 30 | PATCH /company/:id (invalid/immutable update) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 31 | PATCH /company/:id (invalid/immutable update) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 32 | GET /company/:id (own) | 200 | success,message,data,timestamp | - | echoed | PASS |
| 33 | GET /company/:id (no token) | 401 | success,error,meta | UNAUTHORIZED | echoed | PASS |
| 34 | GET /company/bad | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 35 | GET /company/:id (missing) | 404 | success,error,meta | NOT_FOUND | echoed | PASS |
| 36 | GET /company/:id (foreign target/header) | 404 | success,error,meta | NOT_FOUND | echoed | PASS |
| 37 | GET /company/:id (reverse isolation) | 404 | success,error,meta | NOT_FOUND | echoed | PASS |
| 38 | PATCH /company/:id (no token) | 401 | success,error,meta | UNAUTHORIZED | echoed | PASS |
| 39 | PATCH /company/bad | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 40 | PATCH /company/:id (missing) | 404 | success,error,meta | NOT_FOUND | echoed | PASS |
| 41 | PATCH /company/:id (foreign target/header) | 404 | success,error,meta | NOT_FOUND | echoed | PASS |
| 42 | PATCH /company/:id (reverse isolation) | 404 | success,error,meta | NOT_FOUND | echoed | PASS |
| 43 | GET /company | 401 | success,error,meta | UNAUTHORIZED | echoed | PASS |
| 44 | GET /company | 200 | success,message,data,timestamp | - | echoed | PASS |
| 45 | POST /auth/login (email only) | 200 | success,message,data,timestamp | - | echoed | PASS |
| 46 | GET /company | 403 | success,error,meta | FORBIDDEN | echoed | PASS |
| 47 | GET /company/:id (ordinary role) | 403 | success,error,meta | FORBIDDEN | echoed | PASS |
| 48 | PATCH /company/:id (ordinary role) | 403 | success,error,meta | FORBIDDEN | echoed | PASS |
| 49 | POST /company (retired create) | 404 | success,error,meta | NOT_FOUND | echoed | PASS |
| 50 | POST /company/signup (duplicate admin email rolls back) | 409 | success,error,meta | CONFLICT | echoed | PASS |
| 51 | POST /company/signup (unknown type) | 400 | success,error,meta | BAD_REQUEST | echoed | PASS |
| 52 | POST /auth/logout | 204 | empty (204) | - | echoed | PASS |

Persistence checks: rejected updates left stored Company unchanged; duplicate-email signup
rolled back Tenant/Company inserts; unknown CompanyType left no partial workspace; each
successful signup Tenant had exactly one Company. Two-way foreign Company access returned
404 and ordinary-role access returned 403. No header overrode JWT Tenant on reads/denials.
Valid PATCH with a foreign header reached the correct Tenant but was blocked by the grant.

Cleanup PASS: this run's workspaces, users, roles/profiles, permissions, sessions and two
temporary CompanyTypes were removed. Machine-readable sanitized evidence: http-evidence.json.

Representative actual failure envelope:

`{ "success": false, "error": { "code": "INTERNAL_ERROR", "message": "An unexpected error occurred" }, "meta": { "requestId": "<echoed>", "timestamp": "<runtime timestamp>" } }`

This failure is not accepted behavior and does not authorize marking the module complete.
