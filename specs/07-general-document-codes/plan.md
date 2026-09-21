# Plan: 07 — General Document Codes

1. Add `MANAGE_GENERAL_DOCUMENT_CODES`, seed it only to `system_admin`, `division_head`, and `division_lead`, and add a migration granting `app_user` only `SELECT`, `INSERT`, and `UPDATE` on `document_code_options` while preserving RLS.
2. Build `GeneralDocumentCodeModule` as controller → service → repository using the existing UoW and a fixed `DocumentGroupCode.MARKETING` predicate.
3. Add create/update DTOs that normalize code by trim + uppercase, preserve leading zeroes, trim/nonblank names, accept optional description, and reject tenant/group/lifecycle/sort-order fields.
4. Implement the seven routes, controller-wide dedicated permission, status query (`active|inactive|all`, default active), dedicated deactivated list, deterministic `sortOrder,code,id` list order, and no direct role/custom-role/tenantWide restriction.
5. Implement same-tenant/wrong-group-hidden reads, normalized duplicate handling, mutable referenced records, lifecycle transitions, and no hard delete.
6. Integrate an atomic tenant provisioner that creates the eight initial rows for new tenants and missing-only rows for existing tenants, preserving all same-code/custom rows exactly under concurrency.
7. Keep Document integration deferred except for documenting future tenant + fixed-General selection validation; option edits must not rename persisted filenames.
8. Add focused tests, static SDD assertions, and the Gate 5 HTTP/RLS walkthrough. This module does not modify Module 06.x.
