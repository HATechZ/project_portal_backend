-- Configure direct, functional catalogue dependencies used by the role editor.
--
-- These edges are UI/support metadata only. They never replace the endpoint-level
-- permission, scope, resource, assignment, or workflow-state checks. Every edge
-- is intentionally from an action to the read capability required to use the
-- relevant page/target selector. Read permissions have no outgoing edges here,
-- keeping the graph acyclic.
--
-- Rollback: DELETE FROM public.permission_dependencies WHERE (permission_id,
-- required_permission_id) IN (the pairs selected below). This is a data-only
-- migration; it changes no schema object and does not alter permission codes.

DO $migration$
DECLARE
  expected_edge_count CONSTANT integer := 64;
  resolved_edge_count integer;
BEGIN
  SELECT count(*) INTO resolved_edge_count
  FROM (
    VALUES
      -- Documents and document-code management.
      ('UPLOAD_DOCUMENT', 'VIEW_DOCUMENT'),
      ('SUBMIT_DOCUMENT', 'VIEW_DOCUMENT'),
      ('CREATE_DOCUMENT_CODE', 'VIEW_DOCUMENT_CODES'),
      ('UPDATE_DOCUMENT_CODE', 'VIEW_DOCUMENT_CODES'),
      ('DELETE_DOCUMENT_CODE', 'VIEW_DOCUMENT_CODES'),
      ('DEACTIVATE_DOCUMENT_CODE', 'VIEW_DOCUMENT_CODES'),
      ('REACTIVATE_DOCUMENT_CODE', 'VIEW_DOCUMENT_CODES'),

      -- Bid and Project detail actions.
      ('CREATE_BID', 'VIEW_BID'),
      ('UPDATE_BID', 'VIEW_BID'),
      ('ARCHIVE_BID', 'VIEW_BID'),
      ('RESTORE_BID', 'VIEW_BID'),
      ('DECIDE_BID_OUTCOME', 'VIEW_BID'),
      ('REQUEST_ARCHIVED_BID_REVIEW', 'VIEW_BID'),
      ('CREATE_PROJECT', 'VIEW_PROJECT'),
      ('UPDATE_PROJECT', 'VIEW_PROJECT'),
      ('ARCHIVE_PROJECT', 'VIEW_PROJECT'),
      ('RESTORE_PROJECT', 'VIEW_PROJECT'),

      -- Work Request commands operate from a visible request detail/worklist.
      ('CREATE_WORK_REQUEST', 'VIEW_WORK_REQUEST'),
      ('UPDATE_WORK_REQUEST', 'VIEW_WORK_REQUEST'),
      ('CREATE_WORK_REQUEST_NOTE', 'VIEW_WORK_REQUEST'),
      ('ASSIGN_WORK_REQUEST_DIVISION', 'VIEW_WORK_REQUEST'),
      ('ASSIGN_WORK_REQUEST_TEAM', 'VIEW_WORK_REQUEST'),
      ('ASSIGN_WORK_REQUEST_MEMBER', 'VIEW_WORK_REQUEST'),
      ('SUBMIT_WORK_REQUEST', 'VIEW_WORK_REQUEST'),
      ('APPROVE_WORK_REQUEST_REVIEW', 'VIEW_WORK_REQUEST'),
      ('REQUEST_WORK_REQUEST_REVISION', 'VIEW_WORK_REQUEST'),

      -- Team management requires its Team page; membership additionally needs
      -- an eligible Member selector. Creating a Team also needs its Division selector.
      ('CREATE_TEAM', 'VIEW_TEAMS'),
      ('CREATE_TEAM', 'VIEW_DIVISIONS'),
      ('UPDATE_TEAM', 'VIEW_TEAMS'),
      ('DELETE_TEAM', 'VIEW_TEAMS'),
      ('ASSIGN_TEAM_MEMBER', 'VIEW_TEAMS'),
      ('ASSIGN_TEAM_MEMBER', 'VIEW_MEMBERS'),
      ('REMOVE_TEAM_MEMBER', 'VIEW_TEAMS'),
      ('REMOVE_TEAM_MEMBER', 'VIEW_MEMBERS'),

      -- Member onboarding selects a Division; later member actions use its detail/list.
      ('CREATE_MEMBER', 'VIEW_MEMBERS'),
      ('CREATE_MEMBER', 'VIEW_DIVISIONS'),
      ('UPDATE_MEMBER', 'VIEW_MEMBERS'),
      ('REMOVE_MEMBER', 'VIEW_MEMBERS'),
      ('LINK_MEMBER_ACCESS', 'VIEW_MEMBERS'),

      -- Client-contact actions are nested below the Client page.
      ('CREATE_CLIENT', 'VIEW_CLIENTS'),
      ('UPDATE_CLIENT', 'VIEW_CLIENTS'),
      ('DEACTIVATE_CLIENT', 'VIEW_CLIENTS'),
      ('REACTIVATE_CLIENT', 'VIEW_CLIENTS'),
      ('CREATE_CLIENT_CONTACT', 'VIEW_CLIENTS'),
      ('CREATE_CLIENT_CONTACT', 'VIEW_CLIENT_CONTACTS'),
      ('UPDATE_CLIENT_CONTACT', 'VIEW_CLIENTS'),
      ('UPDATE_CLIENT_CONTACT', 'VIEW_CLIENT_CONTACTS'),
      ('DEACTIVATE_CLIENT_CONTACT', 'VIEW_CLIENTS'),
      ('DEACTIVATE_CLIENT_CONTACT', 'VIEW_CLIENT_CONTACTS'),
      ('REACTIVATE_CLIENT_CONTACT', 'VIEW_CLIENTS'),
      ('REACTIVATE_CLIENT_CONTACT', 'VIEW_CLIENT_CONTACTS'),
      ('SET_PRIMARY_CLIENT_CONTACT', 'VIEW_CLIENTS'),
      ('SET_PRIMARY_CLIENT_CONTACT', 'VIEW_CLIENT_CONTACTS'),
      ('GRANT_CLIENT_PORTAL_ACCESS', 'VIEW_CLIENTS'),
      ('GRANT_CLIENT_PORTAL_ACCESS', 'VIEW_CLIENT_CONTACTS'),
      ('REVOKE_CLIENT_PORTAL_ACCESS', 'VIEW_CLIENTS'),
      ('REVOKE_CLIENT_PORTAL_ACCESS', 'VIEW_CLIENT_CONTACTS'),

      -- Division management uses its detail/list; lead selection needs Members.
      ('CREATE_DIVISION', 'VIEW_DIVISIONS'),
      ('UPDATE_DIVISION', 'VIEW_DIVISIONS'),
      ('DELETE_DIVISION', 'VIEW_DIVISIONS'),
      ('ASSIGN_DIVISION_LEAD', 'VIEW_DIVISIONS'),
      ('ASSIGN_DIVISION_LEAD', 'VIEW_MEMBERS'),
      ('REVOKE_DIVISION_LEAD', 'VIEW_DIVISIONS'),
      ('REVOKE_DIVISION_LEAD', 'VIEW_MEMBERS')
  ) AS requested(permission_code, required_permission_code)
  JOIN public.permissions AS permission
    ON permission.code::text = requested.permission_code
  JOIN public.permissions AS required_permission
    ON required_permission.code::text = requested.required_permission_code;

  IF resolved_edge_count <> expected_edge_count THEN
    RAISE EXCEPTION
      'Functional permission dependency migration expected % catalogue edges but resolved %',
      expected_edge_count,
      resolved_edge_count;
  END IF;
