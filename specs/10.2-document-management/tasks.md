# Tasks: 10.2 — Document Management Reads

## Preserve / already complete

- [ ] Preserve canonical parent-specific Document/DocumentVersion ownership and immutable C1 package IDs. VERIFY: static contract/read tests prove no latest-version fallback.
- [ ] Preserve local `./uploads`, existing multipart routes, C1/C2/C3, and generic Work Request authorization. VERIFY: regression suite passes.
- [ ] Preserve Bid historical documents under Bid roots after conversion. VERIFY: conversion/document regression proves unchanged ownership.

## Dependencies — 10.1 required first

- [ ] Verify 10.1 upload finalization/session lifecycle and provider-neutral exact-version storage resolver are available. VERIFY: upstream focused tests pass.
- [ ] Verify 10.1 formal revision items freeze exact completed version IDs. VERIFY: upstream revision tests pass.

## New implementation

- [ ] Obtain owner decisions: Project numeric revision start/zero-padding and Unicode normalization. VERIFY: documented owner decision exists before implementation.
- [ ] Implement server-only context revision allocation and immutable version-number concurrency behavior. VERIFY: Bid alphabetic, Project numeric, and concurrent version tests pass.
- [ ] Implement authorized exact-version projection/resolver for internal, C1 external package, C2, and 10.1 references. VERIFY: foreign/latest/unrelated cases fail closed.
- [ ] Implement lazy logical tree nodes and visibility-safe counts. VERIFY: root → parent → code → date → file tests pass with no hidden-node leak.
- [ ] Implement metadata search with bounded filters, cursor pagination, and deterministic sorting. VERIFY: tenant/visibility/filter/cursor tests pass without storage scans.
- [ ] Implement exact-version preview and download through the storage port. VERIFY: LOCAL stream, MIME/disposition, package-only external access, and unavailable object behavior pass.
- [ ] Add future S3-provider compatibility tests without changing logical tree/search/version semantics. VERIFY: provider contract test suite passes.

## Validation

- [ ] Run focused naming/version/link/tree/search/read authorization tests. VERIFY: all targeted tests pass.
- [ ] Run C1/C2/C3/document/full backend regression and build/spec checks. VERIFY: repository-standard commands exit 0.
