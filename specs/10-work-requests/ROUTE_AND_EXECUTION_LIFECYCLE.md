# Route & Execution Lifecycle

## Main route

At creation, an authenticated active internal ActorProfile with explicit compatible `CREATE_WORK_REQUEST` and same-Company parent access selects an active Originating Division and supplies an ordered `intermediateDivisionIds` list with at least one existing, active, same-Tenant Division. A creator who actively leads the Originating Division may let the server bind that exact DivisionLead responsibility; another authorized business creator supplies the exact active `responsibleOriginatingDivisionLeadId` for that Division. The system validates and persists that exact responsibility, permits repeated IDs, and derives two immutable tail occurrences: `ORIGIN_FINAL_REVIEW` for the originating Division and `CLIENT`. Neither tail is supplied by the client. Company-wide business visibility or creation permission never grants execution authority, and another Lead of that Division does not inherit route authority.

Each route occurrence has stable identity, route version, ordinal, Division reference where applicable, kind (`ORIGIN_START`, `INTERMEDIATE`, `ORIGIN_FINAL_REVIEW`, `CLIENT`), and immutable activation/completion history. Normal forward is derived exclusively from the active route occurrence and its next occurrence in the approved route version. It cannot select an arbitrary Division.

## Amendments

An amendment is available only to the exact bound Responsible Originating Division Lead and is an append-only route version linked to its predecessor and actor/event metadata. It carries a new ordered plan for only unstarted future intermediate occurrences, then derives its own origin-final/client tail. Completed occurrences and the active occurrence are copied as immutable historical context, never changed or deleted. Optimistic base-version comparison plus serializable write prevents competing amendments. A responsibility transfer is a separate auditable fact and never an amendment side effect.

## Division, Team, and Member execution

Activating a Division route occurrence creates exactly one Division execution cycle for that occurrence. Repeated Division occurrences create new cycles even when the same Division ID appears again.

Before an active Division cycle begins Team work, its exact Division Lead defines a complete, ordered Team sequence. Team steps have stable ID, ordinal, Team, lifecycle facts, and one active step. Once the sequence starts it is frozen; no additional Team may be appended. Teams complete sequentially.

Before an active Team begins Member work, its exact Team Lead defines ordered Member steps. A Member step has stable ID, ordinal, Member, lifecycle facts, and one active step. The Team Lead may append a new unstarted Member step during the active Team cycle; completed steps are immutable and order is never rewritten. A Member submits only their active step. The final Member submits to Team Lead; the Team Lead completes that Team before the next Team starts. Completing final Team returns control to the Division cycle; completing final Division permits normal main-route forward.

## Derived position and events

Persist append-only lifecycle events for creation, amendment, activation, sequence definition, Member append, submit, Team completion, Division completion, forward, and pause/resume. Derive main route position, active cycle, active Team step, active Member step, and permitted actions from the latest valid facts plus no-open-revision rule. Mutable performance projections are permitted only if transactionally derived from those facts.

## Internal Division Workflow (derived projection)

The ordered Team sequence is the sole source of truth for the independent Internal Division Workflow. On successful save of an active Division cycle's existing Team sequence, the system automatically derives a Division-level projection with automatic boundaries: `Division Start -> TeamStep 1 -> ... -> TeamStep N -> Division Return`. The Division Lead selects Teams only; neither Division boundary is selectable, persisted as caller input, or created through a separate workflow builder, modal, action, or second sequence.

This is a Division-level visualization/execution projection of existing responsibility, not a Main Workflow route extension and not a second execution engine. It does not append to, replace, route through, or alter Main Workflow steps, Division forward behavior, route progression, Client stage, or Main Workflow state transitions. Main Workflow remains exactly its existing route occurrence lifecycle; each Division cycle independently derives its own Internal Workflow from its own Team sequence.

The state of the projection is derived from existing Division-cycle/Team-step responsibility facts. With `Team A -> Team B -> Team C`, while Team A is active, Division Start is completed, Team A is current, later Teams and Division Return are upcoming. When Team A completes, Team B becomes current. Once the final Team completes, all Team nodes are completed and Division Return is current, representing responsibility returned to the Division. Member sequences remain nested inside their Team; they are never flattened into the Division-level projection.

If a valid future business flow changes an authoritative Team sequence before its existing freeze rules prohibit that change, the projection reflects that sequence and nothing else. Revisions may temporarily move responsibility under their preserved requester/source/resume rules, but never mutate the normal Internal Workflow Team sequence or its derived normal projection.
