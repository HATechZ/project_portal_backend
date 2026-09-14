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
3. Implement the single Create Client onboarding action: derive Tenant/Company, create Client plus
   initial active Primary ClientContact, and conditionally provision portal identity/setup state
   from `enablePortalAccess` without accepting password or identity-control fields.
4. Implement Client list/get/update/deactivate/reactivate with TenantContext, Company scope,
   configured permissions, and active selector behavior.
5. Add nested ClientContact DTOs, repository/service methods, and controller routes inside the
   Client module boundary.
6. Implement ClientContact add/list/get/update/deactivate/reactivate and Set Primary Client
   Contact. Set Primary must atomically unset the previous active primary.
7. Add Grant Client Portal Access:
   - validate active Client and Contact scope;
   - provision or establish same-Tenant User identity without accepting User ID or password;
   - link ClientContact.userId;
   - ensure/reuse `client_owner` UserRole;
   - ensure/reuse ActorProfile linked to ClientContact;
   - initiate the existing one-time, expiring password setup lifecycle and delegate
     activation/default behavior to Identity services.
8. Add Revoke Client Portal Access using existing Identity/UserRole/ActorProfile behavior while
   preserving history.
9. Add CCR active Client/ClientContact selector reads only for authorized Bid/Project/workflow
   context.
10. Add focused unit/integration tests for scope, idempotency, lifecycle, primary contact,
   onboarding/setup, and
   forbidden cross-object access.
11. Run focused SDD and HTTP/RLS verification required by repository rules.

## Non-Goals

- No Client-created Bids, Projects, Work Requests, or internal workflow transitions.
- No Division/Team routing from Client or client_owner APIs.
- No client_owner Client administration.
- No CCR general Client administration.
- No administrator-created password, password exposure, or duplicate invitation/setup-token system.
- No new ClientLead table, Division changes, Member changes, Team Lead role, `prime_consultant`,
  BYPASSRLS, `app_relay`, or wildcard admin bypass.
