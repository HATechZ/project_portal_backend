# Tasks: 01.1 — Schema Integrity & Tenant Isolation

**Status:** Gate 5 — verified
**Spec:** `SPEC.md` · **Plan:** `plan.md`

The owner-approved 2026-09-02 corrections replace the rejected destructive Phase 8–12 draft.

- [x] **Phase 5: Close gaps needing no migration**
  - [x] Derive tenant-scoped models from the schema
        VERIFY: test -f scripts/verify-tenant-scope.mjs && node scripts/verify-tenant-scope.mjs
  - [x] Fail build on tenant-scope drift
        VERIFY: grep -q "verify-tenant-scope" package.json
  - [x] Cache tenant activation checks
        VERIFY: grep -q "TenantActivationService" src/common/tenant/tenant-context.guard.ts && grep -q "RedisService" src/common/tenant/tenant-activation.service.ts
  - [x] Keep the tenant guard off concrete persistence
        VERIFY: ! grep -q "PrismaService" src/common/tenant/tenant-context.guard.ts
  - [x] Keep database constraint handling centralized
        VERIFY: test -f src/common/exceptions/prisma-exception.map.ts

- [x] **Phase 6: Row-level security**
  - [x] Declare the privileged connection across configuration
        VERIFY: grep -q "DATABASE_URL_PRIVILEGED" src/config/env.schema.ts && grep -q "DATABASE_URL_PRIVILEGED" src/config/configuration.ts && grep -q "DATABASE_URL_PRIVILEGED" src/config/env.ts && grep -q "DATABASE_URL_PRIVILEGED" .env.example
  - [x] Give the relay its own connection
        VERIFY: grep -qi "privileged" src/infra/prisma/prisma.service.ts && ! grep -qi "privileged" src/infra/prisma/tenant-prisma.extension.ts
  - [x] Set the tenant GUC first in each unit of work
        VERIFY: grep -q "app.tenant_id" src/infra/prisma/unit-of-work.service.ts
  - [x] Bind the GUC rather than interpolate SQL
        VERIFY: grep -q "set_config" src/infra/prisma/unit-of-work.service.ts
  - [x] Route repositories through the unit of work
        VERIFY: test $(grep -rl "PrismaService" src --include='*.repository.ts' | wc -l) -eq 0 && test $(grep -rl "this\.db\." src --include='*.repository.ts' | wc -l) -eq 0
  - [x] Fail repository access without an active unit of work
        VERIFY: grep -q "Repository access requires an active unit of work" src/infra/prisma/unit-of-work.service.ts && node node_modules/jest/bin/jest.js --runInBand unit-of-work.service.spec.ts
  - [x] Enable RLS on every scoped table and tenant root
        VERIFY: test $(grep -rho "ENABLE ROW LEVEL SECURITY" prisma/migrations/ | wc -l) -ge 53
  - [x] Install every isolation policy
        VERIFY: test $(grep -rho "CREATE POLICY tenant_isolation_" prisma/migrations/ | wc -l) -ge 53
  - [x] Fail closed without tenant context
        VERIFY: test $(grep -rho "CREATE POLICY tenant_isolation_" prisma/migrations/ | wc -l) -ge 53 && ! grep -rq "app.tenant_id', true" prisma/migrations/
  - [x] Separate relay privilege from the app role
        VERIFY: grep -rq "BYPASSRLS" prisma/migrations/
  - [x] Keep admin credentials and role-name enforcement out of NestJS runtime
        VERIFY: ! grep -rq "DATABASE_URL_MIGRATION" src .env.example && ! grep -rq "assertDatabaseRole" src && test ! -f src/infra/prisma/database-role.assertion.ts && test ! -f src/infra/prisma/database-role.assertion.spec.ts

