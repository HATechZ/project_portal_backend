# Article X — SOLID, Strictly `[ALL]`

Read before writing or refactoring any class in `src/`. Card: [`../RULES.md`](../RULES.md).

SOLID is not advisory here. Where a principle can be machine-checked it **is** checked, and
the assertion is the rule. Where it cannot, this article says so plainly rather than
pretending — an unenforceable rule dressed as an enforced one teaches agents that rules are
decorative.

| Principle | Status |
|---|---|
| **S**RP | Enforced — layer separation, one class per file, size caps |
| **O**CP | Review-only — extend via providers and ports |
| **L**SP | Review-only — adapters honor their port's contract |
| **I**SP | Enforced — port interfaces stay narrow |
| **D**IP | Enforced — the layering law below |
| DRY | Review-only |

---

## 1. The layering law (SRP + DIP)

```
controller  →  service  →  repository  →  this.db (unit of work)
     ↑            ↑             ↑
   routes      decides       persists
```

**Each layer may depend only on the layer to its right.** No layer may skip one, and none may
reach left.

| Layer | Owns | May import | Must never import |
|---|---|---|---|
| `*.controller.ts` | HTTP: routing, DTO binding, status codes | its service, DTOs, entities | `PrismaService`, any repository, `ioredis`, `nodemailer`, `bullmq` |
| `*.service.ts` | Decisions, orchestration, transaction boundaries | repositories, ports (by token), other services | `PrismaService`, `PrismaClient`, `new Redis`, `nodemailer` — **outside `src/infra/`** |
| `*.repository.ts` | Persistence | `BaseRepository`, Prisma types | HTTP decorators, DTOs |
| `src/infra/**` | Adapters | anything it adapts | domain modules |

Consequences that catch real mistakes:

- A controller that runs a query has merged two layers. Move the query down.
- A service that imports `PrismaService` has bypassed the unit of work — its writes will not
  join an ambient transaction. This is the concrete cost of the DIP violation, not a
  stylistic complaint.
- A service carrying `@Get()` is a controller wearing the wrong filename.
- Only `src/infra/` may instantiate an infrastructure client (`new PrismaClient`, `new Redis`,
  `new Queue`, `new Worker`).

## 2. Depend on tokens, not adapters (DIP)

Infrastructure is consumed through its injection token, typed as the interface:

```typescript
constructor(@Inject(MAIL_QUEUE) private readonly mail: Queue) {}       // ✔
constructor(private readonly sender: NodemailerMailSender) {}          // ✗ compiles, defeats the point
```

No file outside `src/infra/` may name a concrete adapter — `NodemailerMailSender`,
`HandlebarsTemplateRenderer`, `RedisThrottlerStorage`.

## 3. Size caps (SRP)

A file over its cap is doing more than one thing. Caps are generous against today's code
(largest file in `src/` is 92 lines) and exist to force decomposition before a class becomes
the 600-line god-object this project's frontend sibling had to refactor twice.

| File | Cap |
|---|---|
| `*.controller.ts` | 150 lines |
| `*.service.ts` | 200 lines |
| `*.repository.ts` | 200 lines |

One exported class per controller, service, and repository file. DTO, entity, and value-object
files may co-locate closely-related small classes (`PaginatedResult` + `PaginationMeta`).

Splitting to satisfy a cap must produce a **named concept**, not `UsersService2`. If no honest
name exists, the cap is telling you the design is wrong, not that the file is long.

## 4. Narrow ports (ISP)

A `*.port.ts` interface declares at most **5** methods. A port is what one consumer needs, not
everything an adapter can do. Two consumers needing different subsets means two ports.

## 5. Review-only principles

Not assertable, still binding — raise them in review and in `plan.md`:

- **OCP** — extend through new providers, ports, and composition. A `switch` on a type
  discriminant that grows a case per feature is the smell; a provider map is the fix.
- **LSP** — any adapter behind a port honors the contract including its error modes. A sender
  that silently swallows failures is not substitutable for one that throws.
- **DRY** — cross-cutting helpers in `src/common/`, infrastructure in `src/infra/`. Copying a
  pagination or error-mapping helper into a module is a violation even though nothing greps it.

---

## 6. Assertion catalogue

Copy these into any module's `tasks.md`. They are the enforcement, verbatim.

```bash
# Controllers touch no persistence or infrastructure
test $(grep -rlE "PrismaService|Repository|ioredis|nodemailer|bullmq" src --include=*.controller.ts | wc -l) -eq 0

# Controllers run no queries
! grep -rqE "prisma\.|this\.db\.|findMany|findUnique|\$transaction" src --include=*.controller.ts

# Services outside infra depend on no concrete infrastructure
test $(grep -rlE "PrismaService|new Redis|nodemailer|PrismaClient" src --include=*.service.ts | grep -v "^src/infra/" | wc -l) -eq 0

# Services carry no HTTP decorators
! grep -rqE "@(Get|Post|Patch|Put|Delete|Controller)\(" src --include=*.service.ts

# No concrete adapter named outside infra
test $(grep -rlE "NodemailerMailSender|HandlebarsTemplateRenderer|RedisThrottlerStorage" src --include=*.ts | grep -v "^src/infra/" | wc -l) -eq 0

# Only infra instantiates infrastructure clients
test $(grep -rlE "new (PrismaClient|Redis|Queue|Worker)\(" src --include=*.ts | grep -v "^src/infra/" | wc -l) -eq 0

# Size caps
test $(find src -name "*.controller.ts" -exec wc -l {} + | grep -v total | awk '$1>150' | wc -l) -eq 0
test $(find src -name "*.service.ts"    -exec wc -l {} + | grep -v total | awk '$1>200' | wc -l) -eq 0
test $(find src -name "*.repository.ts" -exec wc -l {} + | grep -v total | awk '$1>200' | wc -l) -eq 0

# One class per controller/service/repository file
test $(for f in $(find src \( -name "*.controller.ts" -o -name "*.service.ts" -o -name "*.repository.ts" \)); do n=$(grep -c "^export \(abstract \)\?class" $f); [ "$n" -gt 1 ] && echo $f; done | wc -l) -eq 0

# Ports declare at most 5 methods
test $(for f in $(find src -name "*.port.ts"); do n=$(grep -cE "^  [a-zA-Z]+.*\(.*\).*:" $f); [ "$n" -gt 5 ] && echo $f; done | wc -l) -eq 0
```

**Known failure today:** `src/users/users.service.ts` injects `PrismaService`, so the third
assertion fails. It is an unticked task in module 03 Phase 2, not an exception to this article.
