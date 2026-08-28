# Declared Placeholder Surfaces

> Rule artifact for [`RULES.md`](RULES.md) **[Article I, Gate 0](rules/01-lifecycle.md)**.
> Not a status surface — status lives in [`INDEX.md`](INDEX.md).

Gate 0 forbids implementing a module before its `SPEC.md` exists. The implementation surface
for this backend is the **NestJS feature module**: every `*.module.ts` under `src/`, except
the root `AppModule`, must appear in one of the two tables below.

A **declared placeholder** is the narrow exception: an inert module shell that reserves a
name and registers no working providers, carrying no domain logic. It is only legitimate
while it stays inert. The moment it wires persistence or cache it is an implementation, and
Gate 0 applies in full. `yarn verify:sdd` enforces the criteria below on every run.

## Criteria (all must hold)

1. Listed in the **Placeholder surfaces** table below.
2. Imports nothing matching `prisma`, `redis`, `repository`, or `.service` — no persistence,
   no cache, no domain services.
3. At or under its declared line cap.
4. Names the spec that will replace it.

Fail any one and the file is an implementation: write the Gate 1 spec or delete the module.

## Placeholder surfaces

| File | Intended spec | Line cap | Notes |
|---|---|---|---|

*None. Every module under `src/` currently maps to a spec.*

## Specced surfaces

Every feature module maps to an existing spec directory. The verifier checks that each named
directory exists, so this table cannot silently rot.

| File | Spec |
|---|---|
| `src/common/swagger/openapi.module.ts` | `specs/00-platform-core` |
| `src/infra/prisma/prisma.module.ts` | `specs/01-persistence` |
| `src/infra/redis/redis.module.ts` | `specs/02-infrastructure` |
| `src/infra/throttler/throttler.module.ts` | `specs/02-infrastructure` |
| `src/infra/mail/mail.module.ts` | `specs/02-infrastructure` |
| `src/infra/mail/mail-workers.module.ts` | `specs/02-infrastructure` |
| `src/users/users.module.ts` | `specs/03-identity-and-access` |

`src/app.module.ts` is the composition root and is exempt — it registers modules but owns no
domain surface of its own.

## Module numbering

Canonical ids. A new module claims the next free number and is added to
[`INDEX.md`](INDEX.md) in the same commit.

`00` platform-core · `01` persistence · `02` infrastructure · `03` identity-and-access ·
`04` organization · `05` clients · `06` reference-data · `07` projects-and-bids ·
`08` documents · `09` workflow-engine · `10` work-requests ·
`11` info-requests-and-revisions · `12` notifications · `13` audit
