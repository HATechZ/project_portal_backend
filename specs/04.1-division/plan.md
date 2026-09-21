# Technical Plan: 04.1 — Division

**Status:** Gate 3 · approved target · not implemented  
**Contracts:** `SPEC.md` · `DATA_CONTRACT.md` · `API_CONTRACT.md`

## 1. Module tree

`src/division/` contains its module, controller, service, DTOs, response mapper/provider, and
`repositories/division.repository.ts`. It imports no feature module. The controller only routes;
the service makes authorization/domain decisions; the repository extends `BaseRepository` and
uses `this.db` only inside an ambient Tenant UnitOfWork.

## 2. Repository and service surface

| Operation | Responsibility | Transaction |
|---|---|---|
| list/detail | Tenant-scoped query plus total-order pagination | joins ambient read UnitOfWork |
| create | resolve scoped Company, normalize/validate name, validate global DivisionType, insert allow-list | one Tenant UnitOfWork |
| update | find scoped target, normalize/duplicate-check name excluding target, precheck supplied type, update allow-list only | one Tenant UnitOfWork |
| assign Division Lead | validate Division and same-Division Member, require linked User, ensure `division_lead` UserRole/ActorProfile, link profile to Member | one serializable Tenant UnitOfWork |
| delete | find scoped target, probe all five inverse relations, hard delete only when clear | one Tenant UnitOfWork; serialization/restrictive FK backstop |

DTOs enforce UUIDs and trimmed field bounds. The service receives trusted context, never a
Tenant/Company DTO value. The guard chain enforces active configured `ADD_DIVISION`; it does not
special-case an ActorRole or bypass permissions. Domain 404/409 are explicit AppExceptions;
Prisma exceptions remain uncaught until the global mapper.

Before the normalized-name database unique is introduced, implementation must run a blocking
Tenant/Company duplicate preflight and report collisions without changing existing rows.

## 3. Events, security, and verification

No cross-feature import or transport write is needed for this CRUD scope; do not add an event
merely for organizational CRUD. Tests cover validation, scoped repository predicates, full
authorization matrix, unique/race mapping, dependency blocking, and no side-effect creation.
Runtime walkthrough must use real app_user/RLS, record envelopes/request IDs and both Tenant
directions, create only isolated fixtures, and clean them after every outcome. No DB write or
grant is part of specification work.
