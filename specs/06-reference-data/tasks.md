# Tasks: 06 — Reference Data Domain

- [ ] **Coordinate the four child modules without a generic public CRUD API.**
      VERIFY: test -f specs/06.1-pol/SPEC.md && test -f specs/06.2-pod/SPEC.md && test -f specs/06.3-cargo-codes/SPEC.md && test -f specs/06.4-vessel-codes/SPEC.md
- [ ] **Owner: apply and runtime-verify the prepared normalized OptionValue uniqueness migration.**
      VERIFY: test -f prisma/migrations/20260916000004_add_option_value_normalized_uniqueness/migration.sql && grep -q "option_values_tenant_type_normalized_name_unique" prisma/migrations/20260916000004_add_option_value_normalized_uniqueness/migration.sql && grep -q "option_values_tenant_type_normalized_code_unique" prisma/migrations/20260916000004_add_option_value_normalized_uniqueness/migration.sql
- [ ] **Owner: apply and runtime-verify the prepared global OptionType metadata migration.**
      VERIFY: test -f prisma/migrations/20260916000005_provision_option_types/migration.sql && grep -q "ON CONFLICT (\"code\") DO NOTHING" prisma/migrations/20260916000005_provision_option_types/migration.sql
- [ ] **Owner: apply and runtime-verify the prepared Module 06 app-user privilege migration.**
      VERIFY: test -f prisma/migrations/20260916000006_grant_option_value_runtime_access/migration.sql && grep -q 'GRANT SELECT ON TABLE "option_types" TO app_user;' prisma/migrations/20260916000006_grant_option_value_runtime_access/migration.sql
