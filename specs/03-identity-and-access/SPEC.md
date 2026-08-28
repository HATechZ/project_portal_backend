# SPEC: 03 — Identity & Access

**Status:** Approved — partially implemented · **Tables:** 6 · **Contracts:** `DATA_CONTRACT.md`, `API_CONTRACT.md`

Who is calling, and what they may do. `users`, `roles`, `user_roles`, `actor_profiles`,
`auth_sessions`, `password_reset_tokens`.

The ERD distinction that shapes every other module: a **user** is a login, an **actor
profile** is a capacity that login acts in. One person may be `division_lead` in one profile
and `division_member` in another. Audit and ownership columns across the whole schema
reference `actor_id`, never `user_id` — if module 07 stamps `created_by_user_id` because the
actor layer was not ready, every audit query in 10–13 inherits the mistake.

**Current state:** only `users` CRUD exists, and it is unauthenticated. The other five tables
have no code. Two shipped details also contradict [Art. VI.4 and VI.5](../rules/06-standards.md);
both are unticked tasks rather than described as done.

## User stories

| | As a | I want | So that |
|---|---|---|---|
| US-01 | any user | to sign in and receive a session | I can act in the portal |
| US-02 | multi-capacity user | to act under a chosen actor profile | permissions and audit reflect the hat I wear |
| US-03 | `system_admin` | to grant/revoke roles without deleting history | "who could do what, when" stays answerable |
| US-04 | user who forgot a password | a single-use expiring reset link | |
| US-05 | operator | to revoke a stolen session immediately | |

## Domain rules

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | The actor profile is the unit of authorization and audit | schema FKs, review |
| DR-02 | Role grants are revoked by `revoked_at`, never deleted | repository has no hard delete |
| DR-03 | A user has at most one default actor profile | service check on `is_default` |
| DR-04 | Refresh and reset tokens are stored hashed | `refresh_token_hash`, `token_hash` |
| DR-05 | A reset token is single-use and expiring | `used_at` + `expires_at` checked together |
| DR-06 | `email` is unique across users, case-insensitively | unique index + normalization on write |
| DR-07 | An inactive user cannot authenticate | login path checks `is_active` |
| DR-08 | A password hash is never serialized to a response | absent from `UserEntity` |

## Failure modes

| Condition | HTTP | `AppErrorCode` |
|---|---|---|
| Email already registered | 409 | `CONFLICT` |
| User not found | 404 | `NOT_FOUND` |
| Bad credentials · inactive user · expired or revoked session | 401 | `UNAUTHORIZED` |
| Role lacks the permission · actor profile not the caller's | 403 | `FORBIDDEN` |
| Reset token unknown, used, or expired | 400 | `BAD_REQUEST` |

Bad credentials and unknown email return the **same** 401 — the error must not reveal whether
an address is registered.

## EARS acceptance criteria

- `[AC-U01]` The system SHALL store password and token material only as hashes.
- `[AC-U02]` The system SHALL never include `passwordHash` in any response body.
- `[AC-U03]` Every mutating endpoint outside sign-in SHALL require an authenticated actor.
- `[AC-E01]` WHEN a user signs in validly, the system SHALL create an `auth_sessions` row and return a refresh token whose hash is stored.
- `[AC-E02]` WHEN a role is revoked, the system SHALL set `revoked_at` and leave the row in place.
- `[AC-E03]` WHEN a password reset is used, the system SHALL set `used_at` so it cannot be replayed.
- `[AC-E04]` WHEN a user acts, the system SHALL attribute the action to their actor profile id.
- `[AC-S01]` WHILE a user is inactive, sign-in SHALL fail with 401.
- `[AC-S02]` WHILE a session is revoked or past `expires_at`, it SHALL NOT authorize a request.
- `[AC-W01]` IF credentials are wrong, THEN the response SHALL NOT reveal whether the email exists.
- `[AC-W02]` IF a caller supplies an actor profile they do not own, THEN the system SHALL return 403.

## Out of scope

`members` and `client_contacts` that actor profiles point at (04, 05) · which workflow action
each role may fire — module 09 owns `workflow_action_role_permissions`.
