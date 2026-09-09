# Division HTTP walkthrough

Runtime evidence is produced by `node scripts/verify-division-http.cjs` and checked by
`node scripts/verify-division-evidence.cjs http`.

Attempted: 2026-09-09. Command: `node scripts/verify-division-http.cjs`.

Result: BLOCKED before valid CRUD evidence. The first sandboxed attempt could not reach the
configured PostgreSQL host. The escalated attempt reached the app and database, but
`POST /division` with an unknown `divisionTypeId` returned 500 instead of the contracted 400.
A read-only catalog check using the maintenance connection showed:

| table | grantee | privilege |
|---|---|---|
| public.divisions | app_user | SELECT |

No app_user grant was reported for `public.division_types`; no INSERT/UPDATE/DELETE grants were
reported for `public.divisions`. No grant, migration, schema, seed, or RLS change was applied.
Gate 5 remains blocked on the owner-side database privilege prerequisite recorded in
`DATA_CONTRACT.md`.