END;
$migration$;

INSERT INTO public.permission_dependencies (permission_id, required_permission_id)
SELECT permission.id, required_permission.id
FROM (
  VALUES
    ('UPLOAD_DOCUMENT', 'VIEW_DOCUMENT'), ('SUBMIT_DOCUMENT', 'VIEW_DOCUMENT'),
    ('CREATE_DOCUMENT_CODE', 'VIEW_DOCUMENT_CODES'), ('UPDATE_DOCUMENT_CODE', 'VIEW_DOCUMENT_CODES'),
    ('DELETE_DOCUMENT_CODE', 'VIEW_DOCUMENT_CODES'), ('DEACTIVATE_DOCUMENT_CODE', 'VIEW_DOCUMENT_CODES'),
    ('REACTIVATE_DOCUMENT_CODE', 'VIEW_DOCUMENT_CODES'),
    ('CREATE_BID', 'VIEW_BID'), ('UPDATE_BID', 'VIEW_BID'), ('ARCHIVE_BID', 'VIEW_BID'),
    ('RESTORE_BID', 'VIEW_BID'), ('DECIDE_BID_OUTCOME', 'VIEW_BID'), ('REQUEST_ARCHIVED_BID_REVIEW', 'VIEW_BID'),
    ('CREATE_PROJECT', 'VIEW_PROJECT'), ('UPDATE_PROJECT', 'VIEW_PROJECT'), ('ARCHIVE_PROJECT', 'VIEW_PROJECT'),
    ('RESTORE_PROJECT', 'VIEW_PROJECT'),
    ('CREATE_WORK_REQUEST', 'VIEW_WORK_REQUEST'), ('UPDATE_WORK_REQUEST', 'VIEW_WORK_REQUEST'),
    ('CREATE_WORK_REQUEST_NOTE', 'VIEW_WORK_REQUEST'), ('ASSIGN_WORK_REQUEST_DIVISION', 'VIEW_WORK_REQUEST'),
    ('ASSIGN_WORK_REQUEST_TEAM', 'VIEW_WORK_REQUEST'), ('ASSIGN_WORK_REQUEST_MEMBER', 'VIEW_WORK_REQUEST'),
    ('SUBMIT_WORK_REQUEST', 'VIEW_WORK_REQUEST'), ('APPROVE_WORK_REQUEST_REVIEW', 'VIEW_WORK_REQUEST'),
    ('REQUEST_WORK_REQUEST_REVISION', 'VIEW_WORK_REQUEST'),
    ('CREATE_TEAM', 'VIEW_TEAMS'), ('CREATE_TEAM', 'VIEW_DIVISIONS'), ('UPDATE_TEAM', 'VIEW_TEAMS'),
    ('DELETE_TEAM', 'VIEW_TEAMS'), ('ASSIGN_TEAM_MEMBER', 'VIEW_TEAMS'), ('ASSIGN_TEAM_MEMBER', 'VIEW_MEMBERS'),
    ('REMOVE_TEAM_MEMBER', 'VIEW_TEAMS'), ('REMOVE_TEAM_MEMBER', 'VIEW_MEMBERS'),
    ('CREATE_MEMBER', 'VIEW_MEMBERS'), ('CREATE_MEMBER', 'VIEW_DIVISIONS'), ('UPDATE_MEMBER', 'VIEW_MEMBERS'),
    ('REMOVE_MEMBER', 'VIEW_MEMBERS'), ('LINK_MEMBER_ACCESS', 'VIEW_MEMBERS'),
    ('CREATE_CLIENT', 'VIEW_CLIENTS'), ('UPDATE_CLIENT', 'VIEW_CLIENTS'), ('DEACTIVATE_CLIENT', 'VIEW_CLIENTS'),
    ('REACTIVATE_CLIENT', 'VIEW_CLIENTS'), ('CREATE_CLIENT_CONTACT', 'VIEW_CLIENTS'),
    ('CREATE_CLIENT_CONTACT', 'VIEW_CLIENT_CONTACTS'), ('UPDATE_CLIENT_CONTACT', 'VIEW_CLIENTS'),
    ('UPDATE_CLIENT_CONTACT', 'VIEW_CLIENT_CONTACTS'), ('DEACTIVATE_CLIENT_CONTACT', 'VIEW_CLIENTS'),
    ('DEACTIVATE_CLIENT_CONTACT', 'VIEW_CLIENT_CONTACTS'), ('REACTIVATE_CLIENT_CONTACT', 'VIEW_CLIENTS'),
    ('REACTIVATE_CLIENT_CONTACT', 'VIEW_CLIENT_CONTACTS'), ('SET_PRIMARY_CLIENT_CONTACT', 'VIEW_CLIENTS'),
    ('SET_PRIMARY_CLIENT_CONTACT', 'VIEW_CLIENT_CONTACTS'), ('GRANT_CLIENT_PORTAL_ACCESS', 'VIEW_CLIENTS'),
    ('GRANT_CLIENT_PORTAL_ACCESS', 'VIEW_CLIENT_CONTACTS'), ('REVOKE_CLIENT_PORTAL_ACCESS', 'VIEW_CLIENTS'),
    ('REVOKE_CLIENT_PORTAL_ACCESS', 'VIEW_CLIENT_CONTACTS'),
    ('CREATE_DIVISION', 'VIEW_DIVISIONS'), ('UPDATE_DIVISION', 'VIEW_DIVISIONS'),
    ('DELETE_DIVISION', 'VIEW_DIVISIONS'), ('ASSIGN_DIVISION_LEAD', 'VIEW_DIVISIONS'),
    ('ASSIGN_DIVISION_LEAD', 'VIEW_MEMBERS'), ('REVOKE_DIVISION_LEAD', 'VIEW_DIVISIONS'),
    ('REVOKE_DIVISION_LEAD', 'VIEW_MEMBERS')
) AS requested(permission_code, required_permission_code)
JOIN public.permissions AS permission
  ON permission.code::text = requested.permission_code
JOIN public.permissions AS required_permission
  ON required_permission.code::text = requested.required_permission_code
ON CONFLICT (permission_id, required_permission_id) DO NOTHING;
