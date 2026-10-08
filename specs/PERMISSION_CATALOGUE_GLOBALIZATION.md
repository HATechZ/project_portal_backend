# Permission Catalogue Globalization — Final Freeze

**Status:** AUTHORITATIVE owner decision, 2026-10-06. Design only. It supersedes conflicting permission, scope, fixed-role, category, seed, route, DTO, and authorization statements elsewhere in `specs/`. It authorizes no source, schema, seed, migration, service, Docker, or database change.

## Governing model

Only `tenant_super_admin` is predefined. Every other role is tenant-created and has `id`, `name`, `description`, one system scope, and explicit grants. Names and codes, including CCR, Marketing, Reviewer, M1, or Engineering Manager, are display labels with **zero** authorization meaning.

Authorization is: **explicit permission + same tenant + permission/scope compatibility + actual resource/business rule + applicable assignment/ownership + applicable state = allowed**. A scope is a compatibility tier, not an implied resource boundary: `division` does not mean “only the actor's assigned Division” unless the owning resource rule separately says so. Compatibility is per permission, never inferred from prefixes, CRUD labels, categories, or retired roles.

`company`, `division`, `team`, `member`, `client`, and `client_contact` are the only approved
system scopes. `client` represents Client organization/context; `client_contact` represents an
individual ClientContact context. External users receive tenant-created custom roles with explicit
atomic grants; no `client_owner`, client administrator, client reviewer, or other predefined
external role exists. `PermissionScopeCompatibility(permissionId, scope)` is the future backend
source of truth; it is design metadata only. Categories are presentation metadata only. They
neither grant authority nor constrain a role to one category.

`DELETE_*` is hard deletion only. `REMOVE_*`, `DEACTIVATE_*`, `REVOKE_*`, `RETIRE_*`, `ARCHIVE_*`, `CANCEL_*`, and `REJECT_*` retain their business meanings. No blanket prohibition on Division-compatible delete permissions exists.

## Authoritative master mapping matrix

`Y` = compatible; `—` = not compatible. An omitted Client/Client Contact value is `—`. All rows
require same-tenant isolation. Scope compatibility does not impose matching-object ownership;
Resource/Business Condition and State Condition remain separate, independently enforced terms.
“Derived” records a real current endpoint/use case hidden behind a broad grant.

