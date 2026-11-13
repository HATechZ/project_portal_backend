# Private Work Request Communication

## Scope and persistence

For new route-based Work Requests, the private pair communication channel is append-only and Work Request-scoped. It is not a workflow transition, ownership transfer, revision, ticket status, general company messaging, or realtime chat. The pair channel has no open/closed/resolved lifecycle; the separate Request Information lifecycle below retains its existing rules.

A conversation is unique by `(tenant, workRequest, canonical participant pair)`; canonical ordering makes A↔B one conversation regardless of direction. A message has immutable sender, recipient, body, sequence/time, correlation/idempotency, and immutable exact DocumentVersion attachment references. Initial multi-recipient send fans out to independent pair conversations/messages; it is never a group conversation.

Participants may read only conversations in which they are a participant. No lead gains visibility merely because a subordinate participates. A former participant retains read access to their existing pair history but cannot send after their relevant Work Request relationship ends. Different Work Requests never share a conversation.

## Private pair-channel relationship matrix

Same Tenant is insufficient. Sender and recipient must be active in the exact Work Request context when sending.

- A Team Member may communicate only with own Team Lead or participating Members of the same active Team context.
- A Team Lead may communicate with participating own-Team Members, own Division Lead, or leads of other participating Teams in the same Division cycle.
- A Division Lead may communicate with all own-Division Team Leads and Division Leads of route-connected previous/current/future planned Division occurrences. Cross-Division communication is Division Lead↔Division Lead only.

No Member may directly communicate outside own Team; no Team Lead may directly communicate outside own Division; no Division Lead may directly communicate to another Division's Team Lead/Member; unrelated route Divisions are denied.

## Request Information lifecycle

The private pair channel remains available for conversational coordination. It
does not replace the approved Work Request Information Request lifecycle.
Route-based requests use the existing `WorkRequestV1InfoRequest` / response /
attachment records for explicit requests, responses, and history. The Request
Information recipient matrix below governs its recipient discovery and create
authorization. The pair channel and Request Information remain separate: pair
communication never grants, blocks, or substitutes for Request Information
authorization. Existing valid Request Info reciprocal-pair, thread, reply,
attachment-only and lifecycle rules remain unchanged.

## Final Request Information recipient matrix

Discovery uses the full participating Work Request structure, not execution position. A Division or Team being previous, current, future, completed, or active does not by itself add or remove an eligible recipient. The caller and each recipient must satisfy the applicable same-Tenant, permission, Work Request relationship, participating route/Division/Team relationship, and persisted responsibility or assignment requirements. Current organizational title, display label, or permission alone is not historical participation evidence. Existing account/profile usability, compatible scope, lifecycle, and exact-resource checks continue to apply.

| Legitimate caller | Eligible internal recipients | Excluded from the ordinary matrix |
|---|---|---|
| Participating Division-level responsible actor, including the originating Division actor | All participating Division-level responsible actors across the full Main Workflow route, including previous, current, future and originating/final-review Division occurrences where applicable; all eligible Team Leads belonging to the caller's own Division | Ordinary Members and Team Leads from other Divisions |
| Participating Team Lead | Own Division's responsible Division-level actor; all eligible Team Leads in the same Division; all eligible Members of the caller's own Team | Other Teams' Members and actors from other Divisions |
| Participating Member | Own Team Lead and all eligible Members of the same Team | Other Teams' Leads and Members, and Division-level actors directly |

The caller is excluded and duplicate ActorProfiles are returned only once. A persisted same-Tenant, same-Work-Request Request Info pair continues to permit its exact reciprocal counterpart under the existing rules; the ordinary matrix exclusions do not erase that separate, narrowly scoped exception. The originating responsible actor retains the separately authorized usable linked ClientContact recipient rule; it does not grant unrelated Division recipients or change ClientContact eligibility.

For Division-level discovery, identify participating Divisions from the full authoritative participating Main Workflow route, including future occurrences and the originating/final-review Division where applicable. Resolve their legitimate responsible actors using existing persisted Work Request assignment and responsibility rules. Do not restrict discovery to current or completed Division cycles or activated route steps, and do not turn unrelated tenant Divisions into participants. The caller's own-Division Team Leads are resolved from the full Work Request-related Division/Team structure and existing responsibility/assignment evidence, including upcoming, current and completed Teams and Division End; do not restrict discovery to the current TeamStep. Future route or Team membership identifies a structural context, not proof of a particular person's past responsibility. Where an actor binding is absent or ambiguous, do not invent one from a present title.

A completed Member, completed or prior Team Lead, and completed or prior Division actor retain the same applicable matrix after their execution responsibility ends, based on persisted Work Request-specific MemberStep, Team/Division responsibility history, or valid originating responsibility binding as applicable. Exact actor identity and the applicable current access checks remain mandatory. `REQUEST_WORKFLOW_INFO` is a collaboration action and remains available when the caller is authorized, at least one recipient is eligible, and existing lifecycle rules permit it. Historical participation does not restore Member submission, Team completion, Division Forward, or any other execution action.
