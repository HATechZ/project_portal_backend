-- Read-only. Every query must return zero rows before applying
-- 20260902010000_harden_retained_architecture.

SELECT m.id
FROM members AS m
LEFT JOIN divisions AS d
  ON d.id = m.division_id
 AND d.tenant_id = m.tenant_id
 AND d.company_id = m.company_id
WHERE d.id IS NULL;

SELECT t.id
FROM teams AS t
LEFT JOIN divisions AS d
  ON d.id = t.division_id
 AND d.tenant_id = t.tenant_id
 AND d.company_id = t.company_id
WHERE d.id IS NULL;

SELECT tenant_id, action_id, from_status_id, to_status_id, from_role_id,
       target_role_id, requires_assignment, is_backward_transition, sort_order,
       COUNT(*) AS duplicate_count
FROM workflow_transitions
WHERE is_active = true
GROUP BY tenant_id, action_id, from_status_id, to_status_id, from_role_id,
         target_role_id, requires_assignment, is_backward_transition, sort_order
HAVING COUNT(*) > 1;

SELECT id
FROM actor_profiles
WHERE member_id IS NOT NULL AND client_contact_id IS NOT NULL;

SELECT tenant_id, user_id, COUNT(*) AS default_count
FROM actor_profiles
WHERE user_id IS NOT NULL AND is_default = true
GROUP BY tenant_id, user_id
HAVING COUNT(*) > 1;
