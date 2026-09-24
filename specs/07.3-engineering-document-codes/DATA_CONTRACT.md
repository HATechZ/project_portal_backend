# Data Contract: Engineering Document Codes

**REQUIRED NOW:** tenant + explicit Engineering ownership, generic code/name/optional description/active lifecycle, uniqueness within tenant+Engineering, no cross-module mutation, and idempotent future provisioning of all 29 supplied separate starter records. The catalogue is extendable and has no numeric range rule. Preserve `documentCodeId`/`documentCodeIds[]`.

Future implementation reuses shared `DocumentCodeOption` persistence with explicit document-group ownership (`GENERAL`, `MARKETING`, `ETC`, `ENGINEERING`, `PROJECT_MANAGEMENT_OPERATION`). General's tenant-scoped RLS/grant model applies; this module independently enforces Engineering ownership. `MANAGE_GENERAL_DOCUMENT_CODES` is temporarily reused through the current authorization pattern, without hard-coded roles or wildcard bypass.
