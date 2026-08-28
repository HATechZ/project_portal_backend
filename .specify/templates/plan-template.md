# Technical Plan: [Module Number] — [Module Title]

**Status:** Draft | In Review | Approved
**Related Spec:** `specs/[NN-module]/SPEC.md`
**Contracts:** `DATA_CONTRACT.md` · `API_CONTRACT.md`

---

## 1. Module Tree

```
src/[module]/
├── [module].module.ts           # registration; imports nothing global (Prisma/Redis are @Global)
├── [module].controller.ts       # routing only — no business logic
├── [module].service.ts          # decisions, orchestration, transactions
├── [module].repository.ts       # extends BaseRepository, reads this.db
├── dto/
│   ├── create-[entity].dto.ts
│   └── update-[entity].dto.ts
└── entities/
    └── [entity].entity.ts       # Swagger response shape, distinct from the Prisma model
```

---

## 2. DTOs

```typescript
// class-validator rules mirror the DB constraints in DATA_CONTRACT.md
export class CreateExampleDto {
  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MaxLength(180)
  name!: string;
}
```

Query DTOs extend `PaginationQueryDto`. Implicit conversion is off — numeric query params
need `@Type(() => Number)`.

---

## 3. Repository Surface

| Method | Returns | Transaction |
|---|---|---|
| `findPage(args)` | `PaginatedResult<T>` | no |
| `create(data)` | `T` | joins ambient |

Repositories extend `BaseRepository` and read `this.db`. Multi-step writes use
`this.transaction(...)`.

---

## 4. Transaction Boundaries

[Which service methods open a unit of work, and why. Every write that touches more than one
table belongs in one. Name the tables each boundary covers.]

---

## 5. Ids, Enums & Derived State

- Ids: app-generated `randomUUID()` at insert time — never a DB default.
- Enums consumed: [list by Prisma name].
- Derived state read: [e.g. latest `work_request_audit_logs.to_status_id`], never a column.

---

## 6. Errors

| Case | Thrown | Mapped to |
|---|---|---|
| [unique violation] | *(nothing — Prisma P2002)* | `mapPrismaException` → 409 `CONFLICT` |
| [domain rule broken] | `AppException({ code: ... })` | filter passes through |
