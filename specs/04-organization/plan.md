# Technical Plan: 04 — Organization

**Status:** Retro-spec (Gate 2) · **Related Spec:** `SPEC.md` · **Contract:** `API_CONTRACT.md`

---

## 1. Module tree (as shipped)

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
GET /company        controller → service → CompanyQueryProvider → paginate() → repository.scoped
GET /company-type   controller → service → CompanyQueryProvider → repository.unscoped
POST /company       controller → service → CompanyMutationProvider
                                              ├─ findCompanyType()  ← pre-flight, unscoped
                                              └─ create()           ← scoped, app-generated id
```

### The two clients, and why

`CompanyRepository` reaches for `prisma.scoped` for companies and plain `prisma.*` for company
types. This is not an oversight:

| Table | `tenant_id`? | Client | Why |
|---|---|---|---|
| `companies` | yes | `prisma.scoped` | tenant extension injects the filter |
| `company_types` | **no** | `prisma.companyType` | global reference data; a scoped read would filter on a column that does not exist |

Any future reader who "fixes" the second one to `.scoped` will break company types entirely.
That is the single most likely wrong change to this file.

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
| 3 | Close the deviations — `BaseRepository`, drop the local Prisma catch | **not started** |
| 4 | Update / deactivate endpoints | not started |
| 5 | Divisions, members, teams — the module's other 5 tables | not started |

Phase 3 is the one worth doing next: it is entirely local to this module, needs no schema
change, and removes the last reason this module cannot participate in a transaction with
another.
