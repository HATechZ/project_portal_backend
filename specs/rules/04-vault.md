# Article IV — Obsidian Mind Vault Synchronization `[CLAUDE]`

Read when syncing the vault. Card: [`../RULES.md`](../RULES.md).

Where the **`om` MCP server** is connected, durable decisions are recorded to the vault.

> **`om` is an MCP server, not a shell command.** There is no `om` binary on PATH. Invoke it
> as an MCP tool. Never write `om record_work` in a terminal.

| Gate | Action |
|---|---|
| 1 | Record extracted contracts and domain decisions; capture durable lessons via `remember`. |
| 4 / 5 | Record the work log via `record_work` after a task, module phase, or walkthrough. |
| Any | Update `brain/Key Decisions.md` for architectural decisions; `brain/North Star.md` when focus shifts. |

**`[ALL]` equivalent:** if the `om` MCP server is not connected in your session, **skip vault
sync entirely**. Do not hand-write files into the vault to compensate — that creates a second,
diverging log. Record the decision in the module's `SPEC.md` instead, which is where it
belongs anyway.