| Old Permission | Actual Capability / endpoint | Category | Final Permission | Resource | Action Type | C | D | T | M | Resource/Business Condition | State Condition | Disposition | Client | Client Contact |
|---|---|---|---|---|---|:-:|:-:|:-:|:-:|---|---|---|:-:|:-:|
| ADD_COMPANY | signup provisioner | Organization | CREATE_COMPANY | Company | CREATE | Y | — | — | — | approved signup only | unique tenant/company | RENAME |
| ADD_DIVISION | Division CRUD | Divisions | CREATE_DIVISION; VIEW_DIVISIONS; UPDATE_DIVISION; DELETE_DIVISION | Division | CREATE/VIEW/UPDATE/DELETE | Y | Y | — | — | target tenant Company; delete dependency checks | active target; hard delete only | SPLIT |
| ADD_TEAM | Team CRUD | Teams | CREATE_TEAM; VIEW_TEAMS; UPDATE_TEAM; DELETE_TEAM | Team | CREATE/VIEW/UPDATE/DELETE | Y | Y | Y | — | target tenant Division; delete preserves membership history | active target; hard delete only | SPLIT |
| ADD_MEMBER | Member controller | Members | CREATE_MEMBER; VIEW_MEMBERS; UPDATE_MEMBER; REMOVE_MEMBER; LINK_MEMBER_ACCESS | Member | CREATE/VIEW/UPDATE/OTHER | Y | Y | Y | Y | target/member relationship required where operation says so | remove preserves history | SPLIT |
| ADD_PROJECT | Project create | Projects | CREATE_PROJECT | Project | CREATE | Y | Y | Y | Y | valid tenant parent/object rule | creatable | RENAME |
| ADD_BID | Bid create | Bids | CREATE_BID | Bid | CREATE | Y | Y | Y | Y | valid tenant parent/object rule | creatable | RENAME |
| VIEW_BID | Bid list/detail | Bids | VIEW_BID | Bid | VIEW | Y | Y | Y | Y | object visibility rule | visible | KEEP |
| UPDATE_BID | Bid PATCH/status routes | Bids | UPDATE_BID; ARCHIVE_BID; RESTORE_BID | Bid | UPDATE/ARCHIVE/OTHER | Y | Y | Y | Y | target object rule | mutable / archived as applicable | SPLIT |
| VIEW_PROJECT | Project list/detail | Projects | VIEW_PROJECT | Project | VIEW | Y | Y | Y | Y | object visibility rule | visible | KEEP |
| UPDATE_PROJECT | Project PATCH/status routes | Projects | UPDATE_PROJECT; ARCHIVE_PROJECT; RESTORE_PROJECT | Project | UPDATE/ARCHIVE/OTHER | Y | Y | Y | Y | target object rule | mutable / archived as applicable | SPLIT |
| ADD_CLIENT_DOCUMENT | client-document use case | Documents | UPLOAD_DOCUMENT | Document | CREATE | — | — | — | — | Client/ClientContact participant | document accepts upload | MERGE | Y | Y |
| ADD_WORK_REQUEST_DOCUMENT | WR document routes | Documents | UPLOAD_DOCUMENT | Document | CREATE | Y | Y | Y | Y | WR participant and tenant-qualified parent | attachment allowed | MERGE |
| ADD_WORK_REQUEST | WR create | Work Requests | CREATE_WORK_REQUEST | Work Request | CREATE | Y | Y | Y | Y | eligible tenant Bid/Project | creatable | RENAME |
| ADD_WORK_REQUEST_NOTE | WR note use case | Work Requests | CREATE_WORK_REQUEST_NOTE | Work Request note | CREATE | Y | Y | Y | Y | visible participant | request visible | RENAME |
| REQUEST_WORKFLOW_INFO | WR info route | Workflow | REQUEST_INFO | Workflow item | REQUEST | Y | Y | Y | Y | designated participant | info-capable state | MERGE |
| RESPOND_WORKFLOW_INFO | WR info route | Workflow | RESPOND_TO_INFO_REQUEST | Workflow item | RESPOND | Y | Y | Y | Y | designated recipient | open request to actor | MERGE |
| REQUEST_INFO_FROM_MARKETING | legacy workflow | Workflow | REQUEST_INFO | Workflow item | REQUEST | Y | Y | Y | Y | participant, not Marketing identity | compatible legacy state | MERGE |
| MARKETING_RETURN_TO_PM | legacy workflow | Workflow | RESPOND_TO_INFO_REQUEST | Workflow item | RESPOND | Y | Y | Y | Y | recipient, not Marketing identity | compatible legacy state | MERGE |
| MARKETING_ESCALATE_TO_CLIENT | legacy workflow | Workflow | ESCALATE_TO_EXTERNAL_REVIEW | Workflow item | ROUTE | Y | Y | Y | Y | authorized workflow router | escalation state | RENAME |
| CLIENT_PROVIDE_INFO | external portal | Workflow | RESPOND_TO_INFO_REQUEST | Workflow item | RESPOND | — | — | — | — | Client/ClientContact designated recipient | open client request | MERGE | Y | Y |
| MEMBER_REQUEST_INFO | legacy workflow | Workflow | REQUEST_INFO | Workflow item | REQUEST | Y | Y | Y | Y | assigned participant where required | compatible state | MERGE |
| PM_LEAD_RESPOND_TO_MEMBER | legacy workflow | Workflow | RESPOND_TO_INFO_REQUEST | Workflow item | RESPOND | Y | Y | Y | Y | designated recipient | open request | MERGE |
| PM_MEMBER_SUBMIT | legacy workflow | Workflow | SUBMIT_FOR_REVIEW | Workflow item | SUBMIT | Y | Y | Y | Y | assigned submitter | submit state | MERGE |
| PM_RETURN_TO_MEMBER | legacy workflow | Workflow | REQUEST_REVISION | Workflow item | REQUEST | Y | Y | Y | Y | current reviewer | reversible-review state | MERGE |
| ASSIGN_LEADER | Division leadership routes | Divisions | ASSIGN_DIVISION_LEAD; REVOKE_DIVISION_LEAD | Division leadership | ASSIGN/REVOKE | Y | Y | Y | Y | eligible same-tenant Member; assignment is not a role | active leadership / revocable | SPLIT |
| ASSIGN_MEMBER | Team membership routes | Teams | ASSIGN_TEAM_MEMBER; REMOVE_TEAM_MEMBER | Team membership | ASSIGN/OTHER | Y | Y | Y | Y | eligible same-tenant Member and Team | active membership / removable | SPLIT |
| FORWARD_TO_TMS | legacy workflow | Reviews | ROUTE_FOR_REVIEW | Review | ROUTE | Y | Y | Y | Y | workflow router assignment | route state | MERGE |
| ASSIGN_TMS_CHAIN | legacy workflow | Reviews | ASSIGN_REVIEWER | Review assignment | ASSIGN | Y | Y | Y | Y | workflow router; no TMS identity | pre-review | RENAME |
| SUBMIT_DRAWING | legacy workflow | Documents | SUBMIT_DOCUMENT | Document | SUBMIT | Y | Y | Y | Y | assigned producer | document submit state | RENAME |
| REVIEW_CHECKING_APPROVE | legacy workflow | Reviews | APPROVE_REVIEW | Review | APPROVE | Y | Y | Y | Y | assigned reviewer | checking-review state | MERGE |
| REVIEW_CHECKING_REJECT | legacy workflow | Reviews | REJECT_REVIEW | Review | REJECT | Y | Y | Y | Y | assigned reviewer | checking-review state | MERGE |
| REVIEW_APPROVAL_APPROVE | legacy workflow | Reviews | APPROVE_REVIEW | Review | APPROVE | Y | Y | Y | Y | assigned approver | approval-review state | MERGE |
| REVIEW_APPROVAL_REJECT | legacy workflow | Reviews | REJECT_REVIEW | Review | REJECT | Y | Y | Y | Y | assigned approver | approval-review state | MERGE |
| ENGINEERING_REQUEST_PM_REVISION | legacy workflow | Workflow | REQUEST_REVISION | Workflow item | REQUEST | Y | Y | Y | Y | current reviewer | reversible state | MERGE |
| TMS_MEMBER_REQUEST_LEAD | legacy workflow | Workflow | REQUEST_INFO | Workflow item | REQUEST | Y | Y | Y | Y | assigned participant | active review | MERGE |
| TMS_LEAD_RESPOND_TO_MEMBER | legacy workflow | Workflow | RESPOND_TO_INFO_REQUEST | Workflow item | RESPOND | Y | Y | Y | Y | designated participant | open request | MERGE |
| ENGINEERING_SUBMIT_TO_MARKETING | legacy workflow | Workflow | SUBMIT_FOR_REVIEW | Workflow item | SUBMIT | Y | Y | Y | Y | current submitter | completion state | MERGE |
| MARKETING_SUBMIT_TO_CLIENT | legacy workflow | Workflow | SUBMIT_FOR_EXTERNAL_REVIEW | Workflow item | SUBMIT | Y | Y | Y | Y | authorized submitter | client-review submission | RENAME |
| MARKETING_REQUEST_ENGINEERING_REVISION | legacy workflow | Workflow | REQUEST_REVISION | Workflow item | REQUEST | Y | Y | Y | Y | current reviewer | review state | MERGE |
| MARKETING_ROUTE_CLIENT_REVISION_TO_TMS | legacy workflow | Reviews | ROUTE_FOR_REVIEW | Review | ROUTE | Y | Y | Y | Y | workflow router | client-revision route | MERGE |
| MARKETING_SUBMIT_CLIENT_REVISION | legacy workflow | Workflow | SUBMIT_CLIENT_REVISION | Workflow item | SUBMIT | Y | Y | Y | Y | authorized submitter | revision ready | RENAME |
| ENGINEERING_REQUEST_TMS_REVISION | legacy workflow | Workflow | REQUEST_REVISION | Workflow item | REQUEST | Y | Y | Y | Y | current reviewer | engineering review | MERGE |
| CLIENT_REQUEST_REVISION | external portal | Workflow | REQUEST_REVISION | Workflow item | REQUEST | — | — | — | — | Client/ClientContact participant | client review | MERGE | Y | Y |
| CLIENT_ACCEPT_FINAL | external portal | Workflow | ACCEPT_FINAL_DELIVERY | Delivery | APPROVE | — | — | — | — | Client/ClientContact designated decision participant | final delivery | RENAME | Y | Y |
| CLIENT_REJECT_FINAL | external portal | Workflow | REJECT_FINAL_DELIVERY | Delivery | REJECT | — | — | — | — | Client/ClientContact designated decision participant | final delivery | RENAME | Y | Y |
| ORIGIN_MEMBER_APPROVE | legacy workflow | Reviews | APPROVE_ORIGIN_REVIEW | Origin review | APPROVE | Y | Y | Y | Y | assigned origin reviewer | origin-review | RENAME |
| ORIGIN_MEMBER_REJECT | legacy workflow | Reviews | REJECT_ORIGIN_REVIEW | Origin review | REJECT | Y | Y | Y | Y | assigned origin reviewer | origin-review | RENAME |
| ORIGIN_MANAGER_APPROVE | legacy workflow | Reviews | APPROVE_ORIGIN_REVIEW | Origin review | APPROVE | Y | Y | Y | Y | assigned origin approver | origin-manager review | MERGE |
| FORWARD_TO_CCR | legacy workflow | Reviews | ROUTE_FOR_REVIEW | Review | ROUTE | Y | Y | Y | Y | workflow router, not CCR identity | route state | MERGE |
| SEND_BACKWARD | legacy workflow | Workflow | REQUEST_REVISION | Workflow item | REQUEST | Y | Y | Y | Y | current reviewer | reversible state | MERGE |
| LIST_FINAL_DOCUMENT | final-document use case | Documents | VIEW_DOCUMENT | Document | VIEW | Y | Y | Y | Y | document participant/object rule | final/visible | RENAME | Y | Y |
| DECIDE_BID_OUTCOME | Bid decision | Bids | DECIDE_BID_OUTCOME | Bid | OTHER | Y | Y | Y | Y | explicit decision assignment; never TSA bootstrap | eligible Bid state | KEEP |
| REQUEST_ARCHIVED_BID_REVIEW | Bid route | Bids | REQUEST_ARCHIVED_BID_REVIEW | Bid | REQUEST | Y | Y | Y | Y | archive participant | archived/reviewable | KEEP |
| UPDATE_SETTINGS | option-code routes | Settings | VIEW_SETTINGS; UPDATE_SETTINGS | Settings | VIEW/UPDATE | Y | — | — | — | tenant settings | mutable settings | SPLIT |
| MANAGE_CLIENT | Client controller | Clients | CREATE_CLIENT; VIEW_CLIENTS; UPDATE_CLIENT; DEACTIVATE_CLIENT; REACTIVATE_CLIENT | Client | CREATE/VIEW/UPDATE/OTHER | Y | Y | Y | Y | tenant client and resource rule | active/deactivated as applicable | SPLIT |
| MANAGE_CLIENT_CONTACT | ClientContact controller | Client Contacts | CREATE_CLIENT_CONTACT; VIEW_CLIENT_CONTACTS; UPDATE_CLIENT_CONTACT; DEACTIVATE_CLIENT_CONTACT; REACTIVATE_CLIENT_CONTACT; SET_PRIMARY_CLIENT_CONTACT | Client contact | CREATE/VIEW/UPDATE/OTHER | Y | Y | Y | Y | tenant Client relationship | active/deactivated as applicable | SPLIT |
| MANAGE_CLIENT_PORTAL_ACCESS | portal-access controller | Clients | GRANT_CLIENT_PORTAL_ACCESS; REVOKE_CLIENT_PORTAL_ACCESS | Client portal access | ASSIGN/REVOKE | Y | Y | Y | Y | internal management of portal-access record | eligible contact / active grant | SPLIT |
| MANAGE_GENERAL_DOCUMENT_CODES | document-code controllers | Document Codes | VIEW_DOCUMENT_CODES; CREATE_DOCUMENT_CODE; UPDATE_DOCUMENT_CODE; DELETE_DOCUMENT_CODE | Document code | VIEW/CREATE/UPDATE/DELETE | Y | Y | Y | Y | group ownership and tenant code policy | delete only where no dependency permits | SPLIT |
| MANAGE_DESIGNATIONS | Designation controller | Members | VIEW_DESIGNATIONS; CREATE_DESIGNATION; UPDATE_DESIGNATION; DELETE_DESIGNATION | Designation | VIEW/CREATE/UPDATE/DELETE | Y | Y | Y | Y | tenant designation policy | delete only where no dependency permits | SPLIT |
| VIEW_WORK_REQUEST | WR routes | Work Requests | VIEW_WORK_REQUEST | Work Request | VIEW | Y | Y | Y | Y | participant/object rule | visible | KEEP |
| UPDATE_WORK_REQUEST | WR patch | Work Requests | UPDATE_WORK_REQUEST | Work Request | UPDATE | Y | Y | Y | Y | participant/object rule | mutable | KEEP |
| WR_ASSIGN_DIVISION | assignment route | Work Requests | ASSIGN_WORK_REQUEST_DIVISION | Work Request | ASSIGN | Y | Y | — | — | workflow router | CREATED/DIVISION_ASSIGNED | RENAME |
| WR_ASSIGN_TEAM | assignment route | Work Requests | ASSIGN_WORK_REQUEST_TEAM | Work Request | ASSIGN | Y | Y | Y | — | responsible assignment | DIVISION_ASSIGNED/TEAM_ASSIGNED | RENAME |
| WR_ASSIGN_MEMBER | assignment route | Work Requests | ASSIGN_WORK_REQUEST_MEMBER | Work Request | ASSIGN | Y | Y | Y | Y | responsible assignment | TEAM_ASSIGNED/MEMBER_ASSIGNED | RENAME |
| WR_SUBMIT | workflow use case | Work Requests | SUBMIT_WORK_REQUEST | Work Request | SUBMIT | Y | Y | Y | Y | assigned submitter | MEMBER_ASSIGNED | RENAME |
| WR_TEAM_LEAD_APPROVE | workflow use case | Work Requests | APPROVE_WORK_REQUEST_REVIEW | Work Request | APPROVE | Y | Y | Y | Y | assigned reviewer, never team-lead role | MEMBER_SUBMITTED | MERGE |
| WR_TEAM_LEAD_REQUEST_REVISION | workflow use case | Work Requests | REQUEST_WORK_REQUEST_REVISION | Work Request | REQUEST | Y | Y | Y | Y | assigned reviewer | MEMBER_SUBMITTED | MERGE |
| WR_DIVISION_LEAD_APPROVE | workflow use case | Work Requests | APPROVE_WORK_REQUEST_REVIEW | Work Request | APPROVE | Y | Y | Y | Y | assigned reviewer, never division-lead role | `TEAM_LEAD_APPROVED` compatibility label | MERGE |
| WR_DIVISION_LEAD_REQUEST_REVISION | workflow use case | Work Requests | REQUEST_WORK_REQUEST_REVISION | Work Request | REQUEST | Y | Y | Y | Y | assigned reviewer | `TEAM_LEAD_APPROVED` compatibility label | MERGE |
| WR_DIVISION_HEAD_APPROVE | workflow use case | Work Requests | APPROVE_WORK_REQUEST_REVIEW | Work Request | APPROVE | Y | Y | Y | Y | assigned reviewer, never division-head role | `DIVISION_LEAD_APPROVED` compatibility label | MERGE |
| WR_DIVISION_HEAD_REQUEST_REVISION | workflow use case | Work Requests | REQUEST_WORK_REQUEST_REVISION | Work Request | REQUEST | Y | Y | Y | Y | assigned reviewer | `DIVISION_LEAD_APPROVED` compatibility label | MERGE |
| User controller POST | create tenant User | Access Control | CREATE_USER | User | CREATE | Y | — | — | — | tenant-local user data; no implicit role/profile assignment | unique active email / valid input | ADD |
| User controller GET/list/detail | read tenant Users | Access Control | VIEW_USERS | User | VIEW | Y | — | — | — | same-tenant User | any lifecycle state exposed by endpoint | ADD |
| User controller PATCH | update tenant User | Access Control | UPDATE_USER | User | UPDATE | Y | — | — | — | same-tenant User; preserve final-admin safety separately | mutable user state | ADD |
| User controller DELETE | hard-delete tenant User | Access Control | DELETE_USER | User | DELETE | Y | — | — | — | same-tenant User; dependency/final-admin protection | deletable only | ADD |
| Session administration DELETE `/auth/users/:userId/sessions` | revoke all tenant sessions | Access Control | REVOKE_USER_SESSIONS | Auth session | REVOKE | Y | — | — | — | same-tenant User | active sessions only; idempotent endpoint | ADD |
| Cargo/POL/POD/Vessel option GET/list/detail | view reference-data option | Reference Data | VIEW_REFERENCE_DATA | Reference-data option | VIEW | Y | — | — | — | tenant configuration data | active/deactivated view as endpoint specifies | ADD |
| Cargo/POL/POD/Vessel option POST | create reference-data option | Reference Data | CREATE_REFERENCE_DATA_OPTION | Reference-data option | CREATE | Y | — | — | — | tenant configuration data; uniqueness policy | creatable | ADD |
| Cargo/POL/POD/Vessel option PATCH | update reference-data option | Reference Data | UPDATE_REFERENCE_DATA_OPTION | Reference-data option | UPDATE | Y | — | — | — | same-tenant option | mutable | ADD |
| Cargo/POL/POD/Vessel option deactivate | deactivate reference-data option | Reference Data | DEACTIVATE_REFERENCE_DATA_OPTION | Reference-data option | OTHER | Y | — | — | — | same-tenant option | active only | ADD |
| Cargo/POL/POD/Vessel option reactivate | reactivate reference-data option | Reference Data | REACTIVATE_REFERENCE_DATA_OPTION | Reference-data option | OTHER | Y | — | — | — | same-tenant option | inactive only | ADD |
| General/Marketing/ETC/Engineering/PM document-code GET/list/detail | view document code | Document Codes | VIEW_DOCUMENT_CODES | Document code | VIEW | Y | Y | Y | Y | same-tenant document-code group | active/deactivated view as endpoint specifies | KEEP |
| General/Marketing/ETC/Engineering/PM document-code POST/PATCH | create or update document code | Document Codes | CREATE_DOCUMENT_CODE; UPDATE_DOCUMENT_CODE | Document code | CREATE/UPDATE | Y | Y | Y | Y | same-tenant group and code uniqueness | creatable/mutable | KEEP |
| General/Marketing/ETC/Engineering/PM document-code deactivate | deactivate document code | Document Codes | DEACTIVATE_DOCUMENT_CODE | Document code | OTHER | Y | Y | Y | Y | same-tenant group | active only | ADD |
| General/Marketing/ETC/Engineering/PM document-code reactivate | reactivate document code | Document Codes | REACTIVATE_DOCUMENT_CODE | Document code | OTHER | Y | Y | Y | Y | same-tenant group | inactive only | ADD |
| Division Lead assign/revoke/read | organization leadership relationship | Divisions | ASSIGN_DIVISION_LEAD; REVOKE_DIVISION_LEAD; VIEW_DIVISIONS | Division leadership | ASSIGN/REVOKE/VIEW | Y | Y | Y | Y | eligible same-tenant Member and Division; never a Role/UserRole/ActorProfile provision | active leadership / revocable | KEEP |

