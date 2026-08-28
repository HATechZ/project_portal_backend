# Tasks: [Module Number] — [Module Title]

**Status:** In Progress
**Spec Reference:** `specs/[NN-module]/SPEC.md`
**Plan Reference:** `specs/[NN-module]/plan.md`

> Governed by [`specs/RULES.md`](../RULES.md) **[Article II](../rules/02-proof.md)** — every leaf task
> carries a `VERIFY:` line. A task is ticked **only** when its command exits 0. Run:
>
> ```bash
> yarn verify:sdd --module [NN]
> ```
>
> The agent that implements a task does not verify it. Assertions are static: `grep`, `test`,
> `yarn lint`, `yarn build`. Never write one that needs a database, Redis, or the network.

---

- [ ] **Phase 1: [name]**
  - [ ] [Atomic, checkable change]
        VERIFY: test -f src/[module]/[module].repository.ts
  - [ ] [Atomic, checkable change]
        VERIFY: grep -q "extends BaseRepository" src/[module]/[module].repository.ts

- [ ] **Phase 2: [name]**
  - [ ] Register the module in `PLACEHOLDERS.md` as specced
        VERIFY: grep -q "src/[module]/[module].module.ts" specs/PLACEHOLDERS.md
  - [ ] Lint and build clean
        VERIFY: yarn lint && yarn build

- [ ] **Phase N: Module boundaries ([Art. XI](../rules/10-messaging.md))**
  > This module talks to others only by publishing events. Delete the consumer rows if it
  > publishes but consumes nothing; never delete the first two.
  - [ ] This module imports no other feature module
        VERIFY: test $(grep -rlE "from '\.\.?/(\.\./)?(auth|user|company|role-permission)/" src/[module] --include=*.ts | wc -l) -eq 0
  - [ ] Its events carry no framework, ORM, or transport types
        VERIFY: ! grep -rqE "generated/prisma|@nestjs/|amqplib|bullmq" src/contracts/events/[module]/
  - [ ] It publishes through the outbox, never the transport
        VERIFY: ! grep -rq "EVENT_TRANSPORT" src/[module]/
  - [ ] Its consumers restore tenant context before persisting
        VERIFY: test $(for f in $(find src/[module] -name "*.handler.ts" 2>/dev/null); do grep -q "RequestContext\|EventHandlerBase" $f || echo $f; done | wc -l) -eq 0
  - [ ] Its consumers never advance the workflow
        VERIFY: test $(grep -rlE "WorkflowTransition|applyTransition" src/[module] --include=*.handler.ts 2>/dev/null | wc -l) -eq 0

- [ ] **Phase N: SOLID conformance ([Art. X](../rules/09-solid.md))**
  > Scoped to this module. The repo-wide equivalents live in `specs/00-platform-core/tasks.md`;
  > the full catalogue is in the article. Keep both — these fail earlier and name the module.
  - [ ] The controller touches no persistence and runs no queries
        VERIFY: ! grep -qE "PrismaService|Repository|prisma\.|findMany|findUnique" src/[module]/[module].controller.ts
  - [ ] The service depends on repositories, not concrete infrastructure
        VERIFY: ! grep -qE "PrismaService|PrismaClient|new Redis|nodemailer" src/[module]/[module].service.ts
  - [ ] The repository goes through the unit of work
        VERIFY: grep -q "extends BaseRepository" src/[module]/[module].repository.ts
  - [ ] Files stay under their size caps
        VERIFY: test $(find src/[module] -name "*.controller.ts" -exec wc -l {} + | grep -v total | awk '$1>150' | wc -l) -eq 0 && test $(find src/[module] \( -name "*.service.ts" -o -name "*.repository.ts" \) -exec wc -l {} + | grep -v total | awk '$1>200' | wc -l) -eq 0
