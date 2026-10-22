[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$validationHost = '127.0.0.1'
$validationPort = '55432'
$validationDatabase = 'portal_wr_validation'
$validationUser = 'portal_validation_owner'
$validationUrl = "postgresql://${validationUser}@${validationHost}:${validationPort}/${validationDatabase}?schema=public"
$cutoffMigration = '20260929000000_rename_system_admin_to_tenant_super_admin'
$repoRoot = Split-Path -Parent $PSScriptRoot
$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) 'project-portal-phase2-migrations'
$stagingMigrations = Join-Path $stagingRoot 'migrations'

# This script owns only the dedicated Compose project and loopback target. It never
# reads DATABASE_URL and refuses any target other than the disposable validation DB.
if ($validationHost -ne '127.0.0.1' -or $validationPort -ne '55432' -or $validationDatabase -ne 'portal_wr_validation') {
  throw 'Validation target safety check failed.'
}

Push-Location $repoRoot
try {
  docker compose -f docker-compose.validation.yml down -v --remove-orphans | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Could not reset the disposable validation Compose project.' }
  docker compose -f docker-compose.validation.yml up -d --wait | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Could not start the disposable validation Compose project.' }

  Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Path $stagingMigrations -Force | Out-Null
  Get-ChildItem prisma/migrations -Directory |
    Where-Object { $_.Name -le $cutoffMigration } |
    ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $stagingMigrations -Recurse }

  $env:DATABASE_URL_MIGRATION = $validationUrl
  $env:PRISMA_VALIDATION_MIGRATIONS_PATH = $stagingMigrations
  & .\node_modules\.bin\prisma.cmd migrate deploy --config scripts/prisma-validation.config.ts
  if ($LASTEXITCODE -ne 0) { throw 'Pre-bootstrap migration deployment failed.' }

  # 20260929000000 intentionally renames a historical global role but does not
  # create it. This disposable-only fixture supplies the smallest valid predecessor:
  # one global system role and its subtype identity. The deferred role-shape trigger
  # validates both rows together at commit.
  $bootstrapSql = @'
BEGIN;
WITH inserted_role AS (
  INSERT INTO public.roles (id, tenant_id, name, description, is_system_role, custom_code, custom_scope)
  SELECT gen_random_uuid(), NULL, 'Tenant Super Administrator', 'Disposable validation prerequisite role', true, NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM public.system_roles WHERE system_code = 'tenant_super_admin'::public.actor_role_code)
  RETURNING id
)
INSERT INTO public.system_roles (role_id, system_code)
SELECT id, 'tenant_super_admin'::public.actor_role_code FROM inserted_role;
-- The original reference-data seed is intentionally not run by migration deploy.
-- This historical migration nevertheless asserts these exact seven catalogue rows.
-- Supply no tenant data and no grants here: the migration under test owns its grants.
INSERT INTO public.workflow_action_definitions (
  id, code, name, description, is_user_visible, is_revision_action,
  is_info_request_action, is_assignment_action, is_terminal_action
)
VALUES
  (gen_random_uuid(), 'ADD_WORK_REQUEST'::public.workflow_action_code, 'Add Work Request', 'Disposable validation prerequisite action', true, false, false, false, false),
  (gen_random_uuid(), 'ADD_WORK_REQUEST_DOCUMENT'::public.workflow_action_code, 'Add Work Request Document', 'Disposable validation prerequisite action', true, false, false, false, false),
  (gen_random_uuid(), 'ADD_WORK_REQUEST_NOTE'::public.workflow_action_code, 'Add Work Request Note', 'Disposable validation prerequisite action', true, false, false, false, false),
  (gen_random_uuid(), 'REQUEST_WORKFLOW_INFO'::public.workflow_action_code, 'Request Workflow Information', 'Disposable validation prerequisite action', true, false, true, false, false),
  (gen_random_uuid(), 'RESPOND_WORKFLOW_INFO'::public.workflow_action_code, 'Respond to Workflow Information', 'Disposable validation prerequisite action', true, false, true, false, false),
  (gen_random_uuid(), 'VIEW_WORK_REQUEST'::public.workflow_action_code, 'View Work Request', 'Disposable validation prerequisite action', true, false, false, false, false),
  (gen_random_uuid(), 'UPDATE_WORK_REQUEST'::public.workflow_action_code, 'Update Work Request', 'Disposable validation prerequisite action', true, false, false, false, false)
ON CONFLICT (code) DO NOTHING;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.system_roles WHERE system_code = 'tenant_super_admin'::public.actor_role_code) <> 1 THEN
    RAISE EXCEPTION 'Validation bootstrap requires exactly one tenant_super_admin role';
  END IF;
  IF (SELECT count(*) FROM public.workflow_action_definitions WHERE code IN (
    'ADD_WORK_REQUEST'::public.workflow_action_code,
    'ADD_WORK_REQUEST_DOCUMENT'::public.workflow_action_code,
    'ADD_WORK_REQUEST_NOTE'::public.workflow_action_code,
    'REQUEST_WORKFLOW_INFO'::public.workflow_action_code,
    'RESPOND_WORKFLOW_INFO'::public.workflow_action_code,
    'VIEW_WORK_REQUEST'::public.workflow_action_code,
    'UPDATE_WORK_REQUEST'::public.workflow_action_code
  )) <> 7 THEN
    RAISE EXCEPTION 'Validation bootstrap requires all tenant_super_admin Work Request actions';
  END IF;
