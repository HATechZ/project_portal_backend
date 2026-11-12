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

## Archive and restore future implementation matrix

- An actor with the dedicated compatible archive permission and existing tenant/scope/resource authorization can archive an eligible active or in-progress Work Request; an unrelated, cross-tenant, or permissionless actor cannot archive it.
- Archive records exactly one `WORK_REQUEST_ARCHIVED` audit event with request, actor, timestamp, optional reason, and preserved workflow-state snapshot; it never deletes or rewrites existing events/history.
- The default list excludes archived requests; `lifecycle=archived` and `lifecycle=all` return only records already visible to the caller and do not change the list response shape.
- Authorized detail, Main route/history, Internal Workflow projection, audit trail, documents, document versions/preview/download, revision history, Request Info history/attachments, and permitted historical conversations remain readable after archive; unrelated actors remain denied.
- An archived request rejects Member submit, Team completion, Division forward, Team/Member sequence definition, Member append, route amendment, revision request/resubmit, Request Info create/reply, communication mutation, client workflow mutation, document upload/versioning, and every other normal execution mutation before any write.
- Archive preserves the exact Main Workflow route steps/order/current Division/current responsibility/Client stage/route occurrence history and the exact Internal Workflow Team sequence, TeamStep ordering, automatic boundary projection, and Member execution sequence.
- Restore requires the dedicated compatible restore permission plus the ordinary tenant/scope/resource checks; an unauthorized actor cannot restore.
- Restore makes the request active in the default scoped list and resumes the exact preserved workflow state/responsibility without duplicating or recreating TeamSteps, MemberSteps, documents, document versions, assignments, routes, revisions, Request Info records, or history.
- Restore records exactly one `WORK_REQUEST_RESTORED` audit event and leaves all earlier audit events unchanged.
- Main Workflow regression, Internal Workflow regression, existing API flows, dashboard behavior, and all existing frontend modals (Team Sequence, Member Sequence, Append Member, Member Submit, Revision, Request Info, Document Upload, Client Decision) remain unaffected; future UI work adds only dedicated archive/restore controls.

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
