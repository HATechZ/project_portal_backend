-- Final role and permission foundation. This is additive for legacy workflow
-- tables: their role-labelled action data remains historical/compatibility data
-- until the owning workflow modules are converted in later phases.
--
-- Rollback: revoke active role_permissions, drop the three new tables and three
-- new enum types, and remove roles.is_active/retired_at only after restoring the
-- preceding provisioning function. Do not rewrite prior migrations.

CREATE TYPE public.permission_code AS ENUM (
  'VIEW_ROLES', 'CREATE_ROLE', 'UPDATE_ROLE', 'RETIRE_ROLE', 'ASSIGN_ROLES', 'REVOKE_ROLES',
  'CREATE_COMPANY', 'VIEW_COMPANY', 'UPDATE_COMPANY',
  'CREATE_DIVISION', 'VIEW_DIVISIONS', 'UPDATE_DIVISION', 'DELETE_DIVISION', 'ASSIGN_DIVISION_LEAD', 'REVOKE_DIVISION_LEAD',
  'CREATE_TEAM', 'VIEW_TEAMS', 'UPDATE_TEAM', 'DELETE_TEAM', 'ASSIGN_TEAM_MEMBER', 'REMOVE_TEAM_MEMBER',
  'CREATE_MEMBER', 'VIEW_MEMBERS', 'UPDATE_MEMBER', 'REMOVE_MEMBER', 'LINK_MEMBER_ACCESS', 'VIEW_DESIGNATIONS', 'CREATE_DESIGNATION', 'UPDATE_DESIGNATION', 'DELETE_DESIGNATION',
  'CREATE_CLIENT', 'VIEW_CLIENTS', 'UPDATE_CLIENT', 'DEACTIVATE_CLIENT', 'REACTIVATE_CLIENT', 'CREATE_CLIENT_CONTACT', 'VIEW_CLIENT_CONTACTS', 'UPDATE_CLIENT_CONTACT', 'DEACTIVATE_CLIENT_CONTACT', 'REACTIVATE_CLIENT_CONTACT', 'SET_PRIMARY_CLIENT_CONTACT', 'GRANT_CLIENT_PORTAL_ACCESS', 'REVOKE_CLIENT_PORTAL_ACCESS',
  'CREATE_BID', 'VIEW_BID', 'UPDATE_BID', 'ARCHIVE_BID', 'RESTORE_BID', 'DECIDE_BID_OUTCOME', 'REQUEST_ARCHIVED_BID_REVIEW',
  'CREATE_PROJECT', 'VIEW_PROJECT', 'UPDATE_PROJECT', 'ARCHIVE_PROJECT', 'RESTORE_PROJECT',
  'CREATE_WORK_REQUEST', 'VIEW_WORK_REQUEST', 'UPDATE_WORK_REQUEST', 'CREATE_WORK_REQUEST_NOTE', 'ASSIGN_WORK_REQUEST_DIVISION', 'ASSIGN_WORK_REQUEST_TEAM', 'ASSIGN_WORK_REQUEST_MEMBER', 'SUBMIT_WORK_REQUEST', 'APPROVE_WORK_REQUEST_REVIEW', 'REQUEST_WORK_REQUEST_REVISION',
  'VIEW_DOCUMENT', 'UPLOAD_DOCUMENT', 'SUBMIT_DOCUMENT',
  'VIEW_DOCUMENT_CODES', 'CREATE_DOCUMENT_CODE', 'UPDATE_DOCUMENT_CODE', 'DELETE_DOCUMENT_CODE',
  'ROUTE_FOR_REVIEW', 'ASSIGN_REVIEWER', 'APPROVE_REVIEW', 'REJECT_REVIEW', 'APPROVE_ORIGIN_REVIEW', 'REJECT_ORIGIN_REVIEW',
  'REQUEST_INFO', 'RESPOND_TO_INFO_REQUEST', 'REQUEST_REVISION', 'SUBMIT_FOR_REVIEW', 'ESCALATE_TO_EXTERNAL_REVIEW', 'SUBMIT_FOR_EXTERNAL_REVIEW', 'SUBMIT_CLIENT_REVISION', 'ACCEPT_FINAL_DELIVERY', 'REJECT_FINAL_DELIVERY',
  'VIEW_SETTINGS', 'UPDATE_SETTINGS'
);

