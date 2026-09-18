-- Enforce tenant- and OptionType-scoped normalized OptionValue identities.
-- The existing raw (tenant_id, option_type_id, name) unique constraint remains in place.
--
-- Rollback:
-- DROP INDEX "option_values_tenant_type_normalized_code_unique";
-- DROP INDEX "option_values_tenant_type_normalized_name_unique";

CREATE UNIQUE INDEX "option_values_tenant_type_normalized_name_unique"
ON "option_values" ("tenant_id", "option_type_id", lower(btrim("name")));

CREATE UNIQUE INDEX "option_values_tenant_type_normalized_code_unique"
ON "option_values" ("tenant_id", "option_type_id", upper(btrim("code")))
WHERE "code" IS NOT NULL;
