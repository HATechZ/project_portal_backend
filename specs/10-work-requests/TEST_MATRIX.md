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

## Internal Division Workflow future implementation matrix

- Given authoritative Team Sequence `Team A -> Team B -> Team C`, the derived Internal Division Workflow is exactly `Division -> Team A -> Team B -> Team C -> Division`.
- Division start and return nodes are automatic; the Division Lead submits Teams only. No separate Internal Workflow creation action, builder, modal, or second Team Sequence exists.
- Successful save of the existing Team Sequence automatically makes the derived projection available without an additional frontend action. A valid future update of that authoritative sequence is reflected by the projection under existing sequence lifecycle/freeze rules.
- A Division-level responsible actor receives the existing Main Workflow unchanged in its existing location and may additionally receive its own Internal Division Workflow in a separate section.
- A valid Team Lead receives no Main Workflow data and does receive only its authorized Internal Division Workflow in the workflow area.
- A valid Member receives no Main Workflow data and does receive only its authorized Internal Division Workflow in the workflow area.
- An unrelated Division actor cannot read or infer another Division's Internal Workflow; a cross-tenant actor cannot read it.
- Team-step lifecycle facts map deterministically to projection node state: active Team is current, prior Teams and Division Start are completed, later Teams/Division Return are upcoming; final Team completion makes Division Return current.
- Member execution remains nested under its Team and never appears as top-level Division Internal Workflow nodes.
- Revision/resubmit behavior, including Member, Team, Division, and Client-to-Origin-Start revision, does not mutate the normal authoritative Team Sequence or normal Internal Workflow projection.
- Main Workflow regression: adding the Internal Division Workflow does not change Main Workflow endpoint/data, route occurrences, lifecycle, Division forward behavior, route progression, Client stage, state transitions, or Division Lead presentation/behavior.
- A same-tenant, resource-authorized `tenant_super_admin` receives `workflowVisibility: { canViewMainWorkflow: true, canViewInternalWorkflow: true }`, sees the existing Main Workflow unchanged, and can read an available Internal Division Workflow.
- If multiple Internal Division Workflows are legitimately available within that Work Request/tenant context, the contract does not artificially restrict `tenant_super_admin` to one unrelated fixed Division; another tenant's workflows remain unavailable.
- `tenant_super_admin` visibility metadata grants no new resource access or global business-relationship bypass. Team Lead and Member remain Main false/Internal true; Division-level responsible actor remains Main true/Internal true.
