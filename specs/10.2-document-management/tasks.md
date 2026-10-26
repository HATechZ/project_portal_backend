# Tasks: 10.2 - Document Management Reads

## Frozen upstream dependencies

- [x] Preserve canonical parent-specific Document/DocumentVersion ownership and immutable C1 package IDs.
      VERIFY: corepack yarn test document-management --runInBand
- [x] Preserve local `./uploads`, existing multipart routes, C1/C2/C3, and generic Work Request authorization.
      VERIFY: corepack yarn test document-management document-upload --runInBand
- [x] Preserve Bid historical documents under Bid roots after conversion.
      VERIFY: corepack yarn test document-management --runInBand

## Dependencies - 10.1 required first

- [x] Verify final-audited 10.1 parent-owned version persistence and exact-version resolution boundaries before adding 10.2 reads.
      VERIFY: corepack yarn test document-management document-read-contract --runInBand
- [x] Verify 10.1 formal revision items freeze exact completed version IDs.
      VERIFY: corepack yarn test document-management --runInBand

## New implementation

- [x] Preserve frozen naming facts: NFC normalization, Bid `A…Z, AA…`, Project `01` minimum-width numeric allocation, and separate formal revision rounds.
      VERIFY: corepack yarn test document-naming --runInBand
- [x] Consume immutable server-allocated revision/version facts; 10.2 must never allocate, rewrite, or infer them from names.
      VERIFY: corepack yarn test document-management --runInBand
- [x] Implement authorized exact-version projection/resolver for internal, C1 external package, C2, and 10.1 references.
      VERIFY: corepack yarn test document-management --runInBand
- [x] Implement lazy logical tree nodes and visibility-safe counts, including Work Request versions only under their visible immutable source Bid/Project root.
      VERIFY: corepack yarn test document-management --runInBand
- [x] Implement metadata search with bounded filters, cursor pagination, and deterministic sorting.
      VERIFY: corepack yarn test document-management --runInBand
- [x] Implement exact-version preview and download through the storage port.
      VERIFY: corepack yarn test document-management --runInBand
- [x] Add future S3-provider compatibility tests without changing logical tree/search/version semantics.
      VERIFY: rg -q "identical local/future-S3 logical results" specs/10.2-document-management/DOCUMENT_TREE_SEARCH_READS.md && corepack yarn test document-management --runInBand

## Validation

- [x] Run focused naming/version/link/tree/search/read authorization tests.
      VERIFY: corepack yarn test document-management --runInBand
- [x] Run C1/C2/C3/document/full backend regression and focused lint/build/spec checks without attempting repository-wide legacy lint repair.
      VERIFY: corepack yarn test document-management --runInBand && corepack yarn build && corepack yarn verify:spec
