# Tasks: 09 — Project

- [ ] Approve/apply independent Project persistence, RLS, tenant-wide name claims, and separate backfill.
      VERIFY: `Select-String -Path prisma/schema.prisma -Pattern '^model Project$|^model ProjectStatusEvent$|^model BusinessNameClaim$'`
- [x] Implement isolated Project multipart create with scoped Client validation, ACTIVE event, and action-grant authorization.
      VERIFY: ./node_modules/.bin/jest --runInBand src/project/project.service.spec.ts src/project/project-upload-policy.spec.ts src/infra/storage/project-storage-cleanup.processor.spec.ts
- [x] Implement optional protected Project storage, per-file Document Code metadata, generated-name conditions, and approved reads/update.
      VERIFY: ./node_modules/.bin/jest --runInBand src/project/project.service.spec.ts src/project/project-upload-policy.spec.ts src/infra/storage/project-storage-cleanup.processor.spec.ts
- [x] Implement an explicitly contracted Project-file Document Code reclassification/audit use case without re-upload.
      VERIFY: ./node_modules/.bin/jest --runInBand src/project/project.service.spec.ts src/project/project-upload-policy.spec.ts src/infra/storage/project-storage-cleanup.processor.spec.ts
- [ ] Independently complete focused tests and HTTP walkthrough.
      VERIFY: `Test-Path specs/09-project/walkthrough.md`
