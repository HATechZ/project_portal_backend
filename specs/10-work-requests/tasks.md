# Tasks: 10 — Work Requests

- [ ] Apply the approved Work Request permission migration/provisioning and configured transitions.
      VERIFY: `Select-String -Path specs/10-work-requests/*.md -Pattern 'OWNER DECISION REQUIRED'`
- [ ] Approve and apply additive Work Request persistence, tenant/RLS, fixed priority domain, and legacy migration/backfill plan.
      VERIFY: `Select-String -Path prisma/schema.prisma -Pattern '^model WorkRequest$|^model WorkRequestAssignment$|^model WorkRequestAuditLog$'`
- [ ] Implement isolated multipart create, Bid/Project XOR validation, generic document-code mapping, initial event, and no initial assignment.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=work-request`
- [ ] Implement scoped Division, Team, and Member assignment history with active membership validation.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=work-request`
- [ ] Implement derived workflow state, the explicit transition matrix, generic revision return paths, clarification behavior, available actions, outbox publication, and focused tenant/concurrency tests.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=work-request`
- [ ] Implement scoped read-only Work Request document and chronological document-version history.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=work-request`
- [ ] Independently verify assertions and complete HTTP/RLS walkthrough.
      VERIFY: `Test-Path specs/10-work-requests/walkthrough.md`
