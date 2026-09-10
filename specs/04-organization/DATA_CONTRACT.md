# Data Contract: 04 — Organization

## Tables owned in the approved slice

`company_types`: global reference data; UUID id, name, nullable description.
`companies`: UUID id and tenantId, name (180), abbr (30), workspaceSlug (100),
nullable companyTypeId UUID, isActive, createdAt and updatedAt timestamps.

Company belongs to the Module 01.1 Tenant and references global CompanyType.
Unique tenantId enforces at most one Company per Tenant; signup creates the pair atomically.
Abbreviation is unique per Tenant. workspaceSlug is globally unique and immutable.
Existing legacy null CompanyTypes remain readable; signup and retype require an existing UUID.
No enums or derived workflow state are owned by this slice.

## Writes and isolation

Signup calls the existing narrow `public.provision_company_workspace` function as app_user.
It generates UUID v4 IDs and atomically provisions Tenant, Company, initial User, system_admin
UserRole, default role-only ActorProfile and approved permission matrix. Only a password hash
crosses the provisioning boundary; password confirmation is validation-only.

Company reads and partial name/type updates use the existing Tenant UnitOfWork and RLS.
Updates explicitly select writable fields and set updatedAt. They cannot move a Company,
change its slug, create a second Company, or change activation. FK/unique constraints remain
authoritative under races; shared exception translation handles database errors.

## Migration impact and deferred scope

None: no schema, migrations, grants, RLS policies or provisioning-function changes.
DivisionType values remain deferred. Division, Member, Team, and the existing `team_members`
relation are specified but unimplemented in `04.1-division` → `04.2-member` → `04.3-team`.
Those contracts honor existing Tenant/Company/Division composite relationships; `team_members`
belongs to Team and is not a separate module. Member creation is scoped in the Member contract
and does not write Team membership; Team membership add/remove is scoped in the Team contract.
Company lifecycle deactivation/deletion is not approved and requires a separate product contract.

## Observed runtime prerequisite (2026-09-08)

Read-only catalog verification found app_user SELECT on companies and company_types, but no
UPDATE on companies. Valid PATCH consequently returns 500 in the current database. The owner
must provision the existing-table UPDATE privilege (for example `GRANT UPDATE ON TABLE
public.companies TO app_user;`) through the approved deployment process, then rerun the Company
HTTP verifier. No schema change is necessary; this task applies no grant and does not bypass RLS.