CREATE TYPE public.permission_category AS ENUM (
  'ACCESS_CONTROL', 'ORGANIZATION', 'DIVISIONS', 'TEAMS', 'MEMBERS', 'CLIENTS', 'BIDS',
  'PROJECTS', 'WORK_REQUESTS', 'DOCUMENTS', 'DOCUMENT_CODES', 'REVIEWS', 'WORKFLOW', 'SETTINGS'
);

CREATE TYPE public.permission_action_type AS ENUM (
  'VIEW', 'CREATE', 'UPDATE', 'DELETE', 'ASSIGN', 'SUBMIT', 'APPROVE', 'REJECT', 'REQUEST',
  'RESPOND', 'ROUTE', 'REVOKE', 'RETIRE', 'ARCHIVE', 'OTHER'
);

ALTER TABLE public.roles
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN retired_at timestamp(6),
  ALTER COLUMN is_system_role SET DEFAULT false,
  ADD CONSTRAINT roles_retirement_shape CHECK (retired_at IS NULL OR is_active = false);

-- Current identities are demo/test data. Retired system roles remain referencable
-- as historical records but are not active runtime roles after this migration.
UPDATE public.roles AS role
SET is_active = false, retired_at = now()
FROM public.system_roles AS system_role
WHERE system_role.role_id = role.id
  AND system_role.system_code <> 'tenant_super_admin'::public.actor_role_code;

CREATE TABLE public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code public.permission_code NOT NULL,
  display_name varchar(180) NOT NULL,
  description text,
  category public.permission_category NOT NULL,
  action_type public.permission_action_type NOT NULL,
  resource varchar(120) NOT NULL,
  created_at timestamp(6) NOT NULL DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (id),
  CONSTRAINT permissions_code_key UNIQUE (code)
);

