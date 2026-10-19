# SPEC: 10.2 — Document Management Reads, Tree, Naming & Version Policy

**Status:** authoritative next-week contract; implementation not started. **Depends on:** `10.1-documents` upload/session and formal-revision contracts. **Boundary:** logical document management reads only; no storage provider, upload, schema, migration, C1/C2/C3, or workflow redesign.

## Audit

| Task | Status | Contract action |
|---|---|---|
| generated filename / immutable version / exact C1 package links | PARTIAL | preserve current canonical facts; complete read/naming policy |
| Bid alphabetic revision | PARTIAL | freeze initial `A` and server progression policy |
| Project numeric revision | MISSING | owner format decision required |
| logical tree, search, preview, download | MISSING | new provider-neutral read contracts |
| folder tree queries / authorization tests | MISSING | new next-week requirements |

All authorization remains permission + compatible scope + tenant/resource/parent visibility + exact relationship where required. Role/title/custom-code/department/file-name authorization is forbidden. C1 exact submitted-version access and C2/C3 remain unchanged.

See [Naming & Version Policy](DOCUMENT_NAMING_REVISION_VERSION.md), [Logical Tree, Search & Reads](DOCUMENT_TREE_SEARCH_READS.md), [API Contract](API_CONTRACT.md), and [Data Contract](DATA_CONTRACT.md).
