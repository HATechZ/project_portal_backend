# Tasks

- [x] Implement the approved shared persistence, authorization reuse and safe legacy `802`/`803` ownership transition.
      VERIFY: corepack yarn test --runInBand --testPathPatterns=marketing-document-code
- [x] Implement independent Marketing module and starter provisioning without numeric-range validation.
      VERIFY: corepack yarn test --runInBand --testPathPatterns=marketing-document-code
- [x] Prove tenant/cross-module isolation, lifecycle, idempotency and `documentCodeId` compatibility.
      VERIFY: corepack yarn test --runInBand --testPathPatterns=marketing-document-code
