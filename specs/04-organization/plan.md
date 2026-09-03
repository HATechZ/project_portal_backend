# Technical Plan: 04 — Organization

**Status:** Retro-spec (Gate 2) · **Related Spec:** `SPEC.md` · **Contract:** `API_CONTRACT.md`

---

## 1. Module tree (as shipped)

The approved onboarding addition uses separate public `company-signup.controller.ts` and
`company-type.controller.ts` controllers, a
signup service that hashes through `PASSWORD_HASHER`, and a signup repository that invokes only
`public.provision_company_workspace` through the normal `app_user` client. Existing Company read
paths remain guarded and unchanged; the old create handler is retired.

The database function is the atomic boundary and internally resolves `system_admin`, creates the
role-only default ActorProfile, and materializes the predefined permission matrix. Its fixed
signature carries no caller-controlled authorization or ActorProfile fields.

```
src/company/
├── company.module.ts              # no imports — guards arrive via the global SecurityModule
├── company.controller.ts          # routes + guards + Swagger, no queries
├── company.service.ts             # delegates; owns no logic of its own
├── dtos/
│   ├── create-company.dto.ts      # class-validator + @Transform trimming
│   └── company-response.dto.ts    # CompanyResponseDto, CompanyTypeResponseDto
├── providers/
│   ├── company-mutation.provider.ts   # writes
│   ├── company-query.provider.ts      # reads + pagination
│   └── company.mapper.ts              # record → DTO, pure functions
└── repositories/
    └── company.repository.ts      # the only file that names Prisma
```

The service is a pass-through. That reads as ceremony, and for one aggregate it nearly is — but
it is the seam that keeps the controller from binding to two providers, and it is where the
transaction boundary will go when writes stop being single-statement.

## 2. Read and write paths

```
GET /company        controller → service → CompanyQueryProvider → paginate() → repository UnitOfWork
GET /company-type   public controller → service → CompanyQueryProvider → narrow reference read
POST /company/signup public controller → signup service → signup repository → provisioning function
```

### One normal client, two data scopes

`CompanyRepository` extends `BaseRepository`; tenant-scoped methods open or join the normal
app-user UnitOfWork. Global reference data uses a separate narrow read transaction and does not
require the privileged relay client:

| Table | `tenant_id`? | Executor | Why |
|---|---|---|---|
| `companies` | yes | ambient `app_user` transaction | tenant filtering and RLS apply |
| `company_types` | **no** | narrow `app_user` reference-read transaction | needed before Tenant context; exposes only parameterized `$queryRaw` |

`PrismaService.unscoped` is the separate `app_relay` executor and is reserved for the approved
cross-tenant outbox relay path, not Company or CompanyType access.

### The pre-flight check is not the guard

`findCompanyType` before insert produces a clean 400 instead of a raw foreign-key error. It is a
convenience, not the constraint — the row can vanish between the check and the insert, so the
`P2003` branch still has to exist. The FK is the guarantee; the lookup is the message.

## 3. Pagination

`paginate(query, fetch, count)` from `src/common/pagination/`. Ordering is `name asc, id asc` —
the `id` tiebreak matters: `name` is not unique, and without a total order a row can appear on
two pages or none.

## 4. Errors

| Case | Path | Result |
|---|---|---|
| Duplicate abbr | `P2002` caught in the provider | 409 |
| Unknown type, checked | pre-flight lookup | 400 |
| Unknown type, raced | `P2003` caught in the provider | 400 |
| Missing company | `findById` returns null | 404 |

Catching Prisma errors in the provider is a **deviation** (Art. VI.4) — `mapPrismaException`
owns this translation. It is recorded rather than fixed because the fix belongs with the
repository rework in Phase 3, not on its own.

## 5. Sequencing

| Phase | Content | State |
|---|---|---|
| 1 | Reference reads, tenant-scoped company reads, pagination | shipped |
| 2 | Guarded create with permission + uniqueness | shipped |
| 3 | Close the deviations — `BaseRepository` complete under 01.1; local Prisma catch remains | **in progress** |
| 4 | Update / deactivate endpoints | not started |
| 5 | Divisions, members, teams — the module's other 5 tables | not started |

The UnitOfWork portion of Phase 3 was completed by Module 01.1. Its remaining local error and
typing deviations are unrelated to 01.1 and remain open.

Future Member and Team writes must carry a tenant, company, and division combination accepted
by the Module 01.1 composite FKs. A pre-check may improve the error message, but the database
constraint is authoritative. This is a future contract only, not implementation scope here.
