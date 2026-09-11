# Module 05 - Clients

## Status

Status: SPEC APPROVED

Module 05 owns the external customer foundation:

- `Client` external customer organizations.
- `ClientContact` people belonging to a Client.
- Client-side portal access linkage through existing Identity primitives.

ClientContact remains inside module 05 because the canonical index assigns both `clients` and
`client_contacts` to this module.

## Business Boundary

The fixed customer workflow boundary is:

```text
Client -> CCR -> Bid / Project -> Work Requests -> Internal Workflow -> CCR -> Client
```

CCR is the internal bridge between Clients and internal delivery workflow. Client and
`client_owner` actors do not directly create or manage Bids, Projects, Work Requests, Division or
Team routing, or internal workflow state.

Module 05 provides only:

- customer organization records;
- customer contact records;
- active Client and ClientContact selectors required by future workflow modules;
- portal access linkage for ClientContacts through existing User, UserRole, and ActorProfile logic.

## Domain Model

`Client` is an external customer organization. It is not a Company, User, Member, Division, or
Team. A Client never logs in.

`ClientContact` is a person belonging to a Client. It is not a Member or User. A ClientContact may
exist without User access.

`User` remains the login and security identity. `ActorProfile` remains the acting-context bridge.

The client portal acting model is:

```text
Client
-> ClientContact
-> optional User
-> client_owner UserRole
-> ActorProfile
-> ClientContact
```

The `client_owner` role is object-scoped through the active ActorProfile's ClientContact and that
contact's Client. Role membership alone never grants access to another Client.

One Client may have multiple eligible ClientContacts with `client_owner` portal access. There is no
one-owner-per-Client constraint.

## Structural Truth

Current schema evidence:

- `Client` has `tenantId`, `id`, nullable `companyId`, `name`, `isActive`, timestamps, contacts,
  and projects.
- `Client.name` is indexed, not unique.
- `ClientContact` has `tenantId`, `id`, nullable `userId`, required `clientId`, `name`, `email`,
  nullable `designation`, nullable `phone`, `isPrimary`, `isActive`, timestamps, ActorProfiles,
  credential deliveries, and workflow info request dependencies.
- `ClientContact` has unique `(tenantId, clientId, email)`.
- `ActorProfile.clientContactId` is nullable and links ActorProfile to ClientContact.
- `ActorRoleCode.client_owner` exists.
- `prime_consultant` does not exist.

Preserve this cardinality and nullability unless an approved later spec changes it.

## Tenant and Company Scope

One Tenant represents one Company. JWT/server TenantContext is authoritative. Clients and
ClientContacts are always tenant-scoped by server context; callers never supply trusted `tenantId`.

Client creation derives tenant scope from TenantContext and derives company scope from the current
Company context where the Company is known. `companyId` remains nullable in schema and is not a
caller-controlled field.

Cross-tenant and cross-company Client or ClientContact access is denied by repository filters, RLS,
and object-scope checks.

## Client Capabilities

### Create Client

Create the Client organization only.

Request fields:

- `name` required, non-empty, max 180.

Server-managed fields:

- `tenantId`;
- `companyId`;
- `id`;
- `isActive = true`;
- timestamps.

Creating a Client must not automatically create ClientContact, User, UserRole, ActorProfile, or
portal access state.

### List Clients

Return Clients visible in the caller's tenant/company scope. The list contract supports active-only
selector use for future Bid/Project modules. Inactive Clients are not selectable for new business
records.

### Get Client

Return one Client in scope with enough business fields for customer administration and future
workflow selectors. Do not expose authentication internals.

### Update Client

Mutable fields:

- `name`.

Immutable/caller-forbidden fields:

- `tenantId`;
- `companyId`;
- `id`;
- dependency collections;
- portal access state.

`client_owner` cannot edit Client master data.

### Deactivate Client

Set `Client.isActive = false`. This is the normal lifecycle operation. It preserves historical
Bid, Project, Workflow, ClientContact, and audit references. It must not hard-delete the Client.

Inactive Clients:

- remain readable to authorized administrators;
- are excluded from selectors for new business records;
- cannot be used for new Bid/Project/Workflow creation.

### Reactivate Client

Set `Client.isActive = true` for an in-scope inactive Client. Reactivation makes the Client
available for active selectors again. Reactivation does not automatically reactivate inactive
ClientContacts.

## ClientContact Capabilities

### Add Client Contact

Create a contact under an in-scope active Client.

Request fields:

- `name` required, non-empty, max 160;
- `email` required, valid email, max 255, unique per `(tenantId, clientId)`;
- `designation` optional, max 140;
- `phone` optional, max 60.

Server-managed fields:

- `tenantId`;
- `clientId` from route/in-scope Client;
- `id`;
- `userId` remains null unless linked by an explicit portal access operation;
- `isPrimary = false`;
- `isActive = true`;
- timestamps.

Creating a ClientContact must not automatically create User, UserRole, ActorProfile, credentials,
or sessions.

### List Client Contacts

Return contacts for one in-scope Client. A contact list must not leak contacts from another Client,
Company, or Tenant. Active-only selector use excludes inactive contacts.

### Get Client Contact

Return one contact under one in-scope Client. The route must validate that the contact belongs to
the route Client.

### Update Client Contact

Mutable fields:

- `name`;
- `email`;
- `designation`;
- `phone`.

Caller-forbidden fields:

- `tenantId`;
- `clientId`;
- `id`;
- `userId` except through the portal access operation;
- `isPrimary` except through Set Primary Client Contact;
- ActorProfile/UserRole state.

