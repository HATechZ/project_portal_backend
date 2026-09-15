# Division HTTP walkthrough

Runtime evidence is produced by `node scripts/verify-division-http.cjs` and checked by
`node scripts/verify-division-evidence.cjs http`. The recording is `http-evidence.json`
in this directory.

Executed: 2026-09-15. **Result: PASS — 24 curl requests, 0 blockers, fixture cleanup PASS.**

Host: production `AppModule` with background workers, messaging and throttler disabled and
Redis reads uncached; all HTTP traffic runs as `app_user` through the ordinary fail-closed
Tenant UnitOfWork and RLS. Fixture setup, direct row inspection, and cleanup use the
maintenance connection only.

Methods exercised: POST, GET, PATCH, DELETE. Statuses: 200, 201, 204, 400, 401, 403, 404, 409.

## Checks proven

- Create/list/detail/update/delete pass through app_user Tenant scope
- Foreign Tenant Division access is indistinguishable from missing
- Guarded hard delete refuses a dependent Division

Trimming is asserted on create (`' Engineering '` → `Engineering`), the response is confirmed
to expose no `tenantId`/`companyId`, pagination returns the expected single row, and a
`division_member` actor is refused with 403.

## Previous attempt (2026-09-09): superseded

The earlier run was recorded as BLOCKED for two reasons, both since resolved:

1. **`POST /division` with an unknown `divisionTypeId` returned 500 instead of the contracted
   400.** Fixed by the `assertDivisionType` precheck in `division.service.ts`. The
   `/division (unknown type)` request in this run returns **400 `BAD_REQUEST`**.
2. **`app_user` was reported as holding only `SELECT` on `public.divisions`.** That catalog
   reading predates `20260910142000_app_user_organization_module_grants`. A read-only check on
   2026-09-15 (`node scripts/verify-organization-grants.cjs`) confirms `app_user` now holds
   `DELETE, INSERT, SELECT, UPDATE` on `divisions` and `members`, and `SELECT` on
   `division_types`.

A third blocker, not recorded at the time, also had to clear: the development database was
unseeded, so `POST /company/signup` — the fixture entry point for every walkthrough in this
repository — failed with `P0002` out of `provision_company_workspace`. The owner ran
`yarn db:seed` on 2026-09-15.

`scripts/identity-http-host.cjs` also spawned `curl.exe` unconditionally, so no walkthrough
could run outside Windows; it now selects the binary by platform.

No schema, migration, seed, grant, or RLS change was applied by this walkthrough.
