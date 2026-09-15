# Member HTTP walkthrough

Attempted: 2026-09-09. App started with the production AppModule and normal app_user/RLS
path. Login as the seeded system administrator succeeded and reported `ADD_MEMBER`.

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
| Authentication | PASS: seeded `system_admin` login returned `ADD_MEMBER` |
| Scoped Company read | PASS: `GET /api/v1/company` returned one same-Tenant Company |
| Division fixture cleanup | PASS: final `GET /api/v1/division` returned zero items |
| Member create | BLOCKED: `POST /api/v1/member` returned 500 due to app_user lacking `members` write privilege |
