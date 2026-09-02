-- Read-only named catalog verification. Every assertion row must report true.
SELECT 'divisions_id_tenant_id_company_id_key' AS assertion,
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'divisions_id_tenant_id_company_id_key') AS passed
UNION ALL
SELECT 'members_division_id_tenant_id_company_id_fkey',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_division_id_tenant_id_company_id_fkey')
UNION ALL
SELECT 'teams_division_id_tenant_id_company_id_fkey',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_division_id_tenant_id_company_id_fkey')
UNION ALL
SELECT 'workflow_transitions_active_exact_rule_key',
       to_regclass('public.workflow_transitions_active_exact_rule_key') IS NOT NULL
UNION ALL
SELECT 'actor_profiles_at_most_one_business_target',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'actor_profiles_at_most_one_business_target')
UNION ALL
SELECT 'actor_profiles_one_default_per_user',
       to_regclass('public.actor_profiles_one_default_per_user') IS NOT NULL;
