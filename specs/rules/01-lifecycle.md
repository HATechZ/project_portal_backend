# Article 0 & I — Rule Scope and the 5-Gate Lifecycle `[ALL]`

Read when starting or finishing a module. Card: [`../RULES.md`](../RULES.md).

## Article 0: Rule scope & agent capability

| Tag | Meaning |
|---|---|
| `[ALL]` | Binding on every agent — Claude, Codex, Antigravity, subagents. Stated as a plain checklist any tool can follow. |
| `[CLAUDE]` | Depends on Claude Code skills/subagents/MCP. Other agents follow the `[ALL]` equivalent stated alongside. |

A rule that only exists as a Claude capability is not binding on Codex or Antigravity. An
agent lacking the tooling a rule assumes follows the `[ALL]` equivalent — it does not skip the
rule, and does not claim compliance it cannot demonstrate.

## Article I: the gates

| Gate | Artifact | Exit condition |
|---|---|---|
| **0** | — | No implementation under `src/` for a module whose `SPEC.md` does not exist. |
| **1** | `SPEC.md` + `DATA_CONTRACT.md` and/or `API_CONTRACT.md` | What, why, and the schema and HTTP surface it binds to. |
| **2** | `plan.md` | Module tree, DTOs, entities, repositories, services, transaction boundaries. |
| **3** | `tasks.md` | Atomic tasks, each with a `VERIFY:` command. |
| **4** | Implementation | One task at a time. `yarn lint` and `yarn build` clean. |
| **5** | Sign-off | Every `VERIFY:` passes. HTTP walkthrough in `walkthrough.md`. |

## Gate 0 is binding

Creating `src/projects/projects.module.ts` before `specs/07-projects-and-bids/SPEC.md` exists
is a violation.

The implementation surface is the **NestJS feature module**. Every `*.module.ts` under `src/`
except the root `AppModule` must appear in [`../PLACEHOLDERS.md`](../PLACEHOLDERS.md): mapped
to a spec directory that exists, or registered as a declared placeholder.

**The declared placeholder exception.** An inert module shell that reserves a name and
registers no working providers may exist before its spec, provided it is registered in
`PLACEHOLDERS.md` and stays inert — no imports matching `prisma`, `redis`, `repository`, or
`.service`, and within its declared line cap. The moment it touches persistence or cache it is
an implementation and Gate 0 applies in full.

`yarn verify:sdd` enforces this before any task assertion. An unlisted module fails the run.

## Starting a module

```bash
mkdir -p specs/NN-module-name
cp .specify/templates/spec-template.md  specs/NN-module-name/SPEC.md
cp .specify/templates/plan-template.md  specs/NN-module-name/plan.md
cp .specify/templates/tasks-template.md specs/NN-module-name/tasks.md
```

Write the contracts alongside, add the row to [`../INDEX.md`](../INDEX.md), then
`yarn verify:spec --module NN`. Exit 0 means the spec is complete enough to execute; only
then does Gate 4 begin.
