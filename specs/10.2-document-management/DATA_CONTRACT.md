# Data Contract: 10.2 — Logical Read Projections

10.2 introduces no persistence requirement. Tree/search nodes are authorized read projections over independent `BidDocument`/`BidDocumentVersion`, `DirectProjectDocument`/`DirectProjectDocumentVersion`, and `WorkRequestV1Document`/`WorkRequestV1DocumentVersion` metadata plus existing C1/C2/10.1 exact-version links. Logical node IDs are opaque, stable only for query navigation, and never storage keys or authorization identities.

`DocumentVersionProjection` is exact-version only: `{versionId,documentId,parentKind,parentId,codeSnapshot,originalFileName,uploadedFileName,generatedFileName?,versionNumber,revisionCode,mimeType,size,uploadedBy,uploadedAt,logicalDate}`. Finalized facts are immutable. `versionNumber` is server sequential per Document; revision code is context formatting; formal round/request code are separate 10.1 facts.

Tree derivation: parent roots derive from visible Bid/DirectProject metadata; their own versions group directly beneath that root. Work Request-owned versions group beneath their immutable source Bid/Project root only when both source-parent and Work Request visibility pass; their projection retains `owner.kind=WORK_REQUEST` and `workRequestId`. Code nodes derive from immutable visible document-code snapshots; date nodes derive from finalized `uploadedAt` in tenant timezone (UTC fallback); file nodes derive from exact completed versions. Counts and child existence use the identical authorized predicate, so invisible versions cannot leak.

Exact references always carry tenant-qualified ownership validation. C1 submitted-package item → exact version, C2 attachment → exact version, and 10.1 formal-submission item → exact version are immutable reference edges. No latest-version substitution is valid.

Future schema work is not required for 10.2 itself. If search scale later requires indexes/materialized projections, it is additive and must preserve canonical version rows, RLS, and parent-specific ownership.
