# Tasks: 08 — Bid

- [ ] Approve/apply independent Bid persistence, RLS, tenant-wide name claims, and backfill.
      VERIFY: `Select-String -Path prisma/schema.prisma -Pattern '^model Bid$|^model BidStatusEvent$|^model BusinessNameClaim$'`
- [ ] Implement isolated Bid multipart create with scoped references, BIDDING event, and action-grant authorization.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=bid`
- [ ] Implement optional protected Bid storage, per-file Document Code metadata, filename collision handling, and approved reads/update.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=bid`
- [ ] Implement an explicitly contracted Bid-file Document Code reclassification/audit use case without re-upload.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=bid`
- [ ] Independently complete focused tests and HTTP walkthrough.
      VERIFY: `Test-Path specs/08-bid/walkthrough.md`
