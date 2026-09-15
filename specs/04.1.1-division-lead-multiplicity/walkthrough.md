# Division Lead HTTP walkthrough

Runtime evidence is produced by `node scripts/verify-division-lead-http.cjs` and checked by
`node scripts/verify-division-lead-evidence.cjs`. The recording is
`http-evidence.json` in this directory.

Executed: 2026-09-15. **Result: PASS — 28 curl requests, 0 blockers, fixture cleanup PASS.**

Host: production `AppModule` with background workers, messaging and throttler disabled and
Redis reads uncached; all HTTP traffic runs as `app_user` through the ordinary fail-closed
Tenant UnitOfWork and RLS. Fixture setup, direct row inspection, and cleanup use the
maintenance connection only.

Statuses exercised: 200, 201, 204, 400, 401, 403, 404, 409.

## Behaviors proven

| # | Check | Spec |
|---|---|---|
| 1 | A Member leads a Division it does not belong to | AC-E01, DR-04 |
| 2 | One Member holds active Lead rows for two Divisions | AC-E02, DR-02 |
| 3 | Re-assigning the sitting Lead is an idempotent no-op | DR-03 |
| 4 | Assigning a new Lead revokes the incumbent, leaving exactly one | AC-E03, DR-03 |
| 5 | Member led-Divisions read returns only active rows | DR-06 |
| 6 | A Lead-less Division reads as null and revokes as 404 | DR-10 |
| 7 | A Member revoked from a Division can be re-assigned to it | AC-W02, DR-07 |
| 8 | Foreign Tenant lead access is indistinguishable from missing | AC-U01 |
| 9 | A role without `ASSIGN_LEADER` is refused the lead routes | DR-12 |
| 10 | Division hard delete is refused while lead history exists | AC-W03, DR-11 |

Checks 2, 4 and 7 assert against `division_leads` rows directly over the maintenance
connection rather than trusting the response body — the active-row set is read back after each
mutation. Check 4 additionally asserts the Division has exactly one active row afterwards, so
a failure of the `division_leads_one_active_per_division` partial unique index would surface
here rather than silently permitting two Leads. The 409 for a Member with no linked User also
asserts that zero rows were written (AC-W01).

## Prerequisites resolved during this run

**Unseeded database.** The first attempt failed at `POST /company/signup` with HTTP 500;
`provision_company_workspace` raised `P0002 query returned no rows` from its
`SELECT ... INTO STRICT` on `roles`, which held 0 rows. The owner ran `yarn db:seed`, which
resolved it. No seed, schema, migration, grant, or RLS change was applied by this walkthrough.

**Grant blockers were stale.** Read-only catalog checks
(`node scripts/verify-organization-grants.cjs`, `node scripts/identity-environment.cjs`)
confirm `app_user` already holds what this module needs; the blockers previously recorded
against `03`, `04.1` and `04.2` predate `20260910142000_app_user_organization_module_grants`:

| table | app_user privileges |
|---|---|
| `divisions`, `members`, `teams` | DELETE, INSERT, SELECT, UPDATE |
| `actor_profiles` | INSERT, SELECT, UPDATE |
| `division_leads` | INSERT, SELECT, UPDATE — **no DELETE**, as specified |
| `companies` | **INSERT, SELECT only — no UPDATE** |

`division_leads` matches its contract exactly, including the withheld DELETE, so revocation
can only ever be a timestamp write. The one remaining real blocker is `companies` lacking
UPDATE, which affects module `04`'s rename/retype verification, not this module.

## Fixes required to run at all

- `scripts/identity-http-host.cjs` spawned `curl.exe` unconditionally, so no walkthrough in
  this repository could run outside Windows. It now selects `curl.exe` only on `win32`.
- The fixture `INSERT INTO members` omitted the NOT NULL `role_title` column.
