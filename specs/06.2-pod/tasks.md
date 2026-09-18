# Tasks: 06.2 Ã¢â‚¬â€ POD

- [ ] **Audit POD normalized uniqueness and catalogue-RLS prerequisites.**
      VERIFY: grep -q "IMPLEMENTATION GAP" specs/06.2-pod/DATA_CONTRACT.md
- [ ] **Build isolated POD Code persistence and API lifecycle.**
      VERIFY: test -f src/pod-codes/pod-codes.module.ts && test -f src/pod-codes/pod-codes.controller.ts
- [ ] **Prove POD Code empty state, type/tenant isolation, ordering, and authorization.**
      VERIFY: corepack yarn test --runInBand --testPathPatterns=pod
