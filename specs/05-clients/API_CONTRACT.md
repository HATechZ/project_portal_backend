# Module 05 - API Contract

All routes use the repository's normal version prefix and response envelope conventions.

## Client

### Create Client

`POST /client`

Swagger title: `Create Client`

Body:

```json
{
  "name": "DEME",
  "primaryContact": {
    "name": "John Smith",
    "email": "john.smith@deme.com",
    "phone": "+8801712345678",
    "designation": "Project Manager"
  },
  "enablePortalAccess": true
}
```

Behavior:

- creates the external customer organization and its initial active Primary ClientContact;
- derives Tenant and Company scope server-side;
- starts active;
- rejects caller-supplied `tenantId`, `companyId`, `roleId`, `userId`, `actorProfileId`,
  `password`, and `passwordHash`;
- when `enablePortalAccess` is false, creates no portal identity or setup state;
- when `enablePortalAccess` is true, provisions or establishes the primary contact's User,
  assigns `client_owner`, creates the ClientContact-linked ActorProfile, and initiates the
  existing secure one-time password setup flow;
- never returns a password, password hash, setup token, or session credential.

`abbr` is not part of this V1 request because no approved current Client field supports it.

Authorization:

- `system_admin` in own Tenant/Company with `MANAGE_CLIENT`.

### List Clients

`GET /client`

Swagger title: `List Clients`

Behavior:

- returns tenant/company-scoped Clients;
- supports active-only selector use for future Bid/Project modules;
- inactive Clients are excluded from selectors for new business records.

Authorization:

- `system_admin` in own Tenant/Company with `MANAGE_CLIENT`;
- CCR may read/select active Clients only in authorized Bid/Project/workflow context;
- `client_owner` may access own Client context only through approved client-side workflow
  surfaces.

### Get Client

`GET /client/:id`

Swagger title: `Get Client`

Behavior:

- returns one in-scope Client;
- denies cross-tenant and cross-company access.

### Update Client

`PATCH /client/:id`

Swagger title: `Update Client`

Body:

```json
{
  "name": "Acme Corporation"
}
```

Behavior:

- updates mutable Client business fields only;
- denies caller-supplied `tenantId`, `companyId`, `id`, `isActive`, or portal access fields.

Authorization:

- `system_admin` in own Tenant/Company with `MANAGE_CLIENT`.

### Deactivate Client

`PATCH /client/:id/deactivate`

Swagger title: `Deactivate Client`

Behavior:

- sets `isActive = false`;
- preserves Bid, Project, Workflow, ClientContact, and audit references;
- excludes the Client from new business selectors.

Authorization:

- `system_admin` in own Tenant/Company with `MANAGE_CLIENT`.

### Reactivate Client

`PATCH /client/:id/reactivate`

Swagger title: `Reactivate Client`

Behavior:

- sets `isActive = true`;
- does not automatically reactivate inactive ClientContacts.

Authorization:

- `system_admin` in own Tenant/Company with `MANAGE_CLIENT`.

## Client Contact

ClientContact routes are nested under Client to make Client scope explicit.

### Add Client Contact

`POST /client/:clientId/contact`

Swagger title: `Add Client Contact`

Body:

```json
{
  "name": "Jane Customer",
  "email": "jane@example.com",
  "designation": "Director",
  "phone": "+1-555-0100"
}
```

Behavior:

- validates the parent Client is in scope and active;
- creates the contact active and non-primary;
- enforces unique email per `(tenantId, clientId)`;
- does not create User, UserRole, ActorProfile, invitation, password, session, or credential
  delivery state.

Authorization:

- `system_admin` in own Tenant/Company with `MANAGE_CLIENT_CONTACT`.

### List Client Contacts

`GET /client/:clientId/contact`

Swagger title: `List Client Contacts`

Behavior:

- returns contacts under the route Client only;
- denies contacts from another Client, Company, or Tenant;
- supports active-only selector use for workflow communication.

### Get Client Contact

`GET /client/:clientId/contact/:contactId`

Swagger title: `Get Client Contact`

Behavior:

- validates the contact belongs to the route Client;
- denies cross-Client, cross-company, and cross-tenant reads.

### Update Client Contact

`PATCH /client/:clientId/contact/:contactId`

Swagger title: `Update Client Contact`

Body:

