# Tasks: 10.1 — Shared Document Upload & Versioning

**Status:** Phases 1-5 implemented; Phase 6 non-DB contract coverage complete. Migrations were manually applied, but DB-backed runtime/RLS verification remains deferred: no isolated integration/E2E fixture or cleanup harness exists in this repository. **Spec:** `SPEC.md`. **Plan:** `plan.md`.

- [ ] **Phase 1 — shared foundation and reuse audit**
  - [ ] Extract one shared upload pipeline used by Bid, Project, and Work Request create paths.
        VERIFY: test $(rg -l "SharedDocument.*Pipeline|DocumentUploadPipeline" src --glob "*.ts" | wc -l) -ge 1
  - [ ] Centralize safe-name, MIME/extension, code-name snapshot mapping, storage-key, and compensation behavior.
        VERIFY: test $(rg -l "assert.*Mapping|safe.*Name|compensate" src --glob "*.ts" | wc -l) -ge 1

- [ ] **Phase 2 — parent-owned new documents**
  - [ ] Add Bid, Project, and Work Request parent routes for a new document with positional file/code mapping.
        VERIFY: test $(rg -l "documents" src/bid src/project src/work-request --glob "*.controller.ts" | wc -l) -ge 3
  - [ ] Persist a new logical document and initial immutable version for each uploaded file, using Document Code name rather than uploaded base filename.
        VERIFY: test $(rg -l "DocumentVersion.*create|documentVersion.*create" src --glob "*.ts" | wc -l) -ge 1

- [ ] **Phase 3 — immutable versions**
  - [ ] Add parent-owned version routes that use document ID, not filename, for lineage.
        VERIFY: test $(rg -l "documents/:documentId/versions" src --glob "*.controller.ts" | wc -l) -ge 3
  - [ ] Return safe document summaries and chronological version history without storage keys.
        VERIFY: test $(rg -l "latestVersion|uploadedFileName" src --glob "*.ts" | wc -l) -ge 1

- [ ] **Phase 4 — create-time migration**
  - [ ] Persist Direct Project naming inputs/snapshots and route Bid, Project, and Work Request create-time files through the shared pipeline.
        VERIFY: test $(rg -l "DocumentUploadPipeline|SharedDocument" src/bid src/project src/work-request --glob "*.ts" | wc -l) -ge 3

- [x] **Phase 5 — permission, scope, audit, idempotency**
  - [x] Enforce tenant-qualified parent/document ownership and Work Request responsible-Member state rules for version upload.
        VERIFY: rg -q "MEMBER_ASSIGNED" src/work-request && rg -q "MEMBER_SUBMITTED" src/work-request
  - [x] Record upload audit/request correlation and durably compensate failed storage cleanup.
        VERIFY: test $(rg -l "idempotency|correlation|StorageCleanup" src --glob "*.ts" | wc -l) -ge 1

- [x] **Phase 6 — tests and contract freeze**
  - [x] Add focused tests for positional mapping, same-name separation, generated-name reupload, lineage, tenant isolation, state lock/return, and compensation.
        VERIFY: test $(rg -l "generated.*name|lineage|MEMBER_SUBMITTED|compensat" src --glob "*.spec.ts" | wc -l) -ge 1
  - [x] Freeze API/data contracts after focused tests and SDD verification pass. DB-runtime/RLS walkthrough remains deferred because no isolated integration/E2E fixture or cleanup harness exists.
        VERIFY: rg -q "GET.*bids/:id/documents" specs/10.1-documents/API_CONTRACT.md && rg -q "GET.*projects/:id/documents" specs/10.1-documents/API_CONTRACT.md && rg -q "DocumentUploadRequest" prisma/schema.prisma
