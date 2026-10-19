# Revision & Resume

Revision is source-based: requester pauses, actual problem source corrects, source resubmits directly to the preserved requester/resume destination, and requester resumes. No completed intermediate step is replayed merely because it lies between source and requester.

Each revision record is immutable except explicitly recorded lifecycle facts. It carries tenant/Work Request, classification, round/sequence, requester actor and exact execution context, problem-source actor/team/division and exact execution context, paused/resume destination, reason, requested/submitted/resumed event IDs/timestamps, correlation/idempotency, and optional exact submitted version references. Round allocation is serializable and unbounded.

| Classification | Valid participants | Formal-document effect |
|---|---|---|
| `INTERNAL_MEMBER` | Two participating Members in the same Team execution context | Never formal; no formal revision increment. |
| `INTERNAL_TEAM` | Leads of Teams in the same Division execution cycle | Never formal; no formal revision increment. |
| `CROSS_DIVISION_FORMAL` | Leads of relevant Division route occurrences/cycles | Advances formal document revision exactly once on committed request. |

Member and Team requesters need not use their Team/Division Lead as intermediary. A cross-Division target may be any relevant prior/problem-source route occurrence, not merely the immediately preceding occurrence. The requester remains the sole resume destination.

`formalRevisionTrigger` for 10.1 is only the committed `CROSS_DIVISION_FORMAL` revision record/event. A Client `REQUEST_REVISION` is not itself formal. The Originating Division Lead may resolve it internally without increment; if it creates a `CROSS_DIVISION_FORMAL` revision to another Division, that committed revision increments once and returns to Originating Division.

Historical revision records and corrected submissions are never edited/deleted. Concurrent request/resubmit commands use request-id uniqueness, current-context comparison, and serializable transactions so one paused context cannot be resumed twice.
