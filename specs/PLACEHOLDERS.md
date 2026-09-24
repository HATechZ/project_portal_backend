# Declared Placeholder Surfaces

> Rule artifact for [`RULES.md`](RULES.md) **[Article I, Gate 0](rules/01-lifecycle.md)**.
> Not a status surface â€” status lives in [`INDEX.md`](INDEX.md).

Gate 0 forbids implementing a module before its `SPEC.md` exists. The implementation surface
for this backend is the **NestJS feature module**: every `*.module.ts` under `src/`, except
the root `AppModule`, must appear in one of the two tables below.

A **declared placeholder** is the narrow exception: an inert module shell that reserves a
name and registers no working providers, carrying no domain logic. It is only legitimate
while it stays inert. The moment it wires persistence or cache it is an implementation, and
Gate 0 applies in full. `yarn verify:sdd` enforces the criteria below on every run.

## Criteria (all must hold)

1. Listed in the **Placeholder surfaces** table below.
2. Imports nothing matching `prisma`, `redis`, `repository`, or `.service` â€” no persistence,
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
| `src/common/security/security.module.ts` | `specs/02.1-messaging` |
| `src/common/tenant/tenant.module.ts` | `specs/01.1-schema-integrity` |
| `src/infra/crypto/crypto.module.ts` | `specs/02.1-messaging` |
| `src/infra/prisma/prisma.module.ts` | `specs/01-persistence` |
| `src/infra/redis/redis.module.ts` | `specs/02-infrastructure` |
| `src/infra/throttler/throttler.module.ts` | `specs/02-infrastructure` |
| `src/infra/mail/mail.module.ts` | `specs/02-infrastructure` |
| `src/infra/mail/mail-workers.module.ts` | `specs/02-infrastructure` |
| `src/infra/messaging/messaging.module.ts` | `specs/02.1-messaging` |
| `src/infra/storage/storage.module.ts` | `specs/02-infrastructure` |
| `src/user/user.module.ts` | `specs/03-identity-and-access` |
| `src/auth/auth.module.ts` | `specs/03-identity-and-access` |
| `src/role-permission/role-permission.module.ts` | `specs/03-identity-and-access` |
| `src/company/company.module.ts` | `specs/04-organization` |
| `src/division/division.module.ts` | `specs/04.1-division` |
| `src/member/member.module.ts` | `specs/04.2-member` |
| `src/team/team.module.ts` | `specs/04.3-team` |
| `src/designation/designation.module.ts` | `specs/04.4-designation` |
| `src/client/client.module.ts` | `specs/05-clients` |
| `src/pol-code/pol-code.module.ts`                         | `specs/06.1-pol`               |
| `src/pod-code/pod-code.module.ts`                         | `specs/06.2-pod`               |
| `src/cargo-code/cargo-code.module.ts`           | `specs/06.3-cargo-codes`       |
| `src/vessel-code/vessel-code.module.ts`         | `specs/06.4-vessel-codes`      |
| `src/general-document-code/general-document-code.module.ts` | `specs/07-general-document-codes` |
| `src/marketing-document-code/marketing-document-code.module.ts` | `specs/07.1-marketing-document-codes` |
| `src/etc-document-code/etc-document-code.module.ts` | `specs/07.2-etc-document-codes` |
| `src/engineering-document-code/engineering-document-code.module.ts` | `specs/07.3-engineering-document-codes` |
| `src/pm-operation-code/pm-operation-code.module.ts` | `specs/07.4-pm-operation-codes` |
| `src/bid/bid.module.ts` | `specs/08-bid` |
| `src/project/project.module.ts` | `specs/09-project` |

`src/app.module.ts` is the composition root and is exempt â€” it registers modules but owns no
domain surface of its own.

## Module numbering

Canonical ids. A new module claims the next free number and is added to
[`INDEX.md`](INDEX.md) in the same commit.

`00` platform-core Â· `01` persistence Â· `02` infrastructure Â· `03` identity-and-access Â·
`04` organization Â· `05` clients Â· `06` reference-data Â· `07` general-document-codes Â·
`08` bid Â· `09` project Â· `10` work-requests Â·
`11` info-requests-and-revisions Â· `12` notifications Â· `13` audit
