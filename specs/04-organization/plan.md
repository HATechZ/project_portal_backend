# Technical Plan: 04 — Organization

Contracts: SPEC.md, API_CONTRACT.md, DATA_CONTRACT.md. Status belongs in ../INDEX.md.

## Components

## 2026-10-07 starter-role provisioning delta

Extend the existing controlled provisioning function rather than adding a second setup path.
Ensure the three protected tenant Roles and their explicit grants in the same transaction as
Tenant/Company creation; preserve the current tenant_super_admin bootstrap and its explicit
`DECIDE_BID_OUTCOME` exclusion. The repository remains a single narrow function call.

Starter provisioning is Phase B only. Phase A is feature authorization hardening outside this
module; Company signup must not become a bypass for unverified resource/assignment/state checks.

## Components

- CompanySignupController -> CompanySignupService -> CompanySignupRepository -> existing
  narrow provisioning function. DTO validation runs before hashing. Only eight mapped fields,
  including password hash, cross the provisioning boundary; confirmation stays in validation.
  The same SECURITY DEFINER transaction creates the three fixed demonstration Clients and their
  primary contacts for the new Tenant/Company, without creating portal identities.
- CompanyTypeController -> CompanyService -> CompanyQueryProvider -> CompanyRepository public
  reference read. No Tenant context or relay connection is needed.
- CompanyController -> CompanyService -> CompanyQueryProvider -> scoped CompanyRepository
  for list/detail. Shared pagination returns items/meta ordered name asc, id asc.
- CompanyController -> CompanyService -> CompanyUpdateService -> CompanyRepository for PATCH.
  UpdateCompanyDto accepts only name/type. Service rejects empty patches, checks Company before
  type validity to conceal foreign records, and maps the result using the existing mapper.

## Authorization and persistence

CompanyController applies AccessTokenGuard -> TenantContextGuard -> AuthenticationGuard ->
ObjectScopeGuard -> TenantSuperAdminGuard -> PermissionsGuard to reads/updates. tenant_super_admin is
required; no additional workflow action permission is attached. JWT Tenant is authoritative.

CompanyRepository extends BaseRepository. Operations join/open the normal Tenant UnitOfWork
under app_user/RLS. Update is one mapped statement for supplied fields plus updatedAt. Identity,
abbreviation, slug, Tenant and activation are never included. Prechecks improve domain errors;
FK/unique constraints and RLS remain authoritative under races. Same-field updates use last
commit wins, and omitted fields are preserved. Shared Prisma translation handles conflicts.

Signup's existing SECURITY DEFINER function is its atomic boundary. It resolves tenant_super_admin,
creates the default role-only profile and approved permission matrix, then writes the three
fixed Client/ClientContact fixtures scoped to the newly created workspace. No public API or
cross-feature import is introduced; the function signature, return shape, and app_user execute
grant remain unchanged, and app_relay remains outside this module.

## Verification

1. Focused DTO/service/repository and HTTP boundary tests without external services.
2. Production AppModule curl walkthrough using real app_user/RLS, isolated background workers,
   temporary workspaces/types and cleanup. Cover signup, pagination, reads, updates, validation,
   authorization, two-way Tenant isolation, rollback, envelopes and request IDs.
3. Full Jest, lint, build, Prisma validate, Tenant-scope and spec verification.
4. Independent task verification before ticking leaves and reconciling INDEX.

Company lifecycle remains explicitly deferred. Division → Member → Team (including its existing
membership relation) is specified in child contracts and remains unimplemented; no fourth
membership module may be created. Member creation and Team assignment remain separate child
operations with Tenant/Company/Division scope enforced in their own contracts.
