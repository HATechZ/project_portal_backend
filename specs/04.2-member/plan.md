# Technical Plan: 04.2 — Member

**Status:** Gate 3 · approved target · not implemented  
**Dependencies:** `04.1-division` complete first; **Contracts:** `SPEC.md`, `DATA_CONTRACT.md`, `API_CONTRACT.md`

## Components and boundaries

`src/member/` owns controller, service, DTOs, mapper/providers, and repositories extending
`BaseRepository`. It imports no feature module. Controller routes only; service evaluates
system_admin, division_head, division_lead, and exact `team_lead` create/provisioning scope plus
Member rules;
repositories use ambient `this.db` and do not instantiate Prisma. The narrow
access-link repository is data-integrity orchestration, not a copy of auth/password/session or
role-grant logic; it must not import the Identity module.

## Operations and transactions

| Operation | Atomic records | Rule |
|---|---|---|
| create | Member plus scoped Division and actor profile/member/team context reads | one Tenant UnitOfWork; no Team assignment write |
| update/delete | Member plus scoped Division/dependency reads | one Tenant UnitOfWork; existing authority unchanged; deletion probes every inverse first |
| access link | Member, User/profile/active-role reads; Member user link and optional ActorProfile member target | serializable Tenant UnitOfWork to prevent link races |

Create resolves the Division scoped by Tenant/Company plus actor authority: Company-wide for
system_admin, configured own-Company Division scope for division_head, actor Member Division for
division_lead, and exact led Team scope for `team_lead`. Leadership assignment validates
system_admin -> own Company, division_head -> own Company / target Division, division_lead -> own
Division / target Team, and team_lead -> exact Team. Update resolves the Division under the
existing update authority. The existing
composite FK is a backstop. Access-link locks/rechecks Member and relevant User/Profile state; it returns 404 for
foreign IDs and 409 for incompatible visible link state. Ordinary Member mutation never changes
a User link. Use explicit AppExceptions for semantic 404/409 and leave Prisma errors to the
global filter.

## Verification

Tests distinguish all four access steps, prove User/role assignment creates no Member, prove
Member can lack User/Team, cover exact link validations, every delete dependency, two-Tenant
isolation, scoped system_admin/division_head/division_lead/team_lead create cases, and denied
cross-scope actors. Runtime verification uses app_user/RLS with temporary fixtures and cleanup,
records every endpoint/error/envelope/request ID in `walkthrough.md`, and does not add DB grants.
Publish no organization workflow event for this CRUD/link scope.