The 71 legacy entries resolve to **KEEP 7, RENAME 17, MERGE 32, SPLIT 15, RETIRE 0**. “MERGE” remains conditional: implementation must prove equal actor, target, side effect, resource condition, and state; otherwise retain a neutral successor split rather than merge or broaden.

## Final catalogue (89 permissions)

| Category | Final permissions |
|---|---|
| Access Control | VIEW_ROLES, CREATE_ROLE, UPDATE_ROLE, RETIRE_ROLE, ASSIGN_ROLES, REVOKE_ROLES, CREATE_USER, VIEW_USERS, UPDATE_USER, DELETE_USER, REVOKE_USER_SESSIONS |
| Organization | CREATE_COMPANY, VIEW_COMPANY, UPDATE_COMPANY |
| Divisions | CREATE_DIVISION, VIEW_DIVISIONS, UPDATE_DIVISION, DELETE_DIVISION, ASSIGN_DIVISION_LEAD, REVOKE_DIVISION_LEAD |
| Teams | CREATE_TEAM, VIEW_TEAMS, UPDATE_TEAM, DELETE_TEAM, ASSIGN_TEAM_MEMBER, REMOVE_TEAM_MEMBER |
| Members | CREATE_MEMBER, VIEW_MEMBERS, UPDATE_MEMBER, REMOVE_MEMBER, LINK_MEMBER_ACCESS, VIEW_DESIGNATIONS, CREATE_DESIGNATION, UPDATE_DESIGNATION, DELETE_DESIGNATION |
| Clients | CREATE_CLIENT, VIEW_CLIENTS, UPDATE_CLIENT, DEACTIVATE_CLIENT, REACTIVATE_CLIENT, CREATE_CLIENT_CONTACT, VIEW_CLIENT_CONTACTS, UPDATE_CLIENT_CONTACT, DEACTIVATE_CLIENT_CONTACT, REACTIVATE_CLIENT_CONTACT, SET_PRIMARY_CLIENT_CONTACT, GRANT_CLIENT_PORTAL_ACCESS, REVOKE_CLIENT_PORTAL_ACCESS |
| Bids | CREATE_BID, VIEW_BID, UPDATE_BID, ARCHIVE_BID, RESTORE_BID, DECIDE_BID_OUTCOME, REQUEST_ARCHIVED_BID_REVIEW |
| Projects | CREATE_PROJECT, VIEW_PROJECT, UPDATE_PROJECT, ARCHIVE_PROJECT, RESTORE_PROJECT |
| Work Requests | CREATE_WORK_REQUEST, VIEW_WORK_REQUEST, UPDATE_WORK_REQUEST, CREATE_WORK_REQUEST_NOTE, ASSIGN_WORK_REQUEST_DIVISION, ASSIGN_WORK_REQUEST_TEAM, ASSIGN_WORK_REQUEST_MEMBER, SUBMIT_WORK_REQUEST, APPROVE_WORK_REQUEST_REVIEW, REQUEST_WORK_REQUEST_REVISION |
| Documents | VIEW_DOCUMENT, UPLOAD_DOCUMENT, SUBMIT_DOCUMENT |
| Document Codes | VIEW_DOCUMENT_CODES, CREATE_DOCUMENT_CODE, UPDATE_DOCUMENT_CODE, DELETE_DOCUMENT_CODE, DEACTIVATE_DOCUMENT_CODE, REACTIVATE_DOCUMENT_CODE |
| Reviews | ROUTE_FOR_REVIEW, ASSIGN_REVIEWER, APPROVE_REVIEW, REJECT_REVIEW, APPROVE_ORIGIN_REVIEW, REJECT_ORIGIN_REVIEW |
| Workflow | REQUEST_INFO, RESPOND_TO_INFO_REQUEST, REQUEST_REVISION, SUBMIT_FOR_REVIEW, ESCALATE_TO_EXTERNAL_REVIEW, SUBMIT_FOR_EXTERNAL_REVIEW, SUBMIT_CLIENT_REVISION, ACCEPT_FINAL_DELIVERY, REJECT_FINAL_DELIVERY |
| Settings | VIEW_SETTINGS, UPDATE_SETTINGS |
| Reference Data | VIEW_REFERENCE_DATA, CREATE_REFERENCE_DATA_OPTION, UPDATE_REFERENCE_DATA_OPTION, DEACTIVATE_REFERENCE_DATA_OPTION, REACTIVATE_REFERENCE_DATA_OPTION |

