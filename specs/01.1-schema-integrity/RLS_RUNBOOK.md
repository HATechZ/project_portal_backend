# Phase 6 RLS deployment and verification

Use three separate identities. A dedicated migration/table-owner role applies migrations;
`app_user` serves `DATABASE_URL`; `app_relay` serves `DATABASE_URL_PRIVILEGED`. PostgreSQL table
owners bypass row-level security unless `FORCE ROW LEVEL SECURITY` is enabled, so neither
runtime identity may own tables or execute migrations.

Provision the two runtime roles before applying the migration, through infrastructure tooling
or an administrator session. Credentials/passwords belong in the deployment secret store and
must never appear in this migration or repository. Required attributes are:

```sql
CREATE ROLE app_user LOGIN NOSUPERUSER NOCREATEROLE NOBYPASSRLS;
CREATE ROLE app_relay LOGIN NOSUPERUSER NOCREATEROLE BYPASSRLS;
```

Set passwords separately through the platform's secret-aware role-management path. Ensure
`app_user` is not directly or indirectly a member of `app_relay`. The migration intentionally
does not create, alter, or credential roles; it aborts unless both pre-provisioned identities
have the exact safe attributes and separation above. This keeps authentication cutover outside
transactional schema history and prevents a migration from overwriting managed credentials.

Deployment order:

1. Pre-provision runtime roles and credentials; keep application URLs unchanged while the
   migration has not been approved or scheduled.
2. Stage `DATABASE_URL` for `app_user` and `DATABASE_URL_PRIVILEGED` for `app_relay` in the
   runtime secret store, but do not restart instances yet.
3. Drain and stop every application/worker instance that still has the migration/table-owner
   credential. Remove that administrative secret from the runtime deployment definition.
   There must be no serving process during the RLS/cutover window.
4. In a separate migration job only, expose the administrative connection as `DATABASE_URL`
   because `prisma.config.ts` reads that name, then apply the migration. Never inject this
   secret into an application or relay container.
5. Run `rls-verification.sql` as the migration administrator. Confirm the role, ownership,
   policy, tenant-root, and relay assertions before allowing traffic.
6. Start fresh application instances with the staged runtime URLs. Startup independently
   checks `current_user`, `session_user`, `rolbypassrls`, and public-table ownership and refuses
   to run unless the clients authenticate directly as `app_user` and `app_relay` respectively.
7. Perform the HTTP walkthrough and inspect relay health/backlog before restoring full traffic.

This stop-the-world cutover is deliberate: applying RLS while an old instance continues using
the table-owner credential would leave that instance bypassing policies. Normal application
requests therefore cannot run between migration application and runtime credential cutover.

## Unscoped table grants

The schema has 15 models without `tenant_id`:

- `attachment_file_groups`, `attachment_source_types`, `company_types`, `decision_results`;
- `division_types`, `info_request_statuses`, `option_types`, `project_statuses`;
- `revision_request_statuses`, `roles`, `tenants`, `work_priorities`;
- `workflow_action_definitions`, `workflow_statuses`, `workspace_types`.

`tenants` is not globally readable: current code only checks activation for the tenant already
in request context. It therefore has RLS with `id = current_setting('app.tenant_id')::uuid` and
becomes the tenant root above the 52 `tenant_id`-bearing tables: 53 protected tables total.

## Audited current application grants

Every implemented Prisma delegate operation and nested relation projection was reviewed. The
minimum practical `app_user` table privileges are:

| Privilege | Tables |
|---|---|
| `SELECT` | `actor_profiles`, `auth_session_consumed_refresh_tokens`, `auth_sessions`, `client_contacts`, `clients`, `companies`, `company_types`, `divisions`, `members`, `outbox_messages`, `password_reset_tokens`, `processed_events`, `roles`, `tenants`, `user_roles`, `users`, `workflow_action_definitions`, `workflow_action_role_permissions` |
| `INSERT` | `auth_session_consumed_refresh_tokens`, `auth_sessions`, `companies`, `outbox_messages`, `password_reset_tokens`, `processed_events`, `user_roles`, `users`, `workflow_action_role_permissions` |
| `UPDATE` | `auth_sessions`, `password_reset_tokens`, `user_roles`, `users`, `workflow_action_role_permissions` |
| `DELETE` | `users` |

Prisma emits `RETURNING` for creates, so every inserted table also needs `SELECT`. Nested
auth/session projections account for reads of members, divisions, clients, contacts,
companies, roles, action definitions, and action-role permissions. The other tables have no
current code path and receive no privilege. `_prisma_migrations` is explicitly revoked, and
there is no blanket grant over all tables. Future modules must expand grants in their own
reviewed migration when their repositories land.

`app_relay` receives exactly `SELECT, UPDATE` on `outbox_messages`; all other direct table
privileges are revoked, including `processed_events` and `_prisma_migrations`.

After the owner applies the migration, run `rls-verification.sql` with two distinct existing
tenant IDs and an existing `outbox_messages.id` owned by the first tenant. The script proves:

- `app_user` sees the expected row under the correct tenant;
- the same role sees no row under the wrong tenant;
- the tenant-root policy exposes exactly the current tenant registry row;
- an unset tenant GUC raises instead of broadening access;
- `app_relay` can read that row without a tenant GUC;
- both runtime roles have `LOGIN`;
- `app_user` cannot bypass RLS, inherit or `SET ROLE app_relay`;
- runtime roles own no public table;
- `app_relay` has exactly `SELECT, UPDATE` on `outbox_messages` and no other table access.

## Rollback

[`rls-rollback.sql`](rls-rollback.sql) is the executable, deliberately unexecuted inverse of the
Phase 6 migration. It contains explicit statements only: one transaction, the exact forward
grants revoked, all 53 named policies dropped from their exact tables, and RLS disabled on
those same 53 tables. It never changes data, ownership, credentials, role attributes, role
membership, or role existence.

Use it only for an immediate Phase 6 backout while every application and worker remains stopped,
after confirming no later migration depends on these policies or grants. Execute it as the
dedicated migration/table-owner role, then restore the pre-cutover application deployment and
credentials through the deployment platform before serving traffic.

Do not use it as a routine toggle, while any runtime process is serving, after later migrations
have changed the protected set, or when the goal is to recover permissions that existed before
Phase 6. The forward migration intentionally clears stale direct grants before applying its
audited minimum. Those unknown historical grants cannot be reconstructed safely and the rollback
does not attempt to restore them. The rollback revokes only the exact grants made by Phase 6;
operators must review any separately managed grants before execution.
