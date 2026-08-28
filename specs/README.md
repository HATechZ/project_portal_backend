# specs/ — Project Portal Backend Feature Specifications (SDD)

One folder per module, acting as the executable source of truth for that feature. Code is
strictly downstream.

```
specs/
├── RULES.md                ← The card. The only rules file you read every session.
├── rules/                  ← Full articles, read on demand via the card's routing table.
├── INDEX.md                ← Cross-module dashboard. The only status surface.
├── PLACEHOLDERS.md         ← Gate 0 registry: every src/ module maps to a spec.
└── NN-module-name/         ← NN = zero-padded order, e.g. 00-platform-core
    ├── SPEC.md             ← Gate 1: What & Why (EARS acceptance criteria)
    ├── DATA_CONTRACT.md    ← Gate 1: tables, enums, relations, derived state
    ├── API_CONTRACT.md     ← Gate 1: routes, DTOs, envelope, error codes, roles
    ├── plan.md             ← Gate 2: module tree, DTOs, repositories, transactions
    ├── tasks.md            ← Gate 3: atomic tasks, each with a VERIFY: line
    └── walkthrough.md      ← Gate 5: HTTP evidence, PASS/FAIL per endpoint
```

A module needs at least one of `DATA_CONTRACT.md` / `API_CONTRACT.md`; most need both.
Modules 00–02 are platform and infrastructure — they own no tables, so they carry only an
`API_CONTRACT.md` describing the conventions every other module inherits.

## Workflow

```
Specify   → SPEC.md + contracts   (Gate 1: human approves)
Plan      → plan.md               (Gate 2: human approves)
Tasks     → tasks.md              (Gate 3: human approves)
Implement → code                  (Gate 4: one task at a time, lint + build clean)
Verify    → sign-off              (Gate 5: every VERIFY: passes, walkthrough.md written)
```

## Commands

```bash
yarn verify:spec              # Gates 1-3: are the artifacts complete and executable?
yarn verify:sdd               # Gate 5: do the ticked assertions hold?
yarn verify:sdd --module 03   # one module
yarn verify:sdd --all         # also probe unticked tasks — which are ready to tick?
yarn verify:sdd:strict        # also fail on ticked tasks with no VERIFY: line
```
