# Tasks: 07 — General Document Codes

## Prerequisites

- [ ] Add `MANAGE_GENERAL_DOCUMENT_CODES`; seed it only to `system_admin`, `division_head`, and `division_lead`, with no custom-role grant.
      VERIFY: `Select-String -Path prisma/schema.prisma,prisma/seed/data/permissions.data.ts -Pattern 'MANAGE_GENERAL_DOCUMENT_CODES|system_admin|division_head|division_lead'`
- [ ] Grant `app_user` only SELECT, INSERT, UPDATE on `document_code_options`, retaining RLS and withholding DELETE, ALL, and BYPASSRLS.
      VERIFY: `Select-String -Path prisma/migrations/*/migration.sql -Pattern 'GRANT SELECT, INSERT, UPDATE ON TABLE document_code_options TO app_user|BYPASSRLS'`

## Implementation

- [ ] Create the dedicated module/controller/service/repository surface without generic CRUD or DELETE.
      VERIFY: `Test-Path src/general-document-code/general-document-code.module.ts; -not (Select-String -Path src/general-document-code/**/*.ts -Pattern '@Delete|deleteGeneralDocumentCode' -ErrorAction SilentlyContinue)`
- [ ] Implement all seven routes with exact Swagger summaries and `General Document Code DocumentCodeOption ID` parameter descriptions.
      VERIFY: `Select-String -Path src/general-document-code/**/*.ts -Pattern 'List all General Document Codes|List deactivated General Document Codes|Get General Document Code by ID|Create a new General Document Code|Update General Document Code by ID|Deactivate General Document Code by ID|Reactivate General Document Code by ID|General Document Code DocumentCodeOption ID'`
- [ ] Implement `status=active|inactive|all`, default active, the dedicated deactivated list, and `sortOrder,code,id` ordering without sort-order mutation.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=general-document-code`
- [ ] Derive tenant from TenantContext, fix `DocumentGroupCode.MARKETING`, hide group, and normalize code with trim + uppercase while preserving leading zeroes; trim/nonblank name and permit no name uniqueness.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=general-document-code`
- [ ] Allow code/name/description updates, including referenced rows, without changing persisted filenames; implement duplicate and lifecycle conflicts without hard delete.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=general-document-code`
- [ ] Apply controller-wide `MANAGE_GENERAL_DOCUMENT_CODES` through the standard guard chain without direct role checks, custom-role grants, or Module 06 tenantWide restriction.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=general-document-code`
- [ ] Provision eight initial rows for new tenants and safe missing-only backfill for existing tenants, preserving same-code and custom rows exactly under concurrency.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=general-document-code`

## Verification

- [ ] Add focused tests for CRUD/status/lifecycle/no-delete/normalization/tenant/group/permission/provisioning/reference/filename behavior.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=general-document-code`
- [ ] Independently verify assertions and complete the Gate 5 HTTP/RLS walkthrough after runtime implementation.
      VERIFY: `Test-Path specs/07-general-document-codes/walkthrough.md`
