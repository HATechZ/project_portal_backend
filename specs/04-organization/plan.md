# Technical Plan: 04 — Organization

Contracts: SPEC.md, API_CONTRACT.md, DATA_CONTRACT.md. Status belongs in ../INDEX.md.

## Components

- CompanySignupController -> CompanySignupService -> CompanySignupRepository -> existing
  narrow provisioning function. DTO validation runs before hashing. Only eight mapped fields,
  including password hash, cross the provisioning boundary; confirmation stays in validation.
- CompanyTypeController -> CompanyService -> CompanyQueryProvider -> CompanyRepository public
  reference read. No Tenant context or relay connection is needed.
- CompanyController -> CompanyService -> CompanyQueryProvider -> scoped CompanyRepository
  for list/detail. Shared pagination returns items/meta ordered name asc, id asc.
- CompanyController -> CompanyService -> CompanyUpdateService -> CompanyRepository for PATCH.
  UpdateCompanyDto accepts only name/type. Service rejects empty patches, checks Company before
  type validity to conceal foreign records, and maps the result using the existing mapper.

## Authorization and persistence

CompanyController applies AccessTokenGuard -> TenantContextGuard -> AuthenticationGuard ->
ObjectScopeGuard -> SystemAdminGuard -> PermissionsGuard to reads/updates. system_admin is
required; no additional workflow action permission is attached. JWT Tenant is authoritative.

CompanyRepository extends BaseRepository. Operations join/open the normal Tenant UnitOfWork
under app_user/RLS. Update is one mapped statement for supplied fields plus updatedAt. Identity,
abbreviation, slug, Tenant and activation are never included. Prechecks improve domain errors;
FK/unique constraints and RLS remain authoritative under races. Same-field updates use last
commit wins, and omitted fields are preserved. Shared Prisma translation handles conflicts.

Signup's existing SECURITY DEFINER function is its atomic boundary. It resolves system_admin,
creates the default role-only profile and approved permission matrix. No schema/function/grant
changes or cross-feature imports are introduced; app_relay remains outside this module.

## Verification

1. Focused DTO/service/repository and HTTP boundary tests without external services.
2. Production AppModule curl walkthrough using real app_user/RLS, isolated background workers,
   temporary workspaces/types and cleanup. Cover signup, pagination, reads, updates, validation,
   authorization, two-way Tenant isolation, rollback, envelopes and request IDs.
3. Full Jest, lint, build, Prisma validate, Tenant-scope and spec verification.
4. Independent task verification before ticking leaves and reconciling INDEX.

Company lifecycle and the five Division/Member/Team tables remain explicitly deferred.
