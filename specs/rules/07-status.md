# Articles VII & VIII — Handoff, Status, Universal Enforcement `[ALL]`

Read when updating status. Card: [`../RULES.md`](../RULES.md).

## Article VII: handoff & status

**[`../INDEX.md`](../INDEX.md) is the only status surface.** Phase tables, task counts, and
module state live there and nowhere else.

On finishing any task or module phase, update `INDEX.md`:

- the module's phase, task count, and status,
- one line in the **Session Log** (date, agent, module, gates touched).

Keep the Session Log to the **last 10 rows**; trim the oldest when adding an eleventh. It is
read every session, so it must not grow without bound.

`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, and `Agent.md` MUST NOT carry progress logs. Two
hand-maintained status tables always drift.

## Article VIII: universal enforcement

Every AI coding agent operating on this repository — Claude, Codex, Antigravity, and all
subagents — is bound by these rules on every turn, subject to the `[ALL]` / `[CLAUDE]` scoping
in [`01-lifecycle.md`](01-lifecycle.md).

Where an agent lacks the tooling a rule assumes, it follows the stated `[ALL]` equivalent. It
does not skip the rule, and it does not claim compliance it cannot demonstrate.