### Deactivate Client Contact

Set `ClientContact.isActive = false`. This preserves ActorProfile, workflow, credential-delivery,
and history references. It must not hard-delete the contact.

Inactive contacts:

- remain readable to authorized administrators;
- cannot be used for new portal operations;
- cannot be used for new workflow communication;
- cannot remain the active primary contact.

If the deactivated contact was primary, the operation must set that contact's `isPrimary = false`
and leave the Client with no active primary unless another primary is explicitly selected.

### Reactivate Client Contact

Set `ClientContact.isActive = true` for an in-scope inactive contact. Reactivation does not
automatically make the contact primary and does not automatically grant portal access.

### Set Primary Client Contact

Set one active ClientContact as the Client's primary contact.

Rules:

- A Client may have zero or one active primary contact.
- The selected contact must belong to the route Client and be active.
- Setting a new primary atomically unsets any previous primary contact for that Client.
- Primary Contact does not imply User, portal access, or `client_owner`.

## Portal Access

Client portal access is established for an existing active ClientContact and existing User. User
creation, passwords, invitation, credential delivery, sessions, and credential reset behavior
remain owned by Identity and future credential-delivery modules.

### Grant Client Portal Access

The operation:

1. loads an active Client by route id in TenantContext;
2. loads an active ClientContact by route id and verifies it belongs to that Client and Tenant;
3. verifies the supplied existing User belongs to the same Tenant;
4. links `ClientContact.userId` to that User if not already linked;
5. ensures or reuses a `client_owner` UserRole for that User;
6. ensures or reuses an ActorProfile for that UserRole linked to the same ClientContact;
7. leaves profile activation/default selection to existing Identity rules.

The operation is idempotent where practical. Repeating the same grant must not create duplicate
UserRole or ActorProfile state.

If no eligible existing User is available, return the repository's existing validation/error
convention for a missing prerequisite. Do not create a User or invent credential semantics.

### Revoke Client Portal Access

System Admin may revoke Client portal access for a ClientContact. Revocation must use existing
Identity/UserRole/ActorProfile behavior and preserve historical references. It must not delete the
ClientContact, User, or Client.

Revocation makes the affected `client_owner` ActorProfile unusable for new client-side portal or
workflow actions. Existing workflow/history references remain intact.

## Authorization

### Client Administration

`system_admin`, within own Tenant/Company and through configured permissions, may:

- create/list/get/update Clients;
- deactivate/reactivate Clients;
- add/list/get/update ClientContacts;
- deactivate/reactivate ClientContacts;
- set/change Primary Contact;
- grant/revoke Client portal access.

No wildcard system_admin bypass is allowed.

### CCR

CCR has no general Client administration.

CCR may only read/select active Client and ClientContact data required for authorized Bid/Project
creation and workflow communication. CCR may not create, update, deactivate, or reactivate Clients;
manage contacts; set Primary Contact; or grant/revoke portal access merely because of the CCR role.

CCR selection access is workflow-context access, not Client administration. CCR must not require or
receive `MANAGE_CLIENT`, `MANAGE_CLIENT_CONTACT`, or `MANAGE_CLIENT_PORTAL_ACCESS` merely to select
an active Client while creating an authorized Bid/Project or to select/read an appropriate
ClientContact for authorized workflow communication. That selector/read access relies on the
applicable existing Bid/Project/workflow authorization plus server-side Tenant/Company scope.

### client_owner

`client_owner` is a workflow actor, not a Client administrator.

May:

- access own Client context only;
- perform authorized Client-side workflow actions such as providing information and final
  accept/reject/revision.

May not:

- edit Client master data;
- manage contacts;
- set Primary Contact;
- grant/revoke portal access;
- administer User, Role, or ActorProfile;
- access another Client.

Own-Client workflow visibility does not imply `MANAGE_CLIENT`, `MANAGE_CLIENT_CONTACT`, or
`MANAGE_CLIENT_PORTAL_ACCESS`.

## Permission Capabilities

Current Client workflow action codes exist for client-side workflow behavior, including
`CLIENT_PROVIDE_INFO`, `CLIENT_ACCEPT_FINAL`, `CLIENT_REJECT_FINAL`, and
`CLIENT_REQUEST_REVISION`. These must remain separate from Client administration permissions.

No suitable current Client administration permission codes exist. Add only these minimum new
capabilities during implementation, following the current uppercase action-code convention:

- `MANAGE_CLIENT`: create/list/get/update/deactivate/reactivate Clients.
- `MANAGE_CLIENT_CONTACT`: add/list/get/update/deactivate/reactivate ClientContacts and set/change
  Primary Contact.
- `MANAGE_CLIENT_PORTAL_ACCESS`: grant/revoke Client portal access.

Do not reuse unrelated workflow permissions such as `ADD_CLIENT_DOCUMENT` for Client
administration.

## Confirmed Decisions

- Client lifecycle uses `isActive` with Deactivate Client and Reactivate Client.
- ClientContact lifecycle uses `isActive` with Deactivate Client Contact and Reactivate Client
  Contact.
- No normal hard-delete API for Client or ClientContact.
- ClientContact belongs inside module 05 Clients.
- ClientContact may exist without User.
- One Client may have multiple `client_owner` actors.
- A Client may have zero or one active Primary Contact.
- Primary Contact does not imply User, portal access, or `client_owner`.
- System Admin only grants/revokes Client portal access.
- `client_owner` has own-Client workflow access only, not Client administration.
- CCR has active Client/ClientContact selection only in authorized Bid/Project/workflow context.
