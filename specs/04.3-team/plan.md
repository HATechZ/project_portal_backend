# Technical Plan: 04.3 — Team

**Status:** Gate 3 · approved target · not implemented  
**Dependencies:** `04.2-member` complete first; **Contracts:** `SPEC.md`, `DATA_CONTRACT.md`, `API_CONTRACT.md`

## Components and boundaries

`src/team/` owns controller, service, Team/membership DTOs, mappers/providers, and repositories
extending `BaseRepository`. It imports no feature module. Controller routes only; service resolves
Team object scope and contextual lead authority; repositories use `this.db` through the ambient
Tenant UnitOfWork. `team_members` belongs here, so do not create a TeamMember module, service,
controller, or specification.

## Operations and transactions

| Operation | Atomic records | Authorization rule |
|---|---|---|
| Team CRUD / assign lead | Team, Division and candidate Member reads | system_admin or scoped division_lead; `ADD_TEAM` |
| add/end membership | Team, actor profile/member scope, candidate Member, active membership | system_admin/scoped division_lead or exact contextual lead; `ASSIGN_MEMBER`; existing or separately newly created Member only |
| delete | Team and all membership history probe | Team-management scope; hard delete only if probe clear |

The scope resolver obtains actor Member from active ActorProfile. For division_lead it compares
that Member's Division to Team Division. For contextual lead it additionally compares Member ID
to `leadMemberId` and admits only membership add/end routes for the exact Team they lead. All
Member/lead candidates are scoped by Tenant/Company/Division and active status before write.
Add/end serializes or locks the active association to prevent duplicate active rows; end sets
`leftAt`. Use AppExceptions for
semantic 403/404/409 and let central Prisma mapping handle database races.

## Verification

Focused tests must prove all system-admin, division-lead, contextual-lead, and denied cases;
cross-Tenant/Company/Division Member rejection; active/history membership semantics; no Member,
User, role, or Team Lead role creation inside Team routes; no automatic Team assignment from
Member creation; and Team delete blocking. HTTP/RLS evidence uses app_user, isolated fixtures and
cleanup, records each route/envelope/error/request ID, and proves both Tenant directions. No
workflow event, transport write, or schema/grant change is introduced.
