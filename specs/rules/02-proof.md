# Article II — Gate 5 Means Executable Proof `[ALL]`

Read when writing a `VERIFY:` line. Card: [`../RULES.md`](../RULES.md).

**A task may not be ticked on intent. It is ticked on a command that exits 0.**

```markdown
- [ ] Route every Prisma error through the global exception filter
      VERIFY: test $(grep -rl "PrismaClientKnownRequestError" src --include=*.ts | grep -v "src/common/exceptions" | wc -l) -eq 0
```

1. A checkbox with no `VERIFY:` line cannot be ticked.
2. The agent that implements a task **may not** verify it. Gate 5 runs as a separate pass
   reading only `tasks.md` and the repo — no session context, no memory of intent.
3. `yarn lint` and `yarn build` clean are necessary but **never sufficient**. Code that
   compiles can still contradict its own spec.
4. If a `VERIFY:` command cannot be written, the task is too vague — split it.

## Assertions are static

`grep`, `test`, file existence, line counts, `yarn lint`, `yarn build`. They must run with no
database, no Redis, and no network.

This is the boundary of what Gate 5 proves: a passing suite proves the code has the shape its
spec claims, **not** that an endpoint returns the right status or envelope at runtime. That is
what [`05-walkthrough.md`](05-walkthrough.md) is for. An assertion needing a live service
passes on one machine and fails on another — worse than no assertion.

## The runner

```bash
yarn verify:sdd                    # all specs
yarn verify:sdd --module 03        # one module
yarn verify:sdd --all              # probe unticked tasks — which are ready to tick?
yarn verify:sdd:strict             # fail on ticked tasks carrying no VERIFY: line
yarn verify:spec                   # validate spec ARTIFACTS (Gates 1-3), executes nothing
```

Exit 0 = every ticked assertion holds. Exit 1 = a completion claim is not true.

Only *leaf* tasks are asserted — a group header with nested children is skipped. Assertions
run from the repo root through `bash`, 180s timeout each.

## Three enforcement tiers

| Tier | Trigger | Cost | Binds |
|---|---|---|---|
| `PostToolUse` hook | tick time, automatic | ms | Claude Code |
| `prebuild` | every `yarn build` | ms | **every agent** |
| `verify:sdd:strict` | manual / CI | seconds | every agent; the only tier proving assertions *hold* |

`package.json` runs `"prebuild": "node scripts/verify-sdd.mjs --lint"`, so `yarn build` fails
if any task is ticked without a `VERIFY:` line. This is the agent-neutral floor — no editor
integration, no hook system.

`.claude/settings.json` runs `node scripts/verify-sdd.mjs --hook` on `Write|Edit`. It lints
only `specs/**/tasks.md`, executes nothing, and exits **2** to block the agent with the reason
fed back. Read by Claude Code only — an accelerator, not the rule.

## Two constraints

1. **Never wire `verify:sdd` into `prebuild` or `pretest`.** Assertions may run `yarn build`;
   the runner would re-invoke the build without termination. Only `--lint`, which executes
   nothing, is safe there.
2. **A commit-time gate is available and unused.** This *is* a git repository. A `pre-commit`
   hook running `--lint` is the natural next tier; add it once the spec set stabilizes.
