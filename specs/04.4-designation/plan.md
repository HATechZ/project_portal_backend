# Technical Plan: 04.4 — Designation

**Status:** Gate 3 · approved target · not implemented  
**Contracts:** `SPEC.md` · `API_CONTRACT.md` · `DATA_CONTRACT.md`

Create `src/designation/` with controller, service, DTOs, mapper/provider, and repository using
the established Organization module layering and ambient Tenant UnitOfWork. The controller has no
persistence calls; the service applies normalization, explicit 404/409 outcomes, and the
permission boundary; the repository scopes every operation by Tenant and Company.

Implementation stages are: introduce the schema through the database-architect path; execute the
blocking legacy/division duplicate preflights; perform idempotent Designation backfill and Member
mapping; tighten the final relation; then expose routes and update Member mappings. Implement GET
without management permission, while POST/PATCH/DELETE use the established permission guard and
the new action. Do not query or mutate ClientContact, role, workflow, or authority records.

Focused tests cover all routes, authentication/context read access, mutation grants only for the
two provisioned system roles, foreign isolation, normalization/races, referenced delete, Member
same-company validation, legacy backfill idempotence/blocking, ClientContact exclusion, and
Division duplicate preflight. Swagger covers success and 400/401/403/404/409 responses.