The displayed count is **101**. External compatibility is limited to existing client-facing upload,
information response, revision request, final-delivery decision, and final-document view behavior;
it does not add a client-specific permission or functionality.

## Role management and selector contract

Role administration is granular: `VIEW_ROLES`, `CREATE_ROLE`, `UPDATE_ROLE`, `RETIRE_ROLE`, `ASSIGN_ROLES`, and `REVOKE_ROLES`. Scope compatibility is independently defined for each; no scope is presumed ineligible. Retirement is preferred to hard delete for history, and assignment/revocation retain timestamped history. Separate safety rules protect `tenant_super_admin` from unsafe modification, loss of the final active administrator, and self-escalation.

The role editor creates one role, asks the backend for permissions compatible with its selected scope, and groups the response by `category`. Selection is one flat cross-category list:

```json
{ "name": "Reviewer", "description": "…", "scope": "division", "permissionIds": ["…"] }
```

Changing a category changes only the displayed subset; it must not clear prior selections. Search, selected totals, category counts, Select All in Category, and Clear Category are frontend conveniences only. Backend validation accepts one de-duplicated `permissionIds[]`, derives tenant ownership, and rejects incompatible or unknown ids. It stores `Role → explicit Permission grants`, never `Role → Category → implied grants`. The API returns permission `id`, `code`, `displayName`, `description`, `category`, `actionType`, `resource/domain`, and justified metadata; frontend compatibility tables are prohibited.

