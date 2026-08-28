# Spec-Driven Development (SDD) Workflow Guide

Standard operating procedure for agents (Claude, Codex, Antigravity) working in the Project
Portal backend. The binding rules are in [`specs/RULES.md`](../../specs/RULES.md);
this is the short procedural version.

## The 5-Gate Lifecycle

```
Phase 1: SPEC.md + contracts → Gate 1: human signs off on requirements & EARS criteria
Phase 2: plan.md             → Gate 2: human signs off on module tree, DTOs, transactions
Phase 3: tasks.md            → Gate 3: human signs off on the task breakdown
Phase 4: Code                → Gate 4: tasks implemented one-by-one, lint + build clean
Phase 5: Verify              → Gate 5: every VERIFY: passes, walkthrough.md written
```

## Rules for Agents

1. **Never skip gates.** No code before `SPEC.md`, `plan.md`, and `tasks.md` are approved.
   Gate 0 is machine-checked: an unregistered `*.module.ts` fails `yarn verify:sdd`.
2. **Read the DBML, not your memory.** `project_portal_workflow_management_erd.dbml` is the
   schema authority; `prisma/schema.prisma` is generated from it and must never be hand-edited.
3. **Write the `VERIFY:` line before the code.** If you cannot write one, the task is too
   vague — split it.
4. **Assertions are static.** `grep`, `test`, `yarn lint`, `yarn build`. No database, no
   Redis, no network.
5. **Verify current library APIs** before writing against NestJS 11 / Prisma 7 / BullMQ.
   Context7 MCP where available, otherwise the types in `node_modules`.
6. **Keep `specs/INDEX.md` updated** — it is the only status surface.

## Starting a new module

```bash
mkdir -p specs/NN-module-name
cp .specify/templates/spec-template.md  specs/NN-module-name/SPEC.md
cp .specify/templates/plan-template.md  specs/NN-module-name/plan.md
cp .specify/templates/tasks-template.md specs/NN-module-name/tasks.md
```

Write `DATA_CONTRACT.md` and/or `API_CONTRACT.md` alongside them, add the row to
`specs/INDEX.md`, then:

```bash
yarn verify:spec --module NN
```

Exit 0 means the spec is complete enough to execute. Only then does Gate 4 begin.
