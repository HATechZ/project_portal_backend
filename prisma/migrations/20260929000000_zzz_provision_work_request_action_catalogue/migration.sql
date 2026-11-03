-- Bootstrap the exact Work Request action catalogue consumed by
-- 20260929000001_grant_tenant_super_admin_work_request_permissions.  The
-- original seed was the only source for these rows, but seed runs after all
-- migrations and therefore cannot satisfy this migration's precondition on a
-- clean database.
--
-- This bridge follows the tenant_super_admin bootstrap and precedes the grant
-- migration by lexical migration order. It is idempotent for environments
-- whose action definitions already exist.
--
-- Rollback: delete only these definitions after confirming no workflow action
-- grants, audit records, or other references depend on them. The enum labels
-- are historical catalogue values and are intentionally retained.

INSERT INTO public.workflow_action_definitions (
  id, code, name, description, is_user_visible, is_revision_action,
  is_info_request_action, is_assignment_action, is_terminal_action
)
VALUES
  (gen_random_uuid(), 'ADD_WORK_REQUEST'::public.workflow_action_code,
   'Add Work Request', 'Allows the add work request action.',
   true, false, false, false, false),
  (gen_random_uuid(), 'ADD_WORK_REQUEST_DOCUMENT'::public.workflow_action_code,
   'Add Work Request Document', 'Allows the add work request document action.',
   true, false, false, false, false),
  (gen_random_uuid(), 'ADD_WORK_REQUEST_NOTE'::public.workflow_action_code,
   'Add Work Request Note', 'Allows the add work request note action.',
   true, false, false, false, false),
  (gen_random_uuid(), 'REQUEST_WORKFLOW_INFO'::public.workflow_action_code,
   'Request Workflow Information', 'Allows requesting workflow information.',
   true, false, true, false, false),
  (gen_random_uuid(), 'RESPOND_WORKFLOW_INFO'::public.workflow_action_code,
   'Respond to Workflow Information', 'Allows responding to workflow information.',
   true, false, true, false, false),
  (gen_random_uuid(), 'VIEW_WORK_REQUEST'::public.workflow_action_code,
   'View Work Request', 'Allows the view work request action.',
   true, false, false, false, false),
  (gen_random_uuid(), 'UPDATE_WORK_REQUEST'::public.workflow_action_code,
   'Update Work Request', 'Allows the update work request action.',
   true, false, false, false, false)
ON CONFLICT (code) DO NOTHING;

DO $migration$
BEGIN
  IF (
    SELECT count(*)
    FROM public.workflow_action_definitions
    WHERE code IN (
      'ADD_WORK_REQUEST'::public.workflow_action_code,
      'ADD_WORK_REQUEST_DOCUMENT'::public.workflow_action_code,
      'ADD_WORK_REQUEST_NOTE'::public.workflow_action_code,
      'REQUEST_WORKFLOW_INFO'::public.workflow_action_code,
      'RESPOND_WORKFLOW_INFO'::public.workflow_action_code,
      'VIEW_WORK_REQUEST'::public.workflow_action_code,
      'UPDATE_WORK_REQUEST'::public.workflow_action_code
    )
  ) <> 7 THEN
    RAISE EXCEPTION 'Expected all required tenant_super_admin Work Request actions after bootstrap';
  END IF;
END;
$migration$;