- [x] **Phase 7: Tenant-carrying FKs**
  - [x] Install the eight named parent handles
        VERIFY: for n in projects divisions work_requests documents members client_contacts notifications actor_profiles; do grep -q "${n}_id_tenant_id_key" prisma/migrations/20260902000000_carry_tenant_composite_foreign_keys/migration.sql || exit 1; done
  - [x] Install all eleven named tenant-carrying FKs
        VERIFY: for n in documents_project_id_tenant_id_fkey work_requests_project_id_tenant_id_fkey work_requests_assigned_division_id_tenant_id_fkey work_requests_origin_division_id_tenant_id_fkey registry_documents_project_id_tenant_id_fkey registry_documents_work_request_id_tenant_id_fkey registry_documents_document_id_tenant_id_fkey actor_profiles_member_id_tenant_id_fkey actor_profiles_client_contact_id_tenant_id_fkey notification_recipients_notification_id_tenant_id_fkey notification_recipients_actor_id_tenant_id_fkey; do grep -q "ADD CONSTRAINT \"$n\"" prisma/migrations/20260902000000_carry_tenant_composite_foreign_keys/migration.sql || exit 1; done
  - [x] Enforce optional Document → WorkRequest project coherence
        VERIFY: grep -q 'documents_work_request_id_project_id_fkey' prisma/migrations/20260902000000_carry_tenant_composite_foreign_keys/migration.sql && grep -q 'work_requests_id_project_id_key' prisma/migrations/20260902000000_carry_tenant_composite_foreign_keys/migration.sql
  - [x] Preserve column-selective nullable SET NULL behavior
        VERIFY: grep -q 'SET NULL ("work_request_id")' prisma/migrations/20260902000000_carry_tenant_composite_foreign_keys/migration.sql && grep -q 'SET NULL ("document_id")' prisma/migrations/20260902000000_carry_tenant_composite_foreign_keys/migration.sql && grep -q 'SET NULL ("member_id")' prisma/migrations/20260902000000_carry_tenant_composite_foreign_keys/migration.sql && grep -q 'SET NULL ("client_contact_id")' prisma/migrations/20260902000000_carry_tenant_composite_foreign_keys/migration.sql
  - [x] Ship preflight, verification, and rollback
        VERIFY: test -f specs/01.1-schema-integrity/phase7-preflight.sql && test -f specs/01.1-schema-integrity/phase7-verification.sql && test -f specs/01.1-schema-integrity/phase7-rollback.sql

- [x] **Phase 8: Preserve intentional organization and document state**
  - [x] Retain company fields and enforce division/company/tenant agreement
        VERIFY: grep -q 'members_division_id_tenant_id_company_id_fkey' prisma/migrations/20260902010000_harden_retained_architecture/migration.sql && grep -q 'teams_division_id_tenant_id_company_id_fkey' prisma/migrations/20260902010000_harden_retained_architecture/migration.sql
  - [x] Retain Bid-era name/code snapshots
        VERIFY: awk '/^model BidDetail \{/,/^\}/' prisma/schema.prisma | grep -q 'projectName' && awk '/^model BidDetail \{/,/^\}/' prisma/schema.prisma | grep -q 'projectCode'
  - [x] Keep folder path as logical cache, parent authoritative, storage separate
        VERIFY: grep -q 'document_version_folder_locations.folder_path' specs/01.1-schema-integrity/DATA_CONTRACT.md && grep -q 'document_folders.parent_folder_id' specs/01.1-schema-integrity/DATA_CONTRACT.md && grep -q 'storage_key' specs/01.1-schema-integrity/DATA_CONTRACT.md
  - [x] Reject organization mismatches before mutation
        VERIFY: grep -q 'FROM members AS m' specs/01.1-schema-integrity/phase8-12-preflight.sql && grep -q 'FROM teams AS t' specs/01.1-schema-integrity/phase8-12-preflight.sql

- [x] **Phase 9: Prevent only exact active transition duplicates**
  - [x] Retain nullable source and target roles
        VERIFY: awk '/^model WorkflowTransition \{/,/^\}/' prisma/schema.prisma | grep -q 'fromRoleId String?' && awk '/^model WorkflowTransition \{/,/^\}/' prisma/schema.prisma | grep -q 'targetRoleId String?'
  - [x] Keep permissions separate from contextual routing
        VERIFY: grep -q '^model WorkflowActionRolePermission {' prisma/schema.prisma && awk '/^model WorkflowTransition \{/,/^\}/' prisma/schema.prisma | grep -q 'requiresAssignment'
  - [x] Forbid exact active duplicates with NULL-safe semantics
        VERIFY: grep -q 'workflow_transitions_active_exact_rule_key' prisma/migrations/20260902010000_harden_retained_architecture/migration.sql && grep -q 'NULLS NOT DISTINCT' prisma/migrations/20260902010000_harden_retained_architecture/migration.sql && grep -q 'WHERE "is_active" = true' prisma/migrations/20260902010000_harden_retained_architecture/migration.sql
  - [x] Reject the unsafe action/source-status triple uniqueness
        VERIFY: ! grep -q '@@unique(\[tenantId, actionId, fromStatusId\])' prisma/schema.prisma