END $$;
COMMIT;
'@
  $bootstrapSql | docker compose -f docker-compose.validation.yml exec -T postgres-validation psql -v ON_ERROR_STOP=1 -U $validationUser -d $validationDatabase
  if ($LASTEXITCODE -ne 0) { throw 'Disposable role bootstrap failed.' }

  $env:PRISMA_VALIDATION_MIGRATIONS_PATH = (Join-Path $repoRoot 'prisma/migrations')
  & .\node_modules\.bin\prisma.cmd migrate deploy --config scripts/prisma-validation.config.ts
  if ($LASTEXITCODE -ne 0) { throw 'Full disposable migration deployment failed.' }

  # Catalogue-only proof for C3 and Phase 2. The database is deliberately
  # seed-free, so this checks additive objects and protections without claiming
  # historical business data was manufactured for validation.
  $validationSql = @'
DO $$
DECLARE
  v_route_tables constant text[] := ARRAY[
    'work_request_routes','work_request_route_responsibility_changes','work_request_route_versions',
    'work_request_route_steps','work_request_division_cycles','work_request_team_steps',
    'work_request_member_steps','work_request_route_revisions','work_request_route_events',
    'work_request_route_projections','work_request_route_conversations','work_request_route_messages',
    'work_request_route_message_attachments','work_request_route_reconsiderations',
    'work_request_route_reconsideration_decisions'
  ];
  v_c3_tables constant text[] := ARRAY[
    'bid_business_cycles','bid_business_outcomes','bid_project_conversions','bid_archived_review_requests'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name = '20261016000000_add_bid_c3_business_cycles' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) THEN
    RAISE EXCEPTION 'C3 migration is not applied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name = '20261021000000_add_work_request_route_persistence' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) THEN
    RAISE EXCEPTION 'Phase 2 route persistence migration is not applied';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY(v_route_tables) AND c.relkind = 'r') <> cardinality(v_route_tables) THEN
    RAISE EXCEPTION 'Phase 2 route table catalogue is incomplete';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY(v_route_tables) AND c.relrowsecurity) <> cardinality(v_route_tables) THEN
    RAISE EXCEPTION 'Phase 2 route RLS is incomplete';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY(v_route_tables)
      AND roles = ARRAY['app_user']::name[] AND qual LIKE '%app.tenant_id%' AND with_check LIKE '%app.tenant_id%') <> cardinality(v_route_tables) THEN
    RAISE EXCEPTION 'Phase 2 route tenant policies are incomplete';
  END IF;
  IF (SELECT count(*) FROM unnest(v_route_tables) AS route_table
      WHERE NOT has_table_privilege('app_user', format('public.%I', route_table), 'SELECT,INSERT')) > 0
     OR (SELECT count(*) FROM unnest(ARRAY[
       'work_request_route_steps','work_request_division_cycles','work_request_team_steps',
       'work_request_member_steps','work_request_route_revisions','work_request_route_projections'
     ]) AS mutable_table
     WHERE NOT has_table_privilege('app_user', format('public.%I', mutable_table), 'UPDATE')) > 0 THEN
    RAISE EXCEPTION 'Phase 2 least-privilege grants are incomplete';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY(v_c3_tables) AND c.relrowsecurity) <> cardinality(v_c3_tables) THEN
    RAISE EXCEPTION 'C3 RLS is incomplete';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_requests_v1_bid_cycle_tenant_bid_fk')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_requests_v1_bid_cycle_parent_check')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'work_requests_v1_bid_cycle_immutable' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'C3 WorkRequestV1 compatibility protections are incomplete';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wr_routes_cutover' AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wr_routes_immutable' AND NOT tgisinternal)
     OR (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
         WHERE c.relname IN ('wr_route_steps_one_active_idx','wr_team_steps_one_active_idx',
                              'wr_member_steps_one_active_idx','wr_route_revisions_one_open_idx')
           AND i.indpred IS NOT NULL) <> 4
     OR NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_roles r ON r.oid = c.relowner
                    WHERE n.nspname = 'public' AND c.relname = 'work_request_routes' AND r.rolname NOT IN ('app_user','app_relay')) THEN
    RAISE EXCEPTION 'Phase 2 cutover/ownership protections are incomplete';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.work_request_routes (
      tenant_id, id, work_request_id, originating_division_id,
      responsible_originating_division_lead_id, cutover_at
    ) VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), CURRENT_TIMESTAMP);
    RAISE EXCEPTION 'Route cutover trigger did not reject a non-post-cutover anchor';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'route persistence requires a post-cutover Work Request' THEN RAISE; END IF;
  END;
END $$;
'@
  $validationSql | docker compose -f docker-compose.validation.yml exec -T postgres-validation psql -v ON_ERROR_STOP=1 -U $validationUser -d $validationDatabase
  if ($LASTEXITCODE -ne 0) { throw 'C3/Phase 2 catalogue, RLS, and cutover validation failed.' }
}
finally {
  Remove-Item Env:DATABASE_URL_MIGRATION -ErrorAction SilentlyContinue
  Remove-Item Env:PRISMA_VALIDATION_MIGRATIONS_PATH -ErrorAction SilentlyContinue
  Pop-Location
}
