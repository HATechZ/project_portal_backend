# Data Contract: Marketing Document Codes

**REQUIRED NOW:** tenant-owned, explicitly Marketing-owned master data with code, name, optional description, active state and current audit/timestamp conventions. Code is required, trimmed/normalized by current conventions, unique within the tenant and Marketing ownership, and is not numerically classified. Cross-module reads/mutations are forbidden conceptually.

Starter provisioning is missing-only/idempotent when implemented and must not make the catalogue closed. Future implementation reuses shared `DocumentCodeOption` persistence and explicit document-group ownership (`GENERAL`, `MARKETING`, `ETC`, `ENGINEERING`, `PROJECT_MANAGEMENT_OPERATION`); no Marketing-specific FK is introduced. RLS and grants reuse General's tenant-scoped model, while this module's repository additionally constrains Marketing ownership.

`MANAGE_GENERAL_DOCUMENT_CODES` is temporarily reused through the current authorization pattern; no role is hard-coded and no wildcard bypass is added. Existing `802`/`803` must become/remain Marketing-owned without duplicate rows, ID/FK changes, or historical filename changes; a future forward migration may safely reclassify ownership.
