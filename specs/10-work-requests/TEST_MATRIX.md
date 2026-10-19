# Route-Based Work Request Test Matrix

Required implementation proof includes:

- Creation rejects zero intermediates; derives origin-final and Client tail; preserves duplicate Division occurrences as separate steps.
- Route amendment changes only future plan and cannot alter completed/current occurrences; concurrent amendment/forward is safe.
- Teams are sequential/frozen after start; repeated Division creates a fresh cycle; Members are sequential and later append does not rewrite completed history.
- Direct Member A→D, Team A→C, and Division B→D revisions return directly to requester; repeated rounds work; only committed cross-Division revision advances formal revision.
- Communication validates the relationship matrix, continuous canonical pair history, multi-recipient private fan-out, pair privacy, immutable messages/attachments, and former-participant read/no-send behavior.
- Main and internal projections are isolated; available actions are route/cycle/responsibility-aware and never name/role-derived.
- Originating Division is the C1 gateway; Client revision returns there; one-time reconsideration accepts/denies correctly; C1 exact package versions remain pinned.
- C3 still requires all current-cycle Bid Work Requests `ACCEPTED`; Bid/Project ownership and C3 conversion remain unchanged.
- Tenant/RLS, cross-resource scope, request-id replay, serializable races, uniqueness/ordering, append-only protections, and historical cutover compatibility are proven.