- [x] **Phase 10: Retain the approved identity architecture**
  - [x] Keep User; do not add Person/UserAccount
        VERIFY: grep -q '^model User {' prisma/schema.prisma && ! grep -qE '^model (Person|UserAccount) {' prisma/schema.prisma
  - [x] Keep Member identity and optional User link
        VERIFY: awk '/^model Member \{/,/^\}/' prisma/schema.prisma | grep -q 'name String' && awk '/^model Member \{/,/^\}/' prisma/schema.prisma | grep -q 'email String' && awk '/^model Member \{/,/^\}/' prisma/schema.prisma | grep -q 'userId String?'
  - [x] Keep ClientContact identity and optional User link
        VERIFY: awk '/^model ClientContact \{/,/^\}/' prisma/schema.prisma | grep -q 'name String' && awk '/^model ClientContact \{/,/^\}/' prisma/schema.prisma | grep -q 'email String' && awk '/^model ClientContact \{/,/^\}/' prisma/schema.prisma | grep -q 'userId String?'
  - [x] Avoid speculative tenure, legacy-user, or credential-copy schema
        VERIFY: ! awk '/^Table members \{/,/^\}/' project_portal_workflow_management_erd.dbml | grep -qE 'joined_at|left_at' && ! grep -qE '^Table (people|user_accounts|users_legacy)' project_portal_workflow_management_erd.dbml

- [x] **Phase 11: Constrain existing ActorProfile union**
  - [x] Permit zero or one business target, never both
        VERIFY: grep -q 'actor_profiles_at_most_one_business_target' prisma/migrations/20260902010000_harden_retained_architecture/migration.sql && grep -q 'member_id.*IS NOT NULL AND "client_contact_id" IS NOT NULL' prisma/migrations/20260902010000_harden_retained_architecture/migration.sql
  - [x] Permit one default per non-null tenant/user
        VERIFY: grep -q 'actor_profiles_one_default_per_user' prisma/migrations/20260902010000_harden_retained_architecture/migration.sql && grep -q '"user_id" IS NOT NULL AND "is_default" = true' prisma/migrations/20260902010000_harden_retained_architecture/migration.sql
  - [x] Retain label without ActorKind or Person
        VERIFY: awk '/^model ActorProfile \{/,/^\}/' prisma/schema.prisma | grep -q 'label String' && ! grep -q 'enum ActorKind' prisma/schema.prisma && ! awk '/^model ActorProfile \{/,/^\}/' prisma/schema.prisma | grep -q 'personId'

- [x] **Phase 12: Retain configurable data; correct priority naming only**
  - [x] Keep all five table-backed lookup models
        VERIFY: test $(grep -cE '^model (WorkspaceType|AttachmentSourceType|AttachmentFileGroup|DecisionResult|InfoRequestStatus) \{' prisma/schema.prisma) -eq 5
  - [x] Generate WorkPriority while retaining work_priorities mapping
        VERIFY: grep -q '^model WorkPriority {' prisma/schema.prisma && grep -A10 '^model WorkPriority {' prisma/schema.prisma | grep -q '@@map("work_priorities")' && ! grep -q '^model WorkPrioritie {' prisma/schema.prisma
  - [x] Retain DocumentVersion text content
        VERIFY: awk '/^model DocumentVersion \{/,/^\}/' prisma/schema.prisma | grep -q 'textContent'
  - [x] Keep Work Request codes unique across soft deletion
        VERIFY: awk '/^model WorkRequest \{/,/^\}/' prisma/schema.prisma | grep -q '@@unique(\[tenantId, code\])' && ! grep -rq 'work_requests.*deleted_at IS NULL' prisma/migrations/
  - [x] Avoid blanket updatedAt rewriting
        VERIFY: ! grep -q 'updatedAt DateTime.*@updatedAt' prisma/schema.prisma

- [x] **Phase 13: Gate 4 close-out**
  - [x] Lint and build clean
        VERIFY: corepack yarn lint && corepack yarn build
  - [x] Every schema change was proposed before preparation
        VERIFY: grep -q '^## 2. Proposed schema change' specs/01.1-schema-integrity/DATA_CONTRACT.md
  - [x] The module remains visible on the status surface
        VERIFY: grep -q '01.1-schema-integrity' specs/INDEX.md
  - [x] The tenant boundary remains asserted
        VERIFY: node scripts/verify-tenant-scope.mjs && test $(grep -rho 'CREATE POLICY tenant_isolation_' prisma/migrations/ | wc -l) -ge 53
