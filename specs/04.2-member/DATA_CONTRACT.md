# Data Contract: 04.2 — Member

## Tables and fields

`members` / `Member`: Tenant ID, UUID ID, nullable `userId`, Company ID, Division ID,
`name varchar(160)`, `email varchar(255)`, `roleTitle varchar(140)`, retained `isActive`, and
timestamps. It has unique `(id,tenantId)` and `(tenantId,email)`, plus Division and Company
indexes. Its Division relation is the authoritative composite
`(divisionId,tenantId,companyId) -> divisions(id,tenantId,companyId)` relationship. `userId`
is a nullable current relation to User, not an authentication field and not declared unique;
the spec therefore does not invent a one-to-one cardinality.

## Relations and deletion audit

Member relates to optional `User`, `ActorProfile` by `(memberId,tenantId)`, Teams it leads,
`team_members`, WorkRequestAssignments, WorkflowInfoRequests as requested/target Member, and
WorkRequestRevisionRequests as requested-to Member. Before a hard delete, probe each inverse
relation in the scoped UnitOfWork. Any row blocks deletion with 409. Do not rely on ActorProfile
`SetNull` to silently erase business context and do not cascade/end team membership or history.

## Access integration boundary

The schema permits an unlinked Member. The implementation sequence is deliberately explicit:

1. `POST /member` creates only the Member.
2. Module 03 creates or locates User access under its own User/password policy; this module's
   link operation can associate only an existing same-Tenant User.
3. Module 03 assigns/revokes UserRole under its existing audit/history semantics.
4. Module 03 role assignment supplies or reuses a role-only ActorProfile; this module may link
   that existing eligible profile's `memberId` to the already linked Member.

The narrow link transaction reads `users`, active `user_roles`, and `actor_profiles` through its
own repository data access without importing an Identity feature service. It changes only
`members.userId` and, when requested, `actor_profiles.memberId`; it validates Tenant equality,
User equality, profile activity, active non-revoked UserRole matching profile role, and an empty
or already-same Member target. It rejects a profile targeting another Member or a User link that
would invalidate the profile. It neither switches default profile nor grants a role. Use normal
app_user/RLS UnitOfWork, not app_relay.

## Writes and migration impact

Create derives Tenant/Company and uses an existing scoped Division; it receives name, business
email, role title, and Division ID. Ordinary update receives only mutable business fields. The
dedicated access-link route is the only route accepting existing User/ActorProfile IDs.
When `divisionId` changes, query Teams led by the Member and active `team_members` joined to Team;
if any Team Division differs from the requested Division, return 409 before update. Ended
membership history does not itself block a move. Constraints and shared Prisma mapping are the
race backstop. No structural, privilege, or RLS change is proposed.
