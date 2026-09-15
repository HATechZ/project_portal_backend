# Module 05 - Tasks

## Implementation

- [ ] Add approved Client-management permission capabilities.
  VERIFY: `Select-String -Path prisma/schema.prisma,prisma/seed/data/permissions.data.ts -Pattern "MANAGE_CLIENT|MANAGE_CLIENT_CONTACT|MANAGE_CLIENT_PORTAL_ACCESS"`
- [ ] Implement the one-action Create Client onboarding API in the Client module.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Create Client atomically creates Client plus initial active Primary ClientContact and derives
  Tenant/Company from authenticated context.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Reject Client onboarding bodies containing tenant/company/role/User/ActorProfile/password
  control fields and never expose password or setup-token material.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] When enablePortalAccess is false, Create Client creates no User, UserRole, ActorProfile,
  session, or password-setup state.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] When enablePortalAccess is true, Create Client provisions or establishes User,
  client_owner UserRole, ClientContact-linked ActorProfile, and secure one-time password setup.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Implement Client list/get/update APIs in the Client module.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Implement Deactivate Client and Reactivate Client using `isActive`.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Ensure inactive Clients are readable to authorized administrators but excluded from new
  business selectors.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Implement nested ClientContact add/list/get/update APIs inside the Client module boundary.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Implement Deactivate Client Contact and Reactivate Client Contact using `isActive`.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Ensure inactive ClientContacts cannot be used for new portal or workflow operations.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Implement Set Primary Client Contact with atomic previous-primary unset and a concurrency-safe
  zero-or-one-active-primary backstop.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Ensure deactivating the active primary contact clears primary state and leaves no active
  primary unless another is explicitly selected.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Implement Grant Client Portal Access provisioning/setup orchestration using existing Identity
  password-reset/setup security behavior.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Implement Revoke Client Portal Access using existing Identity/UserRole/ActorProfile behavior.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Ensure additional ClientContact creation does not auto-create User, UserRole, ActorProfile,
  invitations, passwords, sessions, or credentials; initial Create Client follows its explicit
  enablePortalAccess contract.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Ensure portal access grant is idempotent and reuses valid User/UserRole/ActorProfile state.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Ensure `client_owner` can access only own Client context and cannot administer Client master
  data, contacts, primary contact, portal access, or Identity.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Ensure CCR can read/select active Client/ClientContact only through authorized
  Bid/Project/workflow context and cannot administer Clients.
  VERIFY: `yarn test --runInBand --testPathPattern=client`
- [ ] Ensure Client/client_owner cannot create/manage Bid, Project, WorkRequest, Division/Team
  routing, or internal workflow.
  VERIFY: `yarn test --runInBand --testPathPattern=client`

## Verification

- [ ] Run focused spec verification for module 05.
  VERIFY: `yarn verify:sdd --module 05`
- [ ] Complete Gate 5 HTTP/RLS walkthrough for Client and ClientContact endpoints.
  VERIFY: `Get-Content specs/05-clients/walkthrough.md | Select-String "PASS"`

## Definition of Done

- [ ] `complete spec 05-clients` can execute from this task list without broad repo re-audit.
  VERIFY: `yarn verify:sdd --module 05`
- [ ] No normal hard-delete API exists for Client or ClientContact.
  VERIFY: `Select-String -Path src/client/**/*.ts -Pattern "@Delete|deleteClient|deleteContact"`
- [ ] No runtime schema relationship is added for Client leadership or one-owner-per-Client.
  VERIFY: `Select-String -Path prisma/schema.prisma -Pattern "leadMemberId|clientLead|team_lead|prime_consultant"`
- [ ] Only approved Client-related permission/schema changes are present, if any.
  VERIFY: `git diff -- specs/05-clients specs/INDEX.md`
