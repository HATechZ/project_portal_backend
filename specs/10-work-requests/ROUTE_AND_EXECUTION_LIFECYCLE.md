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