## Bootstrap, demo data, and audit

Company signup is: Tenant → Company → initial User → `tenant_super_admin` UserRole → default ActorProfile → explicit grants for every final permission except `DECIDE_BID_OUTCOME`. There is no wildcard bypass. A tenant super admin may grant `DECIDE_BID_OUTCOME` only to a tenant-created role subject to compatibility and decision-assignment rules.

No active authorization identity may use TMS, CCR, Marketing, M1/M2/M3, client_owner, Division Head/Lead, Team Lead, or similar retired labels. Old role-labelled workflow action/state values may remain **LEGACY COMPATIBILITY LABEL ONLY** where renaming would break API/history; they are state/history labels, never identity checks.

All current users, fixed roles, UserRole assignments, ActorProfiles, workflow assignments, and
related access records are **demo/test data**. There is no production legacy-user/access
preservation requirement: do not design per-user conversion, equivalent-permission calculation,
automatic fixed-role-to-custom-role mapping, or an active-user cutover. Future implementation may
clean, replace, reset/reseed, or recreate demo data directly under the final architecture. The
resulting demo model uses only `tenant_super_admin`, tenant-created custom roles, explicit atomic
permissions, and approved scopes. Historical migration files and recorded history remain unchanged;
future changes are forward-only.

Client and ClientContact scopes are system-defined compatibility tiers. They enable existing
client-facing capabilities only through tenant-created custom roles and explicit grants; they do
not create predefined external roles or automatically limit access to a matching Client or
ClientContact. Any resource/assignment restriction must be stated by the owning feature.