CREATE TABLE public.permission_scope_compatibilities (
  permission_id uuid NOT NULL,
  scope public.custom_role_scope NOT NULL,
  CONSTRAINT permission_scope_compatibilities_pkey PRIMARY KEY (permission_id, scope),
  CONSTRAINT permission_scope_compatibilities_permission_id_fkey FOREIGN KEY (permission_id)
    REFERENCES public.permissions(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE public.role_permissions (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  granted_at timestamp(6) NOT NULL DEFAULT now(),
  revoked_at timestamp(6),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT role_permissions_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES public.tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id)
    REFERENCES public.roles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id)
    REFERENCES public.permissions(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX role_permissions_tenant_id_idx ON public.role_permissions (tenant_id);
CREATE INDEX role_permissions_tenant_id_role_id_permission_id_revoked_at_idx
  ON public.role_permissions (tenant_id, role_id, permission_id, revoked_at);
CREATE UNIQUE INDEX role_permissions_one_active_grant_key
  ON public.role_permissions (tenant_id, role_id, permission_id) WHERE revoked_at IS NULL;

INSERT INTO public.permissions (code, display_name, description, category, action_type, resource) VALUES
  ('VIEW_ROLES', 'View roles', 'View role definitions and their explicit grants.', 'ACCESS_CONTROL', 'VIEW', 'Role'),
  ('CREATE_ROLE', 'Create role', 'Create a tenant-owned custom role.', 'ACCESS_CONTROL', 'CREATE', 'Role'),
  ('UPDATE_ROLE', 'Update role', 'Update an active tenant-owned custom role.', 'ACCESS_CONTROL', 'UPDATE', 'Role'),
  ('RETIRE_ROLE', 'Retire role', 'Retire a tenant-owned custom role while preserving history.', 'ACCESS_CONTROL', 'RETIRE', 'Role'),
  ('ASSIGN_ROLES', 'Assign roles', 'Assign an active role to an eligible user.', 'ACCESS_CONTROL', 'ASSIGN', 'Role assignment'),
  ('REVOKE_ROLES', 'Revoke roles', 'Revoke an active user role grant.', 'ACCESS_CONTROL', 'REVOKE', 'Role assignment'),
  ('CREATE_COMPANY', 'Create company', 'Create a company through the approved signup flow.', 'ORGANIZATION', 'CREATE', 'Company'),
  ('VIEW_COMPANY', 'View company', 'View company information.', 'ORGANIZATION', 'VIEW', 'Company'),
  ('UPDATE_COMPANY', 'Update company', 'Update company information.', 'ORGANIZATION', 'UPDATE', 'Company'),
  ('CREATE_DIVISION', 'Create division', 'Create a division.', 'DIVISIONS', 'CREATE', 'Division'),
  ('VIEW_DIVISIONS', 'View divisions', 'View divisions.', 'DIVISIONS', 'VIEW', 'Division'),
  ('UPDATE_DIVISION', 'Update division', 'Update a division.', 'DIVISIONS', 'UPDATE', 'Division'),
  ('DELETE_DIVISION', 'Delete division', 'Hard delete a division when dependency rules allow.', 'DIVISIONS', 'DELETE', 'Division'),
  ('ASSIGN_DIVISION_LEAD', 'Assign division lead', 'Assign a business division-lead relationship.', 'DIVISIONS', 'ASSIGN', 'Division leadership'),
  ('REVOKE_DIVISION_LEAD', 'Revoke division lead', 'Revoke a business division-lead relationship.', 'DIVISIONS', 'REVOKE', 'Division leadership'),
  ('CREATE_TEAM', 'Create team', 'Create a team.', 'TEAMS', 'CREATE', 'Team'),
  ('VIEW_TEAMS', 'View teams', 'View teams.', 'TEAMS', 'VIEW', 'Team'),
  ('UPDATE_TEAM', 'Update team', 'Update a team.', 'TEAMS', 'UPDATE', 'Team'),
  ('DELETE_TEAM', 'Delete team', 'Hard delete a team when dependency rules allow.', 'TEAMS', 'DELETE', 'Team'),
  ('ASSIGN_TEAM_MEMBER', 'Assign team member', 'Assign a member to a team.', 'TEAMS', 'ASSIGN', 'Team membership'),
  ('REMOVE_TEAM_MEMBER', 'Remove team member', 'Remove a member from a team while preserving history.', 'TEAMS', 'OTHER', 'Team membership'),
  ('CREATE_MEMBER', 'Create member', 'Create a member.', 'MEMBERS', 'CREATE', 'Member'),
  ('VIEW_MEMBERS', 'View members', 'View members.', 'MEMBERS', 'VIEW', 'Member'),
  ('UPDATE_MEMBER', 'Update member', 'Update a member.', 'MEMBERS', 'UPDATE', 'Member'),
  ('REMOVE_MEMBER', 'Remove member', 'Remove a member while preserving history.', 'MEMBERS', 'OTHER', 'Member'),
  ('LINK_MEMBER_ACCESS', 'Link member access', 'Link member access where the feature requires it.', 'MEMBERS', 'OTHER', 'Member access'),
  ('VIEW_DESIGNATIONS', 'View designations', 'View designations.', 'MEMBERS', 'VIEW', 'Designation'),
  ('CREATE_DESIGNATION', 'Create designation', 'Create a designation.', 'MEMBERS', 'CREATE', 'Designation'),
  ('UPDATE_DESIGNATION', 'Update designation', 'Update a designation.', 'MEMBERS', 'UPDATE', 'Designation'),
  ('DELETE_DESIGNATION', 'Delete designation', 'Hard delete a designation when dependency rules allow.', 'MEMBERS', 'DELETE', 'Designation'),
  ('CREATE_CLIENT', 'Create client', 'Create a client.', 'CLIENTS', 'CREATE', 'Client'),
  ('VIEW_CLIENTS', 'View clients', 'View clients.', 'CLIENTS', 'VIEW', 'Client'),
  ('UPDATE_CLIENT', 'Update client', 'Update a client.', 'CLIENTS', 'UPDATE', 'Client'),
  ('DEACTIVATE_CLIENT', 'Deactivate client', 'Deactivate a client.', 'CLIENTS', 'OTHER', 'Client'),
  ('REACTIVATE_CLIENT', 'Reactivate client', 'Reactivate a client.', 'CLIENTS', 'OTHER', 'Client'),
  ('CREATE_CLIENT_CONTACT', 'Create client contact', 'Create a client contact.', 'CLIENTS', 'CREATE', 'Client contact'),
  ('VIEW_CLIENT_CONTACTS', 'View client contacts', 'View client contacts.', 'CLIENTS', 'VIEW', 'Client contact'),
  ('UPDATE_CLIENT_CONTACT', 'Update client contact', 'Update a client contact.', 'CLIENTS', 'UPDATE', 'Client contact'),
  ('DEACTIVATE_CLIENT_CONTACT', 'Deactivate client contact', 'Deactivate a client contact.', 'CLIENTS', 'OTHER', 'Client contact'),
  ('REACTIVATE_CLIENT_CONTACT', 'Reactivate client contact', 'Reactivate a client contact.', 'CLIENTS', 'OTHER', 'Client contact'),
  ('SET_PRIMARY_CLIENT_CONTACT', 'Set primary client contact', 'Set a primary client contact.', 'CLIENTS', 'OTHER', 'Client contact'),
  ('GRANT_CLIENT_PORTAL_ACCESS', 'Grant client portal access', 'Grant an eligible client contact portal access.', 'CLIENTS', 'ASSIGN', 'Client portal access'),
  ('REVOKE_CLIENT_PORTAL_ACCESS', 'Revoke client portal access', 'Revoke a client portal access grant.', 'CLIENTS', 'REVOKE', 'Client portal access'),
  ('CREATE_BID', 'Create bid', 'Create a bid.', 'BIDS', 'CREATE', 'Bid'),
  ('VIEW_BID', 'View bid', 'View bid list and detail information.', 'BIDS', 'VIEW', 'Bid'),
  ('UPDATE_BID', 'Update bid', 'Update a bid.', 'BIDS', 'UPDATE', 'Bid'),
  ('ARCHIVE_BID', 'Archive bid', 'Archive a bid.', 'BIDS', 'ARCHIVE', 'Bid'),
  ('RESTORE_BID', 'Restore bid', 'Restore an archived bid.', 'BIDS', 'OTHER', 'Bid'),
  ('DECIDE_BID_OUTCOME', 'Decide bid outcome', 'Decide an eligible bid outcome.', 'BIDS', 'OTHER', 'Bid'),
  ('REQUEST_ARCHIVED_BID_REVIEW', 'Request archived bid review', 'Request review of an archived bid.', 'BIDS', 'REQUEST', 'Bid'),
  ('CREATE_PROJECT', 'Create project', 'Create a project.', 'PROJECTS', 'CREATE', 'Project'),
  ('VIEW_PROJECT', 'View project', 'View project list and detail information.', 'PROJECTS', 'VIEW', 'Project'),
  ('UPDATE_PROJECT', 'Update project', 'Update a project.', 'PROJECTS', 'UPDATE', 'Project'),
  ('ARCHIVE_PROJECT', 'Archive project', 'Archive a project.', 'PROJECTS', 'ARCHIVE', 'Project'),
  ('RESTORE_PROJECT', 'Restore project', 'Restore an archived project.', 'PROJECTS', 'OTHER', 'Project'),
  ('CREATE_WORK_REQUEST', 'Create work request', 'Create a work request.', 'WORK_REQUESTS', 'CREATE', 'Work request'),
  ('VIEW_WORK_REQUEST', 'View work request', 'View work request list and detail information.', 'WORK_REQUESTS', 'VIEW', 'Work request'),
  ('UPDATE_WORK_REQUEST', 'Update work request', 'Update a work request.', 'WORK_REQUESTS', 'UPDATE', 'Work request'),
  ('CREATE_WORK_REQUEST_NOTE', 'Create work request note', 'Create a work request note.', 'WORK_REQUESTS', 'CREATE', 'Work request note'),
  ('ASSIGN_WORK_REQUEST_DIVISION', 'Assign work request division', 'Assign a work request to a division.', 'WORK_REQUESTS', 'ASSIGN', 'Work request'),
  ('ASSIGN_WORK_REQUEST_TEAM', 'Assign work request team', 'Assign a work request to a team.', 'WORK_REQUESTS', 'ASSIGN', 'Work request'),
  ('ASSIGN_WORK_REQUEST_MEMBER', 'Assign work request member', 'Assign a work request to a member.', 'WORK_REQUESTS', 'ASSIGN', 'Work request'),
  ('SUBMIT_WORK_REQUEST', 'Submit work request', 'Submit an assigned work request.', 'WORK_REQUESTS', 'SUBMIT', 'Work request'),
  ('APPROVE_WORK_REQUEST_REVIEW', 'Approve work request review', 'Approve an assigned work request review.', 'WORK_REQUESTS', 'APPROVE', 'Work request'),
  ('REQUEST_WORK_REQUEST_REVISION', 'Request work request revision', 'Request revision of a work request.', 'WORK_REQUESTS', 'REQUEST', 'Work request'),
  ('VIEW_DOCUMENT', 'View document', 'View a document.', 'DOCUMENTS', 'VIEW', 'Document'),
  ('UPLOAD_DOCUMENT', 'Upload document', 'Upload a document or document version.', 'DOCUMENTS', 'CREATE', 'Document'),
  ('SUBMIT_DOCUMENT', 'Submit document', 'Submit a document.', 'DOCUMENTS', 'SUBMIT', 'Document'),
  ('VIEW_DOCUMENT_CODES', 'View document codes', 'View document codes.', 'DOCUMENT_CODES', 'VIEW', 'Document code'),
  ('CREATE_DOCUMENT_CODE', 'Create document code', 'Create a document code.', 'DOCUMENT_CODES', 'CREATE', 'Document code'),
  ('UPDATE_DOCUMENT_CODE', 'Update document code', 'Update a document code.', 'DOCUMENT_CODES', 'UPDATE', 'Document code'),
  ('DELETE_DOCUMENT_CODE', 'Delete document code', 'Hard delete a document code when dependency rules allow.', 'DOCUMENT_CODES', 'DELETE', 'Document code'),
  ('ROUTE_FOR_REVIEW', 'Route for review', 'Route an item for review.', 'REVIEWS', 'ROUTE', 'Review'),
  ('ASSIGN_REVIEWER', 'Assign reviewer', 'Assign a reviewer.', 'REVIEWS', 'ASSIGN', 'Review'),
  ('APPROVE_REVIEW', 'Approve review', 'Approve an assigned review.', 'REVIEWS', 'APPROVE', 'Review'),
  ('REJECT_REVIEW', 'Reject review', 'Reject an assigned review.', 'REVIEWS', 'REJECT', 'Review'),
  ('APPROVE_ORIGIN_REVIEW', 'Approve origin review', 'Approve an assigned origin review.', 'REVIEWS', 'APPROVE', 'Origin review'),
  ('REJECT_ORIGIN_REVIEW', 'Reject origin review', 'Reject an assigned origin review.', 'REVIEWS', 'REJECT', 'Origin review'),
  ('REQUEST_INFO', 'Request information', 'Request information in an eligible workflow state.', 'WORKFLOW', 'REQUEST', 'Workflow item'),
  ('RESPOND_TO_INFO_REQUEST', 'Respond to information request', 'Respond to an open information request.', 'WORKFLOW', 'RESPOND', 'Workflow item'),
  ('REQUEST_REVISION', 'Request revision', 'Request revision in an eligible workflow state.', 'WORKFLOW', 'REQUEST', 'Workflow item'),
  ('SUBMIT_FOR_REVIEW', 'Submit for review', 'Submit an item for review.', 'WORKFLOW', 'SUBMIT', 'Workflow item'),
  ('ESCALATE_TO_EXTERNAL_REVIEW', 'Escalate to external review', 'Escalate an item to external review.', 'WORKFLOW', 'ROUTE', 'Workflow item'),
  ('SUBMIT_FOR_EXTERNAL_REVIEW', 'Submit for external review', 'Submit an item for external review.', 'WORKFLOW', 'SUBMIT', 'Workflow item'),
  ('SUBMIT_CLIENT_REVISION', 'Submit client revision', 'Submit a client revision.', 'WORKFLOW', 'SUBMIT', 'Workflow item'),
  ('ACCEPT_FINAL_DELIVERY', 'Accept final delivery', 'Accept a final delivery.', 'WORKFLOW', 'APPROVE', 'Delivery'),
  ('REJECT_FINAL_DELIVERY', 'Reject final delivery', 'Reject a final delivery.', 'WORKFLOW', 'REJECT', 'Delivery'),
  ('VIEW_SETTINGS', 'View settings', 'View tenant settings.', 'SETTINGS', 'VIEW', 'Settings'),
  ('UPDATE_SETTINGS', 'Update settings', 'Update tenant settings.', 'SETTINGS', 'UPDATE', 'Settings');

WITH compatibility (code, scopes) AS (
  VALUES
    ('VIEW_ROLES'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('CREATE_ROLE'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('UPDATE_ROLE'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('RETIRE_ROLE'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('ASSIGN_ROLES'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('REVOKE_ROLES'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('CREATE_COMPANY'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('VIEW_COMPANY'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('UPDATE_COMPANY'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('CREATE_DIVISION'::public.permission_code, ARRAY['company','division']::public.custom_role_scope[]),
    ('VIEW_DIVISIONS'::public.permission_code, ARRAY['company','division']::public.custom_role_scope[]),
    ('UPDATE_DIVISION'::public.permission_code, ARRAY['company','division']::public.custom_role_scope[]),
    ('DELETE_DIVISION'::public.permission_code, ARRAY['company','division']::public.custom_role_scope[]),
    ('ASSIGN_DIVISION_LEAD'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('REVOKE_DIVISION_LEAD'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('CREATE_TEAM'::public.permission_code, ARRAY['company','division','team']::public.custom_role_scope[]),
    ('VIEW_TEAMS'::public.permission_code, ARRAY['company','division','team']::public.custom_role_scope[]),
    ('UPDATE_TEAM'::public.permission_code, ARRAY['company','division','team']::public.custom_role_scope[]),
    ('DELETE_TEAM'::public.permission_code, ARRAY['company','division','team']::public.custom_role_scope[]),
    ('ASSIGN_TEAM_MEMBER'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('REMOVE_TEAM_MEMBER'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('CREATE_MEMBER'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('VIEW_MEMBERS'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('UPDATE_MEMBER'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('REMOVE_MEMBER'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('LINK_MEMBER_ACCESS'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('VIEW_DESIGNATIONS'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('CREATE_DESIGNATION'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('UPDATE_DESIGNATION'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('DELETE_DESIGNATION'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('CREATE_CLIENT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('VIEW_CLIENTS'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('UPDATE_CLIENT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('DEACTIVATE_CLIENT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('REACTIVATE_CLIENT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('CREATE_CLIENT_CONTACT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('VIEW_CLIENT_CONTACTS'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('UPDATE_CLIENT_CONTACT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('DEACTIVATE_CLIENT_CONTACT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('REACTIVATE_CLIENT_CONTACT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('SET_PRIMARY_CLIENT_CONTACT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('GRANT_CLIENT_PORTAL_ACCESS'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('REVOKE_CLIENT_PORTAL_ACCESS'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('CREATE_BID'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('VIEW_BID'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('UPDATE_BID'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('ARCHIVE_BID'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('RESTORE_BID'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('DECIDE_BID_OUTCOME'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('REQUEST_ARCHIVED_BID_REVIEW'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('CREATE_PROJECT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('VIEW_PROJECT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('UPDATE_PROJECT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('ARCHIVE_PROJECT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('RESTORE_PROJECT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('CREATE_WORK_REQUEST'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('VIEW_WORK_REQUEST'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('UPDATE_WORK_REQUEST'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('CREATE_WORK_REQUEST_NOTE'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('ASSIGN_WORK_REQUEST_DIVISION'::public.permission_code, ARRAY['company','division']::public.custom_role_scope[]),
    ('ASSIGN_WORK_REQUEST_TEAM'::public.permission_code, ARRAY['company','division','team']::public.custom_role_scope[]),
    ('ASSIGN_WORK_REQUEST_MEMBER'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('SUBMIT_WORK_REQUEST'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('APPROVE_WORK_REQUEST_REVIEW'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('REQUEST_WORK_REQUEST_REVISION'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('VIEW_DOCUMENT'::public.permission_code, ARRAY['company','division','team','member','client','client_contact']::public.custom_role_scope[]),
    ('UPLOAD_DOCUMENT'::public.permission_code, ARRAY['company','division','team','member','client','client_contact']::public.custom_role_scope[]),
    ('SUBMIT_DOCUMENT'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('VIEW_DOCUMENT_CODES'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('CREATE_DOCUMENT_CODE'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('UPDATE_DOCUMENT_CODE'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('DELETE_DOCUMENT_CODE'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('ROUTE_FOR_REVIEW'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('ASSIGN_REVIEWER'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('APPROVE_REVIEW'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('REJECT_REVIEW'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('APPROVE_ORIGIN_REVIEW'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('REJECT_ORIGIN_REVIEW'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('REQUEST_INFO'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('RESPOND_TO_INFO_REQUEST'::public.permission_code, ARRAY['company','division','team','member','client','client_contact']::public.custom_role_scope[]),
    ('REQUEST_REVISION'::public.permission_code, ARRAY['company','division','team','member','client','client_contact']::public.custom_role_scope[]),
    ('SUBMIT_FOR_REVIEW'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('ESCALATE_TO_EXTERNAL_REVIEW'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('SUBMIT_FOR_EXTERNAL_REVIEW'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('SUBMIT_CLIENT_REVISION'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('ACCEPT_FINAL_DELIVERY'::public.permission_code, ARRAY['client','client_contact']::public.custom_role_scope[]),
    ('REJECT_FINAL_DELIVERY'::public.permission_code, ARRAY['client','client_contact']::public.custom_role_scope[]),
    ('VIEW_SETTINGS'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('UPDATE_SETTINGS'::public.permission_code, ARRAY['company']::public.custom_role_scope[])
)
INSERT INTO public.permission_scope_compatibilities (permission_id, scope)
SELECT permission.id, unnest(compatibility.scopes)
FROM compatibility
JOIN public.permissions AS permission ON permission.code = compatibility.code;

CREATE OR REPLACE FUNCTION public.assert_role_permission_tenant_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.roles AS role_definition
    WHERE role_definition.id = NEW.role_id
      AND role_definition.is_active = true
      AND (
        (role_definition.is_system_role = true AND EXISTS (
          SELECT 1 FROM public.system_roles AS system_role
          WHERE system_role.role_id = role_definition.id
            AND system_role.system_code = 'tenant_super_admin'::public.actor_role_code
        ) AND NOT EXISTS (
          SELECT 1 FROM public.permissions AS permission
          WHERE permission.id = NEW.permission_id
            AND permission.code = 'DECIDE_BID_OUTCOME'::public.permission_code
        ))
        OR (
          role_definition.is_system_role = false
          AND role_definition.tenant_id = NEW.tenant_id
          AND EXISTS (
            SELECT 1
            FROM public.permission_scope_compatibilities AS compatibility
            WHERE compatibility.permission_id = NEW.permission_id
              AND compatibility.scope = role_definition.custom_scope
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Role permission must target a compatible active custom role or tenant_super_admin without DECIDE_BID_OUTCOME'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE CONSTRAINT TRIGGER role_permissions_role_tenant_match
AFTER INSERT OR UPDATE OF tenant_id, role_id ON public.role_permissions
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.assert_role_permission_tenant_match();

CREATE OR REPLACE FUNCTION public.assert_system_role_identity_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.roles WHERE id = OLD.role_id AND is_system_role = true AND is_active = true) THEN
      RAISE EXCEPTION 'An active system role identity cannot be removed' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.system_code <> 'tenant_super_admin'::public.actor_role_code THEN
    RAISE EXCEPTION 'tenant_super_admin is the only active system role identity' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = NEW.role_id AND is_system_role = true AND is_active = true) THEN
    RAISE EXCEPTION 'system_roles may reference only active system roles' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissions_catalog_read ON public.permissions FOR SELECT TO app_user USING (true);
ALTER TABLE public.permission_scope_compatibilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY permission_scope_compatibilities_catalog_read ON public.permission_scope_compatibilities FOR SELECT TO app_user USING (true);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_tenant_access ON public.role_permissions FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT ON TABLE public.permissions, public.permission_scope_compatibilities TO app_user;
GRANT SELECT, INSERT, UPDATE ON TABLE public.role_permissions TO app_user;

CREATE OR REPLACE FUNCTION public.provision_company_workspace_core(
  p_company_name text, p_company_abbr text, p_company_type_id uuid,
  p_admin_full_name text, p_admin_email text, p_admin_password_hash text,
  p_admin_country text, p_admin_phone text
)
RETURNS TABLE (tenant_id uuid, company_id uuid, user_id uuid, user_role_id uuid, actor_profile_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE
  v_tenant_id uuid := gen_random_uuid(); v_company_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid(); v_user_role_id uuid := gen_random_uuid();
  v_actor_profile_id uuid := gen_random_uuid(); v_tenant_super_admin_role_id uuid;
  v_slug text;
BEGIN
  p_company_name := btrim(p_company_name); p_company_abbr := btrim(p_company_abbr);
  p_admin_full_name := btrim(p_admin_full_name); p_admin_email := lower(btrim(p_admin_email));
  p_admin_country := btrim(p_admin_country); p_admin_phone := btrim(p_admin_phone);
  IF p_company_name = '' OR p_company_abbr = '' OR p_admin_full_name = ''
     OR p_admin_email = '' OR p_admin_password_hash = '' OR p_admin_country = '' OR p_admin_phone = '' THEN
    RAISE EXCEPTION 'Company workspace provisioning fields must be non-empty' USING ERRCODE = '22023';
  END IF;
  IF length(p_company_name) > 180 OR length(p_company_abbr) > 30 OR length(p_admin_full_name) > 160
     OR length(p_admin_email) > 255 OR length(p_admin_password_hash) > 255 OR length(p_admin_country) > 100
     OR length(p_admin_phone) > 60 THEN
    RAISE EXCEPTION 'Company workspace provisioning field exceeds its maximum length' USING ERRCODE = '22001';
  END IF;
  PERFORM 1 FROM public.company_types AS company_type WHERE company_type.id = p_company_type_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown companyTypeId' USING ERRCODE = '23503'; END IF;
  SELECT system_role.role_id INTO STRICT v_tenant_super_admin_role_id
  FROM public.system_roles AS system_role
  JOIN public.roles AS role_definition ON role_definition.id = system_role.role_id
  WHERE system_role.system_code = 'tenant_super_admin'::public.actor_role_code
    AND role_definition.is_active = true;
  IF (SELECT count(*) FROM public.permissions) <> 89 THEN
    RAISE EXCEPTION 'Final permission catalogue is incomplete';
  END IF;
  v_slug := left(nullif(regexp_replace(lower(p_company_name), '[^a-z0-9]+', '-', 'g'), ''), 80);
  IF v_slug IS NULL THEN v_slug := 'company'; END IF;
  v_slug := trim(BOTH '-' FROM v_slug) || '-' || left(replace(v_tenant_id::text, '-', ''), 12);
  INSERT INTO public.tenants (id, name, slug, is_active) VALUES (v_tenant_id, p_company_name, v_slug, true);
  INSERT INTO public.companies (tenant_id, id, name, abbr, company_type_id, is_active)
    VALUES (v_tenant_id, v_company_id, p_company_name, p_company_abbr, p_company_type_id, true);
  INSERT INTO public.users (tenant_id, id, full_name, email, password_hash, country, phone, is_active)
    VALUES (v_tenant_id, v_user_id, p_admin_full_name, p_admin_email, p_admin_password_hash, p_admin_country, p_admin_phone, true);
  INSERT INTO public.user_roles (tenant_id, id, user_id, role_id, assigned_by_user_id)
    VALUES (v_tenant_id, v_user_role_id, v_user_id, v_tenant_super_admin_role_id, NULL);
  INSERT INTO public.actor_profiles (tenant_id, id, user_id, role_id, member_id, client_contact_id, label, is_default, is_active)
    VALUES (v_tenant_id, v_actor_profile_id, v_user_id, v_tenant_super_admin_role_id, NULL, NULL, p_admin_full_name, true, true);
  INSERT INTO public.role_permissions (tenant_id, role_id, permission_id)
  SELECT v_tenant_id, v_tenant_super_admin_role_id, permission.id
  FROM public.permissions AS permission
  WHERE permission.code <> 'DECIDE_BID_OUTCOME'::public.permission_code;
  RETURN QUERY SELECT v_tenant_id, v_company_id, v_user_id, v_user_role_id, v_actor_profile_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text) FROM app_user;
