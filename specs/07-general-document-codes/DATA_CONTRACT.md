# Data Contract: 07 — General Document Codes

## Current `DocumentCodeOption`

Prisma model `DocumentCodeOption` maps to `document_code_options`: required UUID `tenantId`; UUID primary-key `id`; required `documentGroup DocumentGroupCode`; `code varchar(20)`; `name varchar(180)`; nullable text `description`; `sortOrder Int` defaulting to 0; `isActive Boolean` defaulting to true; and timestamps. It relates to `Tenant` with `onDelete: Restrict` and to `Document[]` through `Document.documentCodeOptionId`.

The exact unique key is `(tenantId, documentGroup, code)`; indexes include `(documentGroup, name)` and `(tenantId)`. `DocumentGroupCode` is `MARKETING`, `ENGINEERING`, or `CUSTOM`; this module fixes `MARKETING` internally and never exposes the group. There is no `isDefault`, system-default marker, or name uniqueness.

## Initial catalogue, normalization, and lifecycle

The following are initial tenant rows only: `000` Info; `001` Project Information; `002` Cargo Information; `011` Action Log; `012` Contact List; `013` Comment Sheet; `802` Contract; `803` Invoice. They have no protected/default status after creation: code, name, and description remain editable, and deactivation/reactivation is permitted.

Code normalizes by trimming surrounding whitespace and uppercasing while retaining its string representation and leading zeroes. Name trims and is non-empty. `sortOrder` is stored but has no V1 mutation/reorder surface; list order is `sortOrder ASC, code ASC, id ASC`.

New tenants automatically receive the eight rows. Existing tenants receive a missing-only backfill. A pre-existing same-code row is preserved exactly—even if its name, description, or activity differs—and custom rows are preserved. The provisioner is tenant-scoped, idempotent, concurrency-safe, and relies on the exact unique key; it never duplicates, overwrites, reactivates, resets, or deletes existing rows.

## Security and runtime prerequisites

RLS is enabled through `tenant_isolation_document_code_options` for `app_user`, with tenant-id `USING` and `WITH CHECK` predicates. Repository predicates must still constrain tenant + fixed `MARKETING` (+ ID where applicable).

Runtime implementation requires a migration granting **only** `SELECT`, `INSERT`, and `UPDATE` on `document_code_options` to `app_user`; it must not grant `DELETE`, `ALL`, or `BYPASSRLS`, and must retain RLS. It also requires the dedicated `MANAGE_GENERAL_DOCUMENT_CODES` workflow action and seed grants only for `system_admin` (the current runtime equivalent of tenant super admin), `division_head`, and `division_lead`; custom roles receive no direct grant. These are approved future implementation prerequisites, not changes made by this spec-only task.

## Bid/Project separation override

The current Project-only Document parent is obsolete combined-workspace persistence. Future Documents require separate Bid/Project relations or an exclusive tenant-qualified parent rule; this does not alter General Document Code selection semantics.

## Document relation and historical behavior

`Document.documentCodeOptionId` is nullable with a raw FK to `DocumentCodeOption.id`; future Document writes must validate the selected option's tenant and fixed General group. Referenced options remain editable and updates apply through that relation. Existing `Document` has no code/name snapshot, while `DocumentVersion` has persisted original/generated filename fields; editing an option must not retroactively rename persisted filenames. No Document or schema redesign is part of Module 07.