| Dependency | Classification | Required future treatment |
|---|---|---|
| `ActorRoleCode`, `SystemRole`, provisioning, permission seed matrix | REPLACE_WITH_PERMISSION | retain only TSA system identity; recreate demo data safely |
| `TenantSuperAdminGuard`, `AllowActorRoles` | RETIRE | centralized permission plus conditions |
| `ObjectScopeProvider` TSA / division shortcuts | REPLACE_WITH_RESOURCE/BUSINESS_CONDITION | tier never implies a Division boundary |
| Company, Division, Team, Member leadership fields | KEEP / REPLACE_WITH_RESOURCE/BUSINESS_CONDITION | preserve legitimate relationships as assignment evidence |
| role/permission DTOs, session payload, Swagger | REPLACE_WITH_PERMISSION | expose metadata; no fixed-role authorization |
| workflow routing and role-labelled DTO/API contracts | REPLACE_WITH_RESOURCE/BUSINESS_CONDITION | capability + assignment + state; labels compatibility-only |
| Client portal | REPLACE_WITH_PERMISSION | use explicit grants plus Client/ClientContact compatibility; no `client_owner` |
| migrations, old data, history | HISTORICAL_ONLY | forward migrations only; never rewrite history |

Future implementation phases: (1) introduce the final atomic catalogue; (2) introduce category and
scope compatibility; (3) update `tenant_super_admin` bootstrap; (4) replace fixed-role runtime
authorization; (5) update role/permission APIs; (6) update resource/workflow authorization; (7)
update session, Swagger, and tests; (8) clean/recreate demo users, roles, and access under the
final architecture; (9) retire obsolete active fixed-role structures where safe; (10) preserve
historical migrations/history. Exact resource/business boundaries remain separate owner decisions.

