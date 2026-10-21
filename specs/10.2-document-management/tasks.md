# Tasks: 10.2 - Document Management Reads

## Preserve / already complete

- [ ] Preserve canonical parent-specific Document/DocumentVersion ownership and immutable C1 package IDs.
      VERIFY: rg -q "exact immutable version IDs" specs/10.2-document-management/DOCUMENT_NAMING_REVISION_VERSION.md
- [ ] Preserve local `./uploads`, existing multipart routes, C1/C2/C3, and generic Work Request authorization.
      VERIFY: rg -q "no storage provider, upload, schema, migration, C1/C2/C3" specs/10.2-document-management/SPEC.md
- [ ] Preserve Bid historical documents under Bid roots after conversion.
      VERIFY: rg -q "Historical Bid versions never convert to Project format" specs/10.2-document-management/DOCUMENT_NAMING_REVISION_VERSION.md

## Dependencies - 10.1 required first

- [ ] Verify 10.1 upload finalization/session lifecycle and provider-neutral exact-version storage resolver are available.
      VERIFY: test -f specs/10.1-documents/FORMAL_REVISION_LIFECYCLE.md && rg -q "exact version" specs/10.1-documents/FORMAL_REVISION_LIFECYCLE.md
- [ ] Verify 10.1 formal revision items freeze exact completed version IDs.
      VERIFY: rg -q "exact completed version" specs/10.1-documents/FORMAL_REVISION_LIFECYCLE.md

## New implementation

- [ ] Obtain owner decisions: Project numeric revision start/zero-padding and Unicode normalization.
      VERIFY: rg -q "OWNER DECISION REQUIRED" specs/10.2-document-management/DOCUMENT_NAMING_REVISION_VERSION.md
- [ ] Implement server-only context revision allocation and immutable version-number concurrency behavior.
      VERIFY: rg -q "server-side under the same serialization as version allocation" specs/10.2-document-management/DOCUMENT_NAMING_REVISION_VERSION.md
- [ ] Implement authorized exact-version projection/resolver for internal, C1 external package, C2, and 10.1 references.
      VERIFY: rg -q "No latest-version substitution is valid" specs/10.2-document-management/DATA_CONTRACT.md
- [ ] Implement lazy logical tree nodes and visibility-safe counts.
      VERIFY: rg -q "inaccessible documents never affect node existence/count/date/file metadata" specs/10.2-document-management/DOCUMENT_TREE_SEARCH_READS.md
- [ ] Implement metadata search with bounded filters, cursor pagination, and deterministic sorting.
      VERIFY: rg -q "pagination is cursor-based" specs/10.2-document-management/DOCUMENT_TREE_SEARCH_READS.md
- [ ] Implement exact-version preview and download through the storage port.
      VERIFY: rg -q "Preview/download require exact version ID" specs/10.2-document-management/DOCUMENT_TREE_SEARCH_READS.md
- [ ] Add future S3-provider compatibility tests without changing logical tree/search/version semantics.
      VERIFY: rg -q "identical local/future-S3 logical results" specs/10.2-document-management/DOCUMENT_TREE_SEARCH_READS.md

## Validation

- [ ] Run focused naming/version/link/tree/search/read authorization tests.
      VERIFY: corepack yarn test --runInBand --testPathPatterns=document
- [ ] Run C1/C2/C3/document/full backend regression and build/spec checks.
      VERIFY: corepack yarn lint && corepack yarn build && corepack yarn verify:spec
