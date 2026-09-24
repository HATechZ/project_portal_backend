# Data Contract: PM & Operation Document Codes

**REQUIRED NOW:** tenant and explicit module ownership; code/name/optional description/active state; tenant+module uniqueness; no cross-module mutation; future idempotent starter provisioning; extendable catalogue; no numeric restrictions. Preserve generic `documentCodeId`/`documentCodeIds[]` file integration.

Future implementation reuses shared `DocumentCodeOption` persistence with explicit document-group ownership (`GENERAL`, `MARKETING`, `ETC`, `ENGINEERING`, `PROJECT_MANAGEMENT_OPERATION`). General's tenant-scoped RLS/grant model applies; this module independently enforces PM & Operation ownership. `MANAGE_GENERAL_DOCUMENT_CODES` is temporarily reused through the current authorization pattern, without hard-coded roles or wildcard bypass.
