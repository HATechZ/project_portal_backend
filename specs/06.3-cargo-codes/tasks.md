# Tasks: 06.3 — Cargo Codes

- [ ] **Audit Cargo normalized name/code gaps and safe fixed-catalogue read access.**
      VERIFY: grep -q "IMPLEMENTATION GAP" specs/06.3-cargo-codes/DATA_CONTRACT.md
- [ ] **Build dedicated Cargo Code module fixed to CARGO_CODE.**
      VERIFY: test -f src/cargo-code/cargo-code.module.ts
- [ ] **Prove Cargo code normalization, lifecycle, isolation, and authorization.**
      VERIFY: corepack yarn test --runInBand --testPathPatterns=cargo-code