Implementation acceptance must prove each old behavior through mapped final permission(s), compatibility, resource/business condition, and state condition. Tests must prove a globalized permission cannot access a context the legacy behavior denied. No implementation phase is approved here.

## Phase 6 catalogue-resolution addendum

The Phase 6 runtime audit resolved the previously missing capabilities without using a broad
`MANAGE_*` permission. The authoritative count is 101. `UPDATE_SETTINGS` is not reused for the
independently delegable Cargo, POL, POD, and Vessel option lifecycle; those endpoints use the
five Reference Data capabilities in the master matrix. Likewise, document-code deactivation and
reactivation are lifecycle actions, not hard delete.

Current seed source is demo data and must be replaced in a later implementation task: remove
`prisma/seed/data/permissions.data.ts` fixed-role/action matrices, retired fixed-role demo users,
and any `WorkflowActionRolePermission` seeding. Retain only `tenant_super_admin` as the seeded
system role; seed all 101 final permissions and their compatibility rows; explicitly grant every
final permission except `DECIDE_BID_OUTCOME` to that role; and create demo business/external
actors only through tenant-created custom roles and explicit RolePermission grants.

Historical migrations and their tests remain historical evidence. A historical-migration test may
assert that a legacy migration contains its original labels or data shape, but must not assert that
retired roles, workflow-action grants, or fixed-role provisioning remain active in current runtime
or seed behavior.

