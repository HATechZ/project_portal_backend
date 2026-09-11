# Module 05 - Implementation Plan

## Scope

Build the Client module around `clients` and `client_contacts` only. Reuse existing Identity,
UserRole, ActorProfile, TenantContext, UnitOfWork, BaseRepository, permissions, and object-scope
frameworks.

Do not change schema relationships. Permission enum/seed changes are limited to the approved
Client-management capabilities in this spec.

## Sequence

1. Add the approved Client-management permission capabilities:
   - `MANAGE_CLIENT`;
   - `MANAGE_CLIENT_CONTACT`;
   - `MANAGE_CLIENT_PORTAL_ACCESS`.
2. Add Client DTOs, repository methods, service, controller, and module registration using existing
   module conventions.
3. Implement Client create/list/get/update/deactivate/reactivate with TenantContext, Company scope,
   configured permissions, and active selector behavior.
4. Add nested ClientContact DTOs, repository/service methods, and controller routes inside the
   Client module boundary.
5. Implement ClientContact add/list/get/update/deactivate/reactivate and Set Primary Client
   Contact. Set Primary must atomically unset the previous active primary.
6. Add Grant Client Portal Access:
   - validate active Client and Contact scope;
   - validate existing same-tenant User;
   - link ClientContact.userId;
   - ensure/reuse `client_owner` UserRole;
   - ensure/reuse ActorProfile linked to ClientContact;
   - delegate activation/default behavior to Identity services.
7. Add Revoke Client Portal Access using existing Identity/UserRole/ActorProfile behavior while
   preserving history.
8. Add CCR active Client/ClientContact selector reads only for authorized Bid/Project/workflow
   context.
9. Add focused unit/integration tests for scope, idempotency, lifecycle, primary contact, and
   forbidden cross-object access.
10. Run focused SDD and HTTP/RLS verification required by repository rules.

## Non-Goals

- No Client-created Bids, Projects, Work Requests, or internal workflow transitions.
- No Division/Team routing from Client or client_owner APIs.
- No client_owner Client administration.
- No CCR general Client administration.
- No User/password/invitation/session invention.
- No new ClientLead table, Division changes, Member changes, Team Lead role, `prime_consultant`,
  BYPASSRLS, `app_relay`, or wildcard admin bypass.
