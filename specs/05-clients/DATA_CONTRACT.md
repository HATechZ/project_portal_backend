# Module 05 - Data Contract

## Tables

Module 05 owns:

- `clients`
- `client_contacts`

Identity-owned tables used by portal access:

- `users`
- `user_roles`
- `actor_profiles`

Workflow-owned tables that may reference Client data later:

- `projects`
- `project_credential_deliveries`
- `workflow_info_requests`

## clients

| Field | Contract |
| --- | --- |
| `tenant_id` | Server-derived from TenantContext; never trusted from request body. |
| `id` | Server-generated UUID. |
| `company_id` | Server-derived where Company context is known; caller-forbidden. Nullable in current schema. |
| `name` | Required customer organization name, max 180. Indexed, not unique. |
| `is_active` | Lifecycle flag. New Clients start active. Deactivate/Reactivate update this field. |
| `created_at` / `updated_at` | Server-managed timestamps. |

Relationships:

- one Client has many ClientContacts;
- one Client has many Projects;
- Client is tenant-scoped and company-aware.

Lifecycle:

- no normal hard-delete API;
- deactivation preserves ClientContacts, Bid/Project, Workflow, and audit history;
- inactive Clients are readable to authorized administrators;
- inactive Clients are not selectable for new Bid/Project/Workflow business records.

## client_contacts

| Field | Contract |
| --- | --- |
| `tenant_id` | Server-derived from TenantContext; never trusted from request body. |
| `id` | Server-generated UUID. |
| `user_id` | Nullable existing User link for portal login; only changed by portal access operations. |
| `client_id` | Required parent Client; route-derived and scope-checked. |
| `name` | Required contact name, max 160. |
| `email` | Required email, max 255; unique per `(tenant_id, client_id, email)`. |
| `designation` | Optional, max 140. |
| `phone` | Optional, max 60. |
| `is_primary` | Primary contact flag. At most one active contact per Client may have this true. |
| `is_active` | Lifecycle flag. New contacts start active. Deactivate/Reactivate update this field. |
| `created_at` / `updated_at` | Server-managed timestamps. |

Relationships:

- ClientContact belongs to one Client.
- ClientContact may link to one User.
- ClientContact may have ActorProfiles.
- ClientContact may be referenced by credential delivery and workflow information request records.

Lifecycle:

- no normal hard-delete API;
- deactivation preserves ActorProfile, workflow, credential-delivery, and history references;
- inactive contacts are readable to authorized administrators;
- inactive contacts cannot be used for new portal or workflow operations;
- deactivating the active primary contact clears `is_primary`.

Create Client onboarding:

- one Create Client action creates the Client and initial active Primary ClientContact together;
- the request receives Client business fields, primary-contact business fields, and
  `enablePortalAccess` only; Tenant, Company, IDs, User, role, ActorProfile, and password fields
  are server-managed and caller-forbidden;
- `enablePortalAccess: false` creates no identity or setup records;
- `enablePortalAccess: true` provisions or establishes the primary contact's User identity,
  `client_owner` UserRole, ClientContact-linked ActorProfile, and secure password setup through
  the existing Identity reset-token lifecycle.

Primary contact:

- a Client may have zero or one active Primary Contact;
- setting a new primary atomically unsets the previous primary;
- selected primary contact must be active and belong to the Client;
- primary status does not imply User, portal access, or `client_owner`.
- concurrent writes must preserve this zero-or-one-active-primary invariant; implementation must
  use a database-enforced or transactionally serialized backstop, not a read-then-write check.

## Portal Access Data Contract

Client-side portal access uses the existing identity graph:

```text
client_contacts.user_id -> users.id
users.id -> user_roles.user_id with role code client_owner
user_roles.id -> actor_profiles.user_role_id
actor_profiles.client_contact_id -> client_contacts.id
```

Rules:

- The Client and ClientContact must be active for new portal access grants.
- The backend provisions or establishes the User identity under the existing globally canonical
  email and Tenant ownership rules; callers do not supply User identity or password fields.
- The established User belongs to the same Tenant as the ClientContact.
- The ActorProfile must target the same ClientContact.
- `client_owner` access is scoped through ActorProfile -> ClientContact -> Client.
- One Client may have multiple ClientContacts with `client_owner` portal access.
- Repeated portal access grant must reuse valid User, UserRole, and ActorProfile state when
  possible and must not duplicate access state.
- Revocation preserves historical references and makes the affected acting context unavailable for
  new portal/workflow operations.
- Initial Create Client onboarding creates identity/setup state only when `enablePortalAccess` is
  true. Additional ClientContact creation creates no identity state; a later portal-access grant
  follows the same provisioning/setup pattern.
- Setup tokens follow the existing PasswordResetToken security model: random, stored only as a
  hash, one-time, expiring, and never returned in ordinary API payloads or logs. Production uses
  configured email/notification delivery; development may inspect the same secure delivery flow.

## Permission Data Contract

Current permission/action data contains client-side workflow codes but no suitable Client
administration codes. Implementation must add only these minimum Client-management capabilities:

- `MANAGE_CLIENT`
- `MANAGE_CLIENT_CONTACT`
- `MANAGE_CLIENT_PORTAL_ACCESS`

These are administration capabilities and must remain separate from workflow actions such as
`CLIENT_PROVIDE_INFO`, `CLIENT_ACCEPT_FINAL`, `CLIENT_REJECT_FINAL`, and
`CLIENT_REQUEST_REVISION`.

## Scope and RLS Expectations

- All repository reads and writes include TenantContext.
- Object-scope checks prevent cross-Client `client_owner` access.
- Cross-tenant, cross-company, and cross-Client contact leakage is denied.
- No business API uses BYPASSRLS, `app_relay`, broad grants, or wildcard system_admin bypass.
