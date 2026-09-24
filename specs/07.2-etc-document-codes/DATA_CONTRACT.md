# Data Contract: ETC Document Codes

**REQUIRED NOW:** tenant and explicit ETC ownership; code/name/optional description/active state under current conventions; uniqueness within tenant+ETC; no cross-module mutation; starter records are idempotent future seed data, not a closed catalogue. Preserve generic `documentCodeId`/`documentCodeIds[]` integration.

Future implementation reuses shared `DocumentCodeOption` persistence with explicit document-group ownership (`GENERAL`, `MARKETING`, `ETC`, `ENGINEERING`, `PROJECT_MANAGEMENT_OPERATION`). It reuses General's tenant-scoped RLS/grant model and adds ETC ownership predicates in its independent repository. `MANAGE_GENERAL_DOCUMENT_CODES` is temporarily reused through the current authorization pattern, with no hard-coded role or wildcard bypass.
