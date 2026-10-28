-- A Division-scoped role that may create Bids must be able to resolve the
-- tenant-wide lookup catalogues required by the Create Bid form.
--
-- Rollback: revoke (do not delete) the active grants added by this migration
-- only for roles selected by this predicate. Keep the division compatibility
-- for VIEW_REFERENCE_DATA while any Division-scoped role needs tenant lookup
-- visibility.

-- Reference data is tenant-owned rather than creator-owned. Division-scoped
-- roles may therefore receive its view permission, while the read services
-- remain responsible for tenant isolation.
INSERT INTO public.permission_scope_compatibilities (permission_id, scope)
SELECT permission.id, 'division'::public.custom_role_scope
FROM public.permissions AS permission
WHERE permission.code = 'VIEW_REFERENCE_DATA'::public.permission_code
ON CONFLICT (permission_id, scope) DO NOTHING;

-- Preserve grant history: only add an active grant when the compatible,
-- active Division role currently has an active CREATE_BID grant and does not
-- already have the requested active lookup grant.
INSERT INTO public.role_permissions (tenant_id, role_id, permission_id)
SELECT bid_creator.tenant_id, bid_creator.role_id, lookup_permission.id
FROM (
  SELECT DISTINCT role_permission.tenant_id, role_permission.role_id
  FROM public.role_permissions AS role_permission
  JOIN public.roles AS role_definition
    ON role_definition.id = role_permission.role_id
  JOIN public.permissions AS permission
    ON permission.id = role_permission.permission_id
  WHERE permission.code = 'CREATE_BID'::public.permission_code
    AND role_permission.revoked_at IS NULL
    AND role_definition.is_system_role = false
    AND role_definition.is_active = true
    AND role_definition.retired_at IS NULL
    AND role_definition.custom_scope = 'division'::public.custom_role_scope
    AND role_definition.tenant_id = role_permission.tenant_id
) AS bid_creator
JOIN public.permissions AS lookup_permission
  ON lookup_permission.code IN (
    'VIEW_CLIENTS'::public.permission_code,
    'VIEW_REFERENCE_DATA'::public.permission_code,
    'VIEW_DOCUMENT_CODES'::public.permission_code
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM public.role_permissions AS existing_grant
  WHERE existing_grant.tenant_id = bid_creator.tenant_id
    AND existing_grant.role_id = bid_creator.role_id
    AND existing_grant.permission_id = lookup_permission.id
    AND existing_grant.revoked_at IS NULL
);