```json
{
  "name": "Jane Customer",
  "email": "jane@example.com",
  "designation": "Director",
  "phone": "+1-555-0100"
}
```

Behavior:

- updates mutable contact business fields only;
- denies caller-supplied `tenantId`, `clientId`, `id`, `userId`, `isActive`, `isPrimary`,
  UserRole, or ActorProfile fields.

Authorization:

- `system_admin` in own Tenant/Company with `MANAGE_CLIENT_CONTACT`.

### Deactivate Client Contact

`PATCH /client/:clientId/contact/:contactId/deactivate`

Swagger title: `Deactivate Client Contact`

Behavior:

- sets `isActive = false`;
- preserves ActorProfile, workflow, credential-delivery, and history references;
- makes the contact unavailable for new portal and workflow operations;
- if the contact was primary, clears `isPrimary` and leaves no active primary unless another is
  explicitly selected.

Authorization:

- `system_admin` in own Tenant/Company with `MANAGE_CLIENT_CONTACT`.

### Reactivate Client Contact

`PATCH /client/:clientId/contact/:contactId/reactivate`

Swagger title: `Reactivate Client Contact`

Behavior:

- sets `isActive = true`;
- does not automatically set the contact primary;
- does not automatically grant portal access.

Authorization:

- `system_admin` in own Tenant/Company with `MANAGE_CLIENT_CONTACT`.

### Set Primary Client Contact

`PATCH /client/:clientId/contact/:contactId/primary`

Swagger title: `Set Primary Client Contact`

Behavior:

- validates selected contact is active and belongs to the route Client;
- atomically unsets any previous primary contact for the Client;
- sets selected contact `isPrimary = true`;
- does not create User, portal access, or `client_owner`.

Authorization:

- `system_admin` in own Tenant/Company with `MANAGE_CLIENT_CONTACT`.

## Portal Access

### Grant Client Portal Access

`PUT /client/:clientId/contact/:contactId/portal-access`

Swagger title: `Grant Client Portal Access`

Behavior:

- validates Client in TenantContext and Company scope;
- validates Client and ClientContact are active;
- validates ClientContact belongs to the route Client;
- provisions or establishes the same-Tenant User identity without accepting a User ID or password;
- links `ClientContact.userId` to that User when not already linked;
- ensures or reuses the User's `client_owner` UserRole;
- ensures or reuses an ActorProfile for that UserRole linked to the ClientContact;
- initiates secure one-time password setup using the existing Identity reset-token lifecycle;
- follows existing Identity activation/default-profile rules;
- is idempotent for repeated identical grant;
- returns business assignment state without exposing password, setup-token, or session internals.

Response business fields:

```json
{
  "client": {
    "id": "client-id",
    "name": "Acme Corporation"
  },
  "clientContact": {
    "id": "contact-id",
    "name": "Jane Customer",
    "email": "jane@example.com",
    "userId": "provisioned-or-established-user-id"
  },
  "portalAccess": {
    "role": "client_owner",
    "scope": "client",
    "active": true
  }
}
```

User provisioning and setup:

- The backend provisions or establishes the User under the existing Identity model; Client does
  not accept an existing User ID as a prerequisite.
- System Admin never creates, chooses, sees, or knows the password.
- The Client user chooses a password from the one-time, expiring setup link. Token handling,
  hashing, expiry, single use, and production email delivery reuse the approved Identity reset
  lifecycle; development may use its safe delivery inspection path.

Authorization:

- `system_admin` in own Tenant/Company with `MANAGE_CLIENT_PORTAL_ACCESS`.

### Revoke Client Portal Access

`DELETE /client/:clientId/contact/:contactId/portal-access`

Swagger title: `Revoke Client Portal Access`

Behavior:

- validates ClientContact belongs to the route Client;
- reuses existing Identity/UserRole/ActorProfile behavior to make the `client_owner` acting
  context unavailable for new portal/workflow actions;
- preserves ClientContact, User, ActorProfile history, and workflow references;
- does not delete ClientContact or User.

Authorization:

- `system_admin` in own Tenant/Company with `MANAGE_CLIENT_PORTAL_ACCESS`.

## Forbidden Client-Side Routes

Do not add Client or `client_owner` routes that directly:

- create or manage Bid;
- create or manage Project;
- create Work Requests;
- route work to Division or Team;
- control internal workflow state.
