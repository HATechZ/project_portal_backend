# Tasks: 00 — Platform Core

**Status:** Gate 4 complete, Gate 5 pending walkthrough
**Spec Reference:** `specs/00-platform-core/SPEC.md`
**Plan Reference:** `specs/00-platform-core/plan.md`

> Governed by [`specs/RULES.md`](../RULES.md) **[Article II](../rules/02-proof.md)** — every leaf task
> carries a `VERIFY:` line. A task is ticked **only** when its command exits 0. Run:
>
> ```bash
> yarn verify:sdd --module 00
> ```
>
> Retro-spec: these tasks describe code that already shipped. Every ticked box was run
> against the source before it was ticked. The unticked ones are real gaps, not future work
> nobody has looked at.

---

- [x] **Phase 1: Request pipeline**
  - [x] Route every request under `/api/v1` via URI versioning
        VERIFY: grep -q "VersioningType.URI" src/config/app-bootstrap.ts && grep -q "defaultVersion: '1'" src/config/app-bootstrap.ts
  - [x] Normalize `API_PREFIX` so a trailing `/v1` cannot double the version segment
        VERIFY: grep -q "replace(/\\\\/v1\$/i" src/config/configuration.ts
  - [x] Reject undeclared body properties rather than stripping them
        VERIFY: grep -q "forbidNonWhitelisted: true" src/config/app-bootstrap.ts && grep -q "whitelist: true" src/config/app-bootstrap.ts
  - [x] Keep implicit type conversion off so DTOs must declare `@Type`
        VERIFY: grep -q "enableImplicitConversion: false" src/config/app-bootstrap.ts
  - [x] Carry a request id in AsyncLocalStorage and echo it as a header
        VERIFY: grep -q "AsyncLocalStorage" src/common/context/request-context.ts && grep -q "new RequestIdInterceptor()" src/config/app-bootstrap.ts

- [x] **Phase 2: Response envelope**
  - [x] Wrap every success response as `{ success, data, meta }`
        VERIFY: grep -q "success: true" src/common/interceptors/response.interceptor.ts && grep -q "new ResponseInterceptor()" src/config/app-bootstrap.ts
  - [x] Keep envelope construction out of controllers
        VERIFY: test $(grep -rl "success: true" src --include=*.controller.ts | wc -l) -eq 0
  - [x] Provide Swagger helpers that document the real enveloped shape
        VERIFY: grep -q "wrapEnvelope" src/common/swagger/wrap-envelope.ts && grep -q "ApiPaginatedResponse" src/common/swagger/api-paginated-response.decorator.ts
  - [x] Clamp page size to 100 regardless of the requested limit
        VERIFY: grep -q "Math.min(100" src/common/pagination/paginate.ts && grep -q "Max(100)" src/common/pagination/pagination-query.dto.ts

- [x] **Phase 3: Error handling**
  - [x] Format every thrown value through one catch-all filter
        VERIFY: grep -q "@Catch()" src/common/exceptions/http-exception.filter.ts && grep -q "useGlobalFilters" src/config/app-bootstrap.ts
  - [x] Define a closed set of domain error codes
        VERIFY: grep -q "enum AppErrorCode" src/common/exceptions/app-error-code.ts
  - [x] Map Prisma P2002 / P2003 / P2025 / init failures centrally
        VERIFY: grep -q "mapPrismaException" src/common/exceptions/http-exception.filter.ts && grep -q "P2002" src/common/exceptions/prisma-exception.map.ts && grep -q "P2003" src/common/exceptions/prisma-exception.map.ts && grep -q "P2025" src/common/exceptions/prisma-exception.map.ts

- [x] **Phase 4: Configuration & lifecycle**
  - [x] Read `process.env` in exactly one file
        VERIFY: test $(grep -rl "process\.env" src --include=*.ts | grep -v "src/config/configuration.ts" | wc -l) -eq 0
  - [x] Fail the boot on invalid configuration
        VERIFY: grep -q "validationSchema: environmentSchema" src/app.module.ts && grep -q "DATABASE_URL" src/config/env.schema.ts
  - [x] Delegate all app wiring out of `main.ts`
        VERIFY: grep -q "configureApplication(app)" src/main.ts && test $(grep -c "useGlobal" src/main.ts) -eq 0
  - [x] Enable shutdown hooks so infrastructure can close cleanly
        VERIFY: grep -q "enableShutdownHooks" src/config/app-bootstrap.ts

- [x] **Phase 5: Architectural conformance (repo-wide, [Art. X](../rules/09-solid.md))**
  - [x] Controllers touch no persistence or infrastructure
        VERIFY: test $(grep -rlE "PrismaService|Repository|ioredis|nodemailer|bullmq" src --include=*.controller.ts | wc -l) -eq 0
  - [x] Controllers run no queries
        VERIFY: ! grep -rqE "prisma\.|this\.db\.|findMany|findUnique|\$transaction" src --include=*.controller.ts
  - [x] Services carry no HTTP decorators
        VERIFY: ! grep -rqE "@(Get|Post|Patch|Put|Delete|Controller)\(" src --include=*.service.ts
  - [x] No concrete infrastructure adapter is named outside `src/infra/`
        VERIFY: test $(grep -rlE "NodemailerMailSender|HandlebarsTemplateRenderer|RedisThrottlerStorage" src --include=*.ts | grep -v "^src/infra/" | wc -l) -eq 0
  - [x] Only `src/infra/` instantiates an infrastructure client
        VERIFY: test $(grep -rlE "new (PrismaClient|Redis|Queue|Worker)\(" src --include=*.ts | grep -v "^src/infra/" | wc -l) -eq 0
  - [x] Controllers stay under 150 lines, services and repositories under 200
        VERIFY: test $(find src -name "*.controller.ts" -exec wc -l {} + | grep -v total | awk '$1>150' | wc -l) -eq 0 && test $(find src \( -name "*.service.ts" -o -name "*.repository.ts" \) -exec wc -l {} + | grep -v total | awk '$1>200' | wc -l) -eq 0
  - [x] One exported class per controller, service, and repository file
        VERIFY: test $(for f in $(find src \( -name "*.controller.ts" -o -name "*.service.ts" -o -name "*.repository.ts" \)); do n=$(grep -c "^export \(abstract \)\?class" $f); [ "$n" -gt 1 ] && echo $f; done | wc -l) -eq 0
  - [x] Port interfaces declare at most 5 methods
        VERIFY: test $(for f in $(find src -name "*.port.ts"); do n=$(grep -cE "^  [a-zA-Z]+.*\(.*\).*:" $f); [ "$n" -gt 5 ] && echo $f; done | wc -l) -eq 0
  - [ ] Services outside `src/infra/` depend on no concrete infrastructure
        VERIFY: test $(grep -rlE "PrismaService|new Redis|nodemailer|PrismaClient" src --include=*.service.ts | grep -v "^src/infra/" | wc -l) -eq 0

- [ ] **Phase 6: Known deviations**
  - [ ] Make the ETag stable across responses by hashing `data` rather than the envelope
        VERIFY: grep -qE "body\?\.data|\.data\b" src/common/interceptors/etag.interceptor.ts
