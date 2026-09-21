# Tasks: 15 — Project

- [ ] Approve/apply independent Project persistence, RLS and backfill.
      VERIFY: `Select-String -Path prisma/schema.prisma -Pattern '^model Project$|^model ProjectStatusEvent$'`
- [ ] Record owner decisions for Project grants and V1 list/detail/update scope.
      VERIFY: `Select-String -Path specs/15-project/*.md -Pattern 'OWNER DECISION REQUIRED'`
- [ ] Implement isolated Project multipart create with scoped Client validation and ACTIVE event.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=project`
- [ ] Implement optional protected Project storage metadata/compensation and approved read operations.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=project`
- [ ] Independently complete focused tests and HTTP walkthrough.
      VERIFY: `Test-Path specs/15-project/walkthrough.md`