## 2026-10-07 protected starter-role bundles

The following are **initial tenant-local RolePermission grants**, not authorization shortcuts.
Every listed operation still requires the canonical permission + same-Tenant + compatible scope +
resource/business relationship + assignment (where applicable) + workflow-state rule. No bundle
confers tenant-wide visibility, routing, review, or approval by name alone.

| Starter role | Scope | Initial existing permission codes | Reason |
|---|---|---|---|
| Staff | member | `VIEW_MEMBERS`, `VIEW_DESIGNATIONS`, `VIEW_CLIENTS`, `VIEW_BID`, `VIEW_PROJECT`, `VIEW_WORK_REQUEST`, `VIEW_DOCUMENT`, `VIEW_DOCUMENT_CODES` | least-privilege internal directory/reference and visible/assigned work reads |
| Supervisor | team | Staff read set plus `VIEW_TEAMS`, `ASSIGN_WORK_REQUEST_MEMBER`, `APPROVE_WORK_REQUEST_REVIEW`, `REQUEST_WORK_REQUEST_REVISION`, `REQUEST_INFO`, `RESPOND_TO_INFO_REQUEST` | generic team coordination; object/assignment/state rules remain controlling |
| Manager | division | Supervisor bundle, plus `VIEW_DIVISIONS`, `ASSIGN_WORK_REQUEST_TEAM` | generic division coordination; Division routing remains Company-scope responsibility |

All listed permissions are presently compatible with their receiving scope in
`permission_scope_compatibilities`: Staff/member; Supervisor/team; Manager/division. Therefore
this decision requires no new permission code and no compatibility expansion. `VIEW_REFERENCE_DATA`
is intentionally excluded because it is currently company-only; no compatibility broadening is
justified for automatic onboarding.

Provisioning must create/ensure the three protected tenant Roles and these grants in the existing
atomic Company/Tenant flow, after Tenant/Company existence and without modifying the explicit
`tenant_super_admin` bootstrap or its `DECIDE_BID_OUTCOME` exception. The normal compatible-grant
management API remains the required edit surface; it must not encode the starter bundles in guards
or services. Historical migrations remain read-only evidence.

### Provisioning gate

The table is an approved **target** grant matrix. Current compatibility rows remain unchanged, but
compatibility is not an object-visibility grant. Before automatic starter provisioning, Phase A
must prove each enabled path enforces tenant, scope, resource/business relationship, required
assignment/responsibility, and required state. Until then, no target permission is automatically
granted merely because it appears in this matrix; a catalogue permission without an implemented,
protected route/action is non-operational for starter provisioning. Phase B may provision only
the target grants proven safe by Phase A. Role name/code is never a substitute for those checks.

### Operational starter-grant boundary

`CREATE_WORK_REQUEST_NOTE`, `REQUEST_REVISION`, `SUBMIT_FOR_REVIEW`, `ROUTE_FOR_REVIEW`, and
`ASSIGN_REVIEWER` remain global catalogue permissions but are not starter defaults and are
non-operational until their own protected route/action exists. `SUBMIT_WORK_REQUEST` is likewise
not a Supervisor default: only the exact active assigned Member may submit. `ASSIGN_WORK_REQUEST_DIVISION`
is not a Manager default because Division routing is Company-scope responsibility. The authoritative
resource predicates are in `ROLE_ARCHITECTURE_FREEZE.md`; compatibility rows remain unchanged.
