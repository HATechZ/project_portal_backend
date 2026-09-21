# Tasks: 04.4 — Designation

**Status:** Gate 3 · 0/5 · implementation not started  
**Spec Reference:** `SPEC.md` · **Plan Reference:** `plan.md`

- [ ] Establish proposed Designation/Member structural migration through the database-architect
  path; add restrictive tenant/company relation, normalized uniqueness, RLS, and least privilege.
      VERIFY: corepack yarn prisma validate
- [ ] Execute and record blocking preflight plus idempotent per-tenant legacy `roleTitle` conversion;
  map every valid Member before retiring free-text persistence.
      VERIFY: corepack yarn test --runInBand --testPathPatterns=designation
- [ ] Implement scoped Designation CRUD with method-level `MANAGE_DESIGNATIONS` mutation
  permission and authenticated active same-Tenant reads.
      VERIFY: corepack yarn test --runInBand --testPathPatterns=designation
- [ ] Update Member DTOs/mapping to accept and return `designationId` and display only related
  `designation` name; reject cross-tenant/company references.
      VERIFY: corepack yarn test --runInBand --testPathPatterns=member
- [ ] Add focused authorization, isolation, normalization, deletion, migration, Swagger, and HTTP/RLS
  walkthrough evidence, including Division normalized-duplicate preflight.
      VERIFY: corepack yarn verify:spec --module 04.4 && corepack yarn verify:sdd --module 04.4
