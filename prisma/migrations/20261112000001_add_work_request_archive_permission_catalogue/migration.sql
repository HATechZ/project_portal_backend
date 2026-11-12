-- Register the two global, reusable Module 10 archive capabilities after their
-- enum labels have committed in the preceding migration. No role receives an
-- implicit grant; endpoint authorization still requires permission, compatible
-- scope, tenant, resource relationship, and lifecycle validity.
--
-- Rollback: revoke reviewed active grants of these permissions, delete the two
-- dependency and compatibility rows, delete the catalogue rows, then rebuild
-- permission_code without the labels only after the preceding lifecycle
-- migration has been rolled back.

INSERT INTO public.permissions
  (code, display_name, description, category, action_type, resource)
VALUES
  ('ARCHIVE_WORK_REQUEST', 'Archive work request',
   'Archive a Work Request without deleting its workflow or historical data.',
   'WORK_REQUESTS', 'ARCHIVE', 'Work request'),
  ('RESTORE_WORK_REQUEST', 'Restore work request',
   'Restore an archived Work Request to its preserved execution state.',
   'WORK_REQUESTS', 'OTHER', 'Work request')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.permission_scope_compatibilities (permission_id, scope)
SELECT permission.id, requested.scope
FROM public.permissions AS permission
JOIN (
  VALUES
    ('ARCHIVE_WORK_REQUEST'::public.permission_code, 'company'::public.custom_role_scope),
    ('ARCHIVE_WORK_REQUEST'::public.permission_code, 'division'::public.custom_role_scope),
    ('RESTORE_WORK_REQUEST'::public.permission_code, 'company'::public.custom_role_scope),
    ('RESTORE_WORK_REQUEST'::public.permission_code, 'division'::public.custom_role_scope)
) AS requested(code, scope) ON permission.code = requested.code
ON CONFLICT (permission_id, scope) DO NOTHING;

INSERT INTO public.permission_dependencies (permission_id, required_permission_id)
SELECT permission.id, required_permission.id
FROM (
  VALUES
    ('ARCHIVE_WORK_REQUEST', 'VIEW_WORK_REQUEST'),
    ('RESTORE_WORK_REQUEST', 'VIEW_WORK_REQUEST')
) AS requested(permission_code, required_permission_code)
JOIN public.permissions AS permission
  ON permission.code::text = requested.permission_code
JOIN public.permissions AS required_permission
  ON required_permission.code::text = requested.required_permission_code
ON CONFLICT (permission_id, required_permission_id) DO NOTHING;
