# Tasks: 06.4 — Vessel Codes

- [ ] **Audit Vessel normalized uniqueness and safe fixed-catalogue read access.**
      VERIFY: grep -q "IMPLEMENTATION GAP" specs/06.4-vessel-codes/DATA_CONTRACT.md
- [ ] **Build dedicated Vessel Code module fixed to VESSEL_CODE.**
      VERIFY: test -f src/vessel-code/vessel-code.module.ts
- [ ] **Prove Vessel code, lifecycle, type/tenant isolation, and authorization.**
      VERIFY: corepack yarn test --runInBand --testPathPatterns=vessel-code
