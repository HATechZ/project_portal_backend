# Tasks: 01 — Persistence

**Status:** Gate 4 complete, Gate 5 pending walkthrough
**Spec Reference:** `specs/01-persistence/SPEC.md`
**Plan Reference:** `specs/01-persistence/plan.md`

> Governed by [`specs/RULES.md`](../RULES.md) **[Article II](../rules/02-proof.md)**. Run:
>
> ```bash
> yarn verify:sdd --module 01
> ```

---

- [x] **Phase 1: Schema generation pipeline**
  - [x] Keep the DBML as the schema authority
        VERIFY: test -f project_portal_workflow_management_erd.dbml && grep -q "writeFileSync('prisma/schema.prisma'" scripts/dbml-to-prisma.cjs
  - [x] Emit the client outside `node_modules` and keep it out of git
        VERIFY: grep -q 'output       = "../src/generated/prisma"' prisma/schema.prisma && grep -q "src/generated/prisma" .gitignore
  - [x] Import the client from the generated path, never from `@prisma/client`
        VERIFY: test $(grep -rl "from '@prisma/client'" src --include=*.ts | wc -l) -eq 0
  - [x] Keep the connection string out of the schema
        VERIFY: ! grep -qE "^[[:space:]]+url[[:space:]]+=" prisma/schema.prisma
  - [x] Supply the CLI datasource from config
        VERIFY: grep -q "env('DATABASE_URL')" prisma.config.ts

- [x] **Phase 2: Runtime client**
  - [x] Connect through the Prisma 7 pg driver adapter
        VERIFY: grep -q "PrismaPg" src/infra/prisma/prisma.service.ts && grep -q "@prisma/adapter-pg" package.json
  - [x] Connect both runtime clients on module init and disconnect both on destroy
        VERIFY: grep -q "OnModuleInit" src/infra/prisma/prisma.service.ts && grep -q 'privilegedClient.\$connect()' src/infra/prisma/prisma.service.ts && grep -q 'privilegedClient.\$disconnect()' src/infra/prisma/prisma.service.ts
  - [x] Expose the persistence services globally so feature modules need no import
        VERIFY: grep -q "@Global()" src/infra/prisma/prisma.module.ts && grep -q "UnitOfWorkService" src/infra/prisma/prisma.module.ts

- [x] **Phase 3: Unit of work**
  - [x] Hold the active transaction in AsyncLocalStorage
        VERIFY: grep -q "AsyncLocalStorage" src/infra/prisma/unit-of-work.service.ts
  - [x] Join an outer transaction instead of nesting a second one
        VERIFY: grep -q "if (current) return work(current)" src/infra/prisma/unit-of-work.service.ts
  - [x] Give repositories only the active ambient transaction and fail closed without one
        VERIFY: grep -q "protected get db" src/infra/prisma/base.repository.ts && grep -q "unitOfWork.client" src/infra/prisma/base.repository.ts && grep -q "Repository access requires an active unit of work" src/infra/prisma/unit-of-work.service.ts
  - [x] Open bounded scoped transactions and set the bound tenant GUC before repository work
        VERIFY: grep -q "prisma.scoped.\$transaction" src/infra/prisma/unit-of-work.service.ts && grep -q "set_config('app.tenant_id', \${tenantId}, true)" src/infra/prisma/unit-of-work.service.ts && grep -q "timeout: options?.timeout ?? 15000" src/infra/prisma/unit-of-work.service.ts && node node_modules/jest/bin/jest.js --runInBand unit-of-work.service.spec.ts

- [x] **Phase 4: Migrations**
  - [x] Generate the client before the process starts, without migrating
        VERIFY: grep -q '"prestart": "prisma generate"' package.json && grep -q '"prestart:dev": "prisma generate"' package.json
  - [x] Keep migration out of every start path so running the app cannot mutate the database
        VERIFY: test $(node -e "const s=require('./package.json').scripts;console.log(Object.entries(s).filter(([k,v])=>/^(pre)?start/.test(k)&&/migrate/.test(v)).length)") -eq 0
  - [x] Keep at least one committed migration in sync with the generated schema
        VERIFY: test -d prisma/migrations && test $(ls prisma/migrations | grep -c "^[0-9]") -ge 1
  - [x] Keep migration available as an explicit owner-run command
        VERIFY: grep -q '"prisma:deploy": "prisma migrate deploy"' package.json

- [ ] **Phase 5: Adoption**
  - [ ] Land the first `BaseRepository` subclass so the unit of work is exercised in anger
        VERIFY: test $(grep -rl "extends BaseRepository" src --include=*.ts | wc -l) -ge 1
