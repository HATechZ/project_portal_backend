# Tasks: 06.1 Ã¢â‚¬â€ POL

- [ ] **Audit POL OptionType/RLS and normalized-name prerequisites.**
      VERIFY: grep -q "IMPLEMENTATION GAP" specs/06.1-pol/DATA_CONTRACT.md
- [ ] **Build dedicated POL Code persistence path with tenant and POL-type predicates.**
      VERIFY: test -f src/pol-codes/pol-codes.module.ts
- [ ] **Build POL Code name-only routes and lifecycle without delete.**
      VERIFY: test -f src/pol-codes/pol-codes.controller.ts && ! grep -q "@Delete" src/pol-codes/pol-codes.controller.ts
- [ ] **Prove POL Code isolation, lifecycle, ordering, empty-state, and authorization.**
      VERIFY: corepack yarn test --runInBand --testPathPatterns=pol
