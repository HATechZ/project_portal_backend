# Data Contract: 04.2 — Member

## Tables and fields

`members` / `Member`: Tenant ID, UUID ID, nullable `userId`, Company ID, Division ID,
`name varchar(160)`, `email varchar(255)`, `roleTitle varchar(140)`, retained `isActive`, and
timestamps. `designation` and `phone` are accepted by the V1 public create body but have no
dedicated current Member columns; V1 maps designation to the structurally mandatory existing
`roleTitle` business field and persists phone on the linked User. Authorization never comes from
designation. It has unique `(id,tenantId)` and `(tenantId,email)`, plus Division and Company
indexes. Its Division relation is the authoritative composite
`(divisionId,tenantId,companyId) -> divisions(id,tenantId,companyId)` relationship. `userId`
is a nullable current relation to User, not an authentication field and not declared unique;
the spec therefore does not invent a one-to-one cardinality.

## Relations and removal lifecycle

Member relates to optional `User`, `ActorProfile` by `(memberId,tenantId)`, Teams it leads,
`team_members`, WorkRequestAssignments, WorkflowInfoRequests as requested/target Member, and
WorkRequestRevisionRequests as requested-to Member. Removal uses existing `isActive`, `leftAt`,
and `revokedAt` fields in one transaction: active Team membership ends, Member-backed profiles
and matching grants/sessions are revoked, and the Member is marked inactive. Active Division or
Team leadership blocks with 409; workflow, audit, role/profile, Team, and leadership history is
not deleted or rewritten.

## Onboarding and access integration boundary

The schema permits an unlinked Member for legacy and exceptional linking paths. Normal V1
`POST /member` must atomically create/link:

1. User with request email and existing Auth password hash.
2. Member linked to that User.
3. UserRole for the required allowed internal `roleId`.
4. Member-backed ActorProfile for that UserRole.

The public create body is `name`, `email`, `password`, `divisionId`, `roleId`, optional
`designation`, and optional `phone`. It never accepts `tenantId`, `companyId`, `userId`,
`actorProfileId`, `passwordHash`, `confirmPassword`, `isActive`, or `teamId`.

The existing `PUT /member/:id/access-link` endpoint remains the exceptional existing-User path:
module 03 creates or locates User access under its own User/password policy; this module's link
operation can associate only an existing same-Tenant User and optional existing eligible profile.

The narrow link transaction reads `users`, active `user_roles`, and `actor_profiles` through its
own repository data access without importing an Identity feature service. It changes only
`members.userId` and, when requested, `actor_profiles.memberId`; it validates Tenant equality,
User equality, profile activity, active non-revoked UserRole matching profile role, and an empty
or already-same Member target. It rejects a profile targeting another Member or a User link that
would invalidate the profile. It neither switches default profile nor grants a role. Use normal
app_user/RLS UnitOfWork, not app_relay.

## Writes and migration impact

Create derives Tenant/Company and uses an existing actor-scoped Division; it receives name,
business email, password, role ID, optional designation, optional phone, and Division ID.
`system_admin` can select any own-Company Division and may create/provision or assign
`division_head`; `division_head` can select any own-Company Division allowed by configured
permissions and may create/provision or assign `division_lead` only for a Division inside that
Company; `division_lead` can select only the active actor Member's Division and may
create/provision or assign `team_lead` only for a Team inside that Division; `team_lead` can
select only exact led-Team scope for eligible ordinary Members. The Team Lead path resolves
authenticated User -> active `team_lead` ActorProfile -> Member -> Team where
`Team.leadMemberId` equals the actor Member; `leadMemberId` is object-scope evidence and role
alone does not authorize another Team. Ordinary update
receives only mutable business fields and remains governed by its existing authority. The
dedicated access-link route is the only route accepting existing User/ActorProfile IDs.
When `divisionId` changes, query Teams led by the Member and active `team_members` joined to Team;
if any Team Division differs from the requested Division, return 409 before update. Ended
membership history does not itself block a move. Constraints and shared Prisma mapping are the
race backstop. Member creation never writes `team_members`; Team assignment stays a separate
Team operation. Runtime walkthrough on 2026-09-09 is blocked because app_user lacks Member write
privilege on `members`; no structural, privilege, or RLS change was applied by Codex.
