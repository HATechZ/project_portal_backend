# API Contract: 10.2 — Document Management Reads

All responses use the global envelope; IDs are UUIDs; `x-request-id` applies to audit-capable download/preview access but no client storage key/path is accepted or returned.

| Method | Path | Contract |
|---|---|---|
| GET | `/api/v1/documents/tree` | lazy root/group children; optional `parentNodeId`, cursor, limit |
| GET | `/api/v1/documents/tree/:nodeId/children` | lazy authorized child nodes; cursor, limit |
| GET | `/api/v1/documents/search` | `q?`, `parentKind?`, `parentId?`, `workRequestId?`, `documentCodeId?`, `dateFrom?`, `dateTo?`, `revisionCode?`, `versionNumber?`, `mimeType?`, `uploaderId?`, `mode=latest|exact`, cursor, limit, sort |
| GET | `/api/v1/document-versions/:versionId` | exact safe version metadata |
| GET | `/api/v1/document-versions/:versionId/preview` | exact authorized preview; no raw key/path |
| GET | `/api/v1/document-versions/:versionId/download` | exact authorized attachment stream/presign |

Tree node: `{nodeId,type,label,parentNodeId?,hasChildren,itemCount?,file?}` where type is `ROOT|BID_GROUP|PROJECT_GROUP|BID|PROJECT|DOCUMENT_CODE|DATE|FILE`; `file` is present only for FILE and contains exact safe version metadata. Search returns `{items:[FileProjection],nextCursor?}`. `FileProjection` contains owner kind/ID, safe source parent reference, optional safe `workRequestId`, document/version IDs, code snapshot, original/uploaded/generated names, versionNumber, revisionCode, MIME, size, uploader label, uploadedAt, and logical date; it never contains tenant ID, storageKey, local path, or provider URL. Tree calls are read-only: no outbox event is emitted.

`limit` defaults 50 and is capped 100. Root/code labels sort ascending; date nodes sort descending; file children sort `uploadedAt ASC, versionId ASC`; search sorts `uploadedAt DESC, versionId DESC`. `mode=latest` returns only each logical document's latest visible version and `mode=exact` returns every visible version. Cursor/sort are server-defined; an empty search requires a bounded parent/filter. Invalid filters/IDs are 400, hidden/foreign resources are 404, permission/relationship denial is 403, unavailable storage/integrity failure is 409 or repository-standard safe unavailable mapping. Preview supports only configured preview MIME types; unsupported type returns 409 with metadata still readable. Download uses `attachment; filename=<generatedFileName>` except historical null generated names use safe uploaded name.

All direct/tree/search/read calls apply the same exact-version and visibility resolver. External ClientContact calls are limited to C1 package item versions; normal parent listing never becomes an external broad browse API.
