# SPEC: 04 — Organization

Contracts: `API_CONTRACT.md`, `DATA_CONTRACT.md`. Status belongs in `../INDEX.md`.

## Approved scope and stories

Company and global CompanyType are the implemented organization slice. Tenant is the internal
security boundary and Company the business organization. Signup atomically creates the pair;
the unique Tenant foreign key prevents a second Company in that Tenant. The approved, unimplemented
Division, Member, and Team contracts are respectively `04.1-division`, `04.2-member`, and
`04.3-team`; they are the only next Organization implementation order.

| Story | Actor | Requirement |
|---|---|---|
| US-01 | Prospective administrator | Create a Company workspace through public signup |
| US-02 | Same-Tenant system_admin | List and retrieve the Tenant's Company |
| US-03 | Public visitor | Read CompanyType options before signup |
| US-04 | Same-Tenant system_admin | Rename/retype the Company without changing identity or slug |

## Domain rules

- DR-01: Company is Tenant-owned; each Tenant has at most one Company. Public signup is the
  sole creation route; POST /company is retired.
- DR-02: CompanyTypes are global. Both reference and scoped paths use app_user, never app_relay.
- DR-03: Abbreviations are unique per Tenant, not globally. Signup trims name and abbreviation.
- DR-04: Signup/retype require an existing CompanyType UUID. Legacy null types remain readable.
- DR-05: The existing provisioning function generates UUID v4 IDs in PostgreSQL.
- DR-06: Company reads/updates require an active same-Tenant system_admin actor/session.
  Verified JWT establishes Tenant; caller x-tenant-id cannot override it. Signup/type reads
  are public and require neither a token nor a Tenant header.
- DR-07: Required company/admin objects reject omission, null, arrays and primitives with 400
  before hashing/provisioning. Nested fields and accepted terms are validated at the edge.
- DR-08: Division, Member, and Team writes must honor Tenant/Company/Division composite FKs;
  their detailed rules belong only to 04.1 → 04.2 → 04.3.
- DR-09: workspaceSlug is generated internally, globally unique and immutable. It is public
  information, not a credential. Login remains email/password only.
- DR-10: PATCH accepts only optional name/companyTypeId, with at least one supplied. Null and
  unknown fields are rejected. Only supplied fields and updatedAt change. Concurrent writes
  to the same field use last committed write wins; omitted fields are never overwritten.

Signup's existing atomic function creates Tenant, Company, initial User, system_admin UserRole,
default active role-only ActorProfile and approved permission matrix. It creates no fake Member
or ClientContact. Any failure rolls everything back. Only a password hash reaches provisioning;
confirmPassword must match exactly and is never hashed, persisted or passed to the function.

## Acceptance criteria

- AC-U01: Every Company read/update is confined to the verified JWT Tenant and system_admin.
- AC-U02: CompanyTypes are publicly readable and unscoped.
- AC-E01: Signup returns 201; duplicate normalized administrator email returns 409 and leaves
  no partial workspace.
- AC-E02: Unknown CompanyType returns 400; rejected updates leave Company unchanged.
- AC-E03: Lists use shared pagination ordered name asc, id asc.
- AC-E04: Partial rename/retype returns 200 and preserves Tenant, id, abbreviation, slug and
  activation. Missing/foreign Company IDs are indistinguishable 404s.
- AC-S01: Missing/invalid bearer authentication returns 401; non-admin access returns 403.
- AC-W01: Missing/null signup objects and invalid update fields return 400.
- AC-W02: Request IDs are echoed on success/error using existing platform envelope shapes.

## Errors and constraints

Malformed UUIDs and DTOs return 400. Missing records return 404 naming the ID. Domain errors
stay in services; shared Prisma translation maps P2002/P2003/P2034 to conflict and P2025 to
404. Signup validation SQLSTATEs map centrally to 400. A type deleted after update precheck
is a constraint conflict (409), not an unhandled 500. No feature-level Prisma catch is added.

## Explicitly deferred

Company deactivate/delete is not approved. DivisionType values, Division, Member, Team, and the
existing Team membership relation are governed by the three child contracts and remain
unimplemented. The membership relation is owned by Team, not a fourth Organization module.
Clients, workflows and frontend slug routing remain outside this scope.

No schema, migration, grant or RLS changes are required. The DBML source named by repository
rules is absent from this working tree; this contract records targeted existing Prisma models
and migrations, without proposing schema changes. Vault sync is skipped because no vault server
is connected; no separate vault files are written.
