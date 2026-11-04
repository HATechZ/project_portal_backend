# Private Work Request Communication

## Scope and persistence

For new route-based Work Requests, Request Info means append-only, Work Request-scoped private communication. It is not a workflow transition, ownership transfer, revision, ticket status, general company messaging, or realtime chat. It has no open/closed/resolved lifecycle.

A conversation is unique by `(tenant, workRequest, canonical participant pair)`; canonical ordering makes A↔B one conversation regardless of direction. A message has immutable sender, recipient, body, sequence/time, correlation/idempotency, and immutable exact DocumentVersion attachment references. Initial multi-recipient send fans out to independent pair conversations/messages; it is never a group conversation.

Participants may read only conversations in which they are a participant. No lead gains visibility merely because a subordinate participates. A former participant retains read access to their existing pair history but cannot send after their relevant Work Request relationship ends. Different Work Requests never share a conversation.

## Relationship matrix

Same Tenant is insufficient. Sender and recipient must be active in the exact Work Request context when sending.

- A Team Member may communicate only with own Team Lead or participating Members of the same active Team context.
- A Team Lead may communicate with participating own-Team Members, own Division Lead, or leads of other participating Teams in the same Division cycle.
- A Division Lead may communicate with all own-Division Team Leads and Division Leads of route-connected previous/current/future planned Division occurrences. Cross-Division communication is Division Lead↔Division Lead only.

No Member may directly communicate outside own Team; no Team Lead may directly communicate outside own Division; no Division Lead may directly communicate to another Division's Team Lead/Member; unrelated route Divisions are denied.

## Request Information lifecycle

The private pair channel remains available for conversational coordination. It
does not replace the approved Work Request Information Request lifecycle.
Route-based requests use the existing `WorkRequestV1InfoRequest` / response /
attachment records for explicit requests, responses, and history. The backend
derives eligible recipients from the exact Work Request parent and active
Division assignment and, for the active responsible originating Lead, current
and previously activated route occurrences, and verifies the requester is the active responsible
originating Lead or current assignment participant. These two features remain
separate: pair communication never grants, blocks, or substitutes for Request
Information authorization.
