# SPEC: 01.1 — Schema Integrity & Tenant Isolation

**Status:** Gate 5 · verified · **Tables:** owns none
**Contract:** `DATA_CONTRACT.md` · **Law:** [Art. IX](../rules/08-database.md)

This module adds database-enforced tenant isolation and a small set of proven integrity
constraints without redesigning Project Portal identities, workflow routing, document
semantics, configurable reference data, or historical business snapshots.

## Organizing decisions

1. RLS sits below the existing tenant-aware Prisma layer and fails closed without a tenant GUC.
2. Cross-tenant relay work uses a separate `BYPASSRLS` runtime role; the app role never does.
3. Composite tenant FKs are limited to the approved Phase 7 chains.
4. Intentional redundancy is retained when it represents affiliation, history, caching, or audit.
5. Schema changes flow DBML → generator → Prisma → reviewed migration.
6. Runtime configuration has only the app and relay connections. The provider/table-owner
   connection is injected temporarily into a migration command/session and is never retained
   by NestJS or checked at application startup.

## Domain rules

| ID | Rule |
|---|---|
| DR-01 | Every guarded relationship carries and checks its tenant. |
| DR-02 | A scoped query without `app.tenant_id` fails; absence never means cross-tenant access. |
| DR-03 | Only `app_relay` may bypass RLS and only for its approved relay operations. |
| DR-04 | `TENANT_SCOPED_MODELS` stays equal to the models declaring `tenantId`. |
| DR-05 | `members.company_id` and `teams.company_id` remain explicit and must agree with their division's tenant/company. |
| DR-06 | Bid project name/code remain historical Bid-era snapshots. |
| DR-07 | `document_folders.parent_folder_id` is hierarchy authority; `folder_path` is a logical-path cache; `storage_key` is physical storage identity. |
| DR-08 | Workflow action permissions are coarse eligibility; nullable transition roles and assignment/context checks remain routing inputs. |
| DR-09 | Exact duplicate active transition configurations are forbidden with NULL-safe equality; inactive duplicates are allowed as history. |
| DR-10 | User remains the login principal; Member and ClientContact retain independent business identity and optional User links. |
| DR-11 | ActorProfile may have neither business target or exactly one, never both; a non-null tenant/user has at most one default profile. |
| DR-12 | Existing lookup tables, `DocumentVersion.textContent`, and global tenant/Work Request code uniqueness remain intact. |
| DR-13 | The generated Prisma model is `WorkPriority`, mapped to unchanged table `work_priorities`. |

## Acceptance criteria

- `[AC-U01]` Every tenant-scoped table SHALL have RLS and its isolation policy.
- `[AC-E01]` A guarded foreign-tenant write SHALL be rejected by a named composite FK.
- `[AC-E02]` Member/team division, tenant, and company SHALL agree.
- `[AC-E03]` A second exact active transition rule, including NULL role/status values, SHALL be rejected.
- `[AC-E04]` An ActorProfile with both Member and ClientContact SHALL be rejected.
- `[AC-W01]` A second default ActorProfile for a non-null `(tenant_id,user_id)` SHALL be rejected.
- `[AC-S01]` Missing tenant context SHALL fail closed for `app_user`.
- `[AC-S02]` The privileged relay SHALL continue authenticating separately as `app_relay`.
- `[AC-C01]` Project Portal workflow permissions, assignment/object/context authorization, Request Info routing, client/member/requester routing, and Bid readiness SHALL remain unchanged.
- `[AC-C02]` Prime Consultant and the removed PM client-revision route SHALL NOT be reintroduced.

## Owner-approved retained architecture (2026-09-02)

- Keep Member/Team company affiliation, Bid name/code snapshots, folder-path cache, storage key,
  nullable transition roles, current identity architecture, ActorProfile label, all five lookup
  tables, document text content, and non-reusable Work Request codes.
- Reject Person/UserAccount, ActorKind, speculative Member tenure, blanket `@updatedAt`, lookup
  collapse, and the unsafe `(tenant, action, from status)` transition uniqueness.
- Phase 7 artifacts preserve the approved design; their named catalog verification must remain
  green after deployment.

## Out of scope

Endpoint redesign; new roles/actions; Prime Consultant; the removed PM revision action;
folder-cache synchronization implementation (owned by module 08); document extraction/search
redesign; configurable lookup conversion; historical Member tenure; database execution without
a temporary provider/table-owner migration session.
