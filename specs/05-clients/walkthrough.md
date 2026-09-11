# Module 05 - Walkthrough

Gate 5 is not executed during spec authoring.

When implementing Module 05, start the API and record each focused HTTP/RLS check here with:

- method and path;
- actor;
- request body if applicable;
- status code;
- response envelope shape;
- `x-request-id`;
- PASS/FAIL.

Required checks:

- system_admin creates Client in own Company.
- system_admin lists only in-scope Clients.
- system_admin gets and updates in-scope Client.
- system_admin deactivates and reactivates Client.
- inactive Client is not selectable for new business records.
- cross-tenant/cross-company Client access is denied.
- system_admin adds ClientContact under in-scope Client.
- duplicate Contact email in same Client is denied.
- same Contact email under another Client follows approved uniqueness behavior.
- cross-Client Contact route mismatch is denied.
- system_admin deactivates and reactivates ClientContact.
- inactive ClientContact cannot be used for new portal/workflow operations.
- Set Primary Client Contact succeeds for one active contact.
- setting a new primary atomically unsets the previous primary.
- deactivating the primary contact clears active primary state.
- Grant Client Portal Access succeeds for same-tenant existing User.
- Grant Client Portal Access is idempotent.
- Grant Client Portal Access fails when User is missing.
- Grant Client Portal Access fails for inactive Client or inactive ClientContact.
- Grant Client Portal Access fails for cross-tenant/cross-company User or Contact.
- Revoke Client Portal Access preserves ClientContact/User/history and disables new acting use.
- CCR can select active Client/ClientContact only in authorized Bid/Project/workflow context.
- CCR cannot create/update/deactivate Clients, manage contacts, set primary contact, or manage
  portal access.
- client_owner can access only own Client workflow context.
- client_owner cannot access another Client through role alone.
- client_owner cannot administer Client data, contacts, primary contact, portal access, or Identity.
- client_owner cannot create Bid, Project, WorkRequest, Division/Team routing, or internal workflow.
