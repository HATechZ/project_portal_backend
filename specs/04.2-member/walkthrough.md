# Member HTTP walkthrough

Attempted: 2026-09-09. App started with the production AppModule and normal app_user/RLS
path. Login as the seeded tenant super administrator succeeded and reported `ADD_MEMBER`.

Result: BLOCKED before valid Member CRUD evidence. Fixture setup confirmed the Tenant has one
Company and no Divisions. A Division fixture was created through `POST /api/v1/division`; retry
returned the expected duplicate-abbr conflict, proving the first create committed. `POST
/api/v1/member` then returned 500; the server log showed Prisma P2039 / SQLSTATE 42501:
`permission denied for table members` from `db.member.create()`. The Division fixture was
deleted through HTTP and cleanup was confirmed by `GET /api/v1/division` returning zero items.

No grant, migration, schema, seed, or RLS change was applied. Gate 5 remains blocked on the
owner-side app_user Member write privilege prerequisite.

| Case | Evidence |
|---|---|
| App startup | PASS: Member routes mapped under `/api/v1/member`; database and Redis connected |
| Authentication | PASS: seeded `tenant_super_admin` login returned `ADD_MEMBER` |
| Scoped Company read | PASS: `GET /api/v1/company` returned one same-Tenant Company |
| Division fixture cleanup | PASS: final `GET /api/v1/division` returned zero items |
| Member create | BLOCKED: `POST /api/v1/member` returned 500 due to app_user lacking `members` write privilege |

## 2026-11-03 focused assignment eligibility verification

Automated verification (not a live HTTP walkthrough): 14 Division/Team/Member suites, 62 tests PASS. Independent verifier: 3 suites / 21 tests PASS for member-eligibility, division-lead.repository and team.service. Build and focused ESLint PASS. New GET /member/eligible requires exactly one Division/Team context, resolves Team Division from persisted data, returns active exact-Division same-Tenant candidates, preserves candidates with another same-Division Team membership, and includes active Team membership plus independent lead metadata. Tests cover target/resource-scope denial, inactive and foreign candidates, direct cross-Division lead/member writes, and Tenant predicates. No migration or live-data mutation was performed.
