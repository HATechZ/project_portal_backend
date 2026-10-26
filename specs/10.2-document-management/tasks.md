# Tasks: 10.2 - Document Management Reads

## Frozen upstream dependencies

- [x] Preserve canonical parent-specific Document/DocumentVersion ownership and immutable C1 package IDs.
      VERIFY: rg -q "exact immutable version IDs" specs/10.2-document-management/DOCUMENT_NAMING_REVISION_VERSION.md
- [x] Preserve local `./uploads`, existing multipart routes, C1/C2/C3, and generic Work Request authorization.
      VERIFY: rg -q "no storage provider, upload, schema, migration, C1/C2/C3" specs/10.2-document-management/SPEC.md
- [x] Preserve Bid historical documents under Bid roots after conversion.
      VERIFY: rg -q "Historical Bid versions never convert to Project format" specs/10.2-document-management/DOCUMENT_NAMING_REVISION_VERSION.md

## Dependencies - 10.1 required first

- [x] Verify final-audited 10.1 parent-owned version persistence and exact-version resolution boundaries before adding 10.2 reads.
      VERIFY: rg -q "independent tenant-qualified pairs" specs/10.1-documents/DATA_CONTRACT.md && rg -q "exact version" specs/10.1-documents/FORMAL_REVISION_LIFECYCLE.md
- [x] Verify 10.1 formal revision items freeze exact completed version IDs.
      VERIFY: rg -q "exact immutable version-item rows" specs/10.1-documents/FORMAL_REVISION_LIFECYCLE.md

## New implementation

- [x] Preserve frozen naming facts: NFC normalization, Bid `A…Z, AA…`, Project `01` minimum-width numeric allocation, and separate formal revision rounds.
      VERIFY: rg -q "NFC-normalized" specs/10.2-document-management/DOCUMENT_NAMING_REVISION_VERSION.md && rg -q "Project numeric revision | IMPLEMENTED UPSTREAM" specs/10.2-document-management/SPEC.md
- [x] Consume immutable server-allocated revision/version facts; 10.2 must never allocate, rewrite, or infer them from names.
      VERIFY: rg -q "exact-version only" specs/10.2-document-management/DATA_CONTRACT.md
- [x] Implement authorized exact-version projection/resolver for internal, C1 external package, C2, and 10.1 references.
      VERIFY: corepack yarn test document-management --runInBand
- [x] Implement lazy logical tree nodes and visibility-safe counts, including Work Request versions only under their visible immutable source Bid/Project root.
      VERIFY: corepack yarn test document-management --runInBand
- [x] Implement metadata search with bounded filters, cursor pagination, and deterministic sorting.
      VERIFY: corepack yarn test document-management --runInBand
- [x] Implement exact-version preview and download through the storage port.
      VERIFY: rg -q "Preview/download require exact version ID" specs/10.2-document-management/DOCUMENT_TREE_SEARCH_READS.md
- [x] Add future S3-provider compatibility tests without changing logical tree/search/version semantics.
      VERIFY: rg -q "identical local/future-S3 logical results" specs/10.2-document-management/DOCUMENT_TREE_SEARCH_READS.md

## Validation

- [x] Run focused naming/version/link/tree/search/read authorization tests.
      VERIFY: corepack yarn test document-management --runInBand
- [x] Run C1/C2/C3/document/full backend regression and focused lint/build/spec checks without attempting repository-wide legacy lint repair.
      VERIFY: corepack yarn test document-management --runInBand && corepack yarn build && corepack yarn verify:spec
