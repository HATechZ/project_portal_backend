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

## Authorized Internal Division Workflow discovery future matrix

- With execution currently in Project Management, an authorized originating Marketing Division actor receives Main Workflow visibility plus the Marketing Division Internal Workflow through authorized cycle discovery, and cannot discover or read the Project Management Internal Workflow unless independently authorized.
- A current Project Management Division actor receives Main Workflow visibility plus the Project Management Division Internal Workflow through authorized cycle discovery.
- Another authorized participating Engineering Division actor receives Main Workflow visibility plus only the Engineering Division Internal Workflow through authorized cycle discovery.
- A Team-level actor receives Main false and only the actor's authorized own-Division Internal Workflow; a participating Member follows the same internal-only presentation rule.
- A same-tenant, resource-authorized `tenant_super_admin` receives Main true plus every separately authorized Internal Division Workflow returned by discovery; the contract supports multiple cycles without a fixed Division assumption and never crosses Tenant boundaries.
- An authorized Division actor's completed prior own-Division cycle remains discoverable/readable as a historical projection after responsibility advances; its persisted completed/current/upcoming states imply no execution permission.
- Discovery and selected-cycle reads do not leak another Division's cycle ID, labels, counts, steps, historical state, or projection to an unauthorized actor; unrelated and cross-tenant actors receive neither projection.
- Main Workflow visibility remains exclusively Main Route `workflowVisibility.canViewMainWorkflow`; frontend does not infer Internal Workflow cycle IDs from Main Route's current projection, and an expected cross-Division Internal Cycle 403 never hides Main Workflow.
- Main Workflow execution and projection regressions remain unchanged, and Internal Workflow authorization remains Division-context-specific.

## Main Route and Internal Cycle presentation-contract future matrix

- An originating responsible actor whose `GET /:id/route` read is authorized receives `workflowVisibility.canViewMainWorkflow = true`, even after the active route occurrence moves to another Division.
- That originating actor discovers the actor's own authorized Internal Workflow cycle independently. A 403 from another Division's `GET /:id/internal-cycles/:cycleId` does not imply Main false, does not hide Main Workflow conceptually, and does not broaden Internal Cycle access.
- A current Division-level responsible actor receives Main Route `canViewMainWorkflow = true` and discovers the actor's own authorized Internal Workflow cycle.
- A Team-level internal actor and a participating Member receive Main Route `canViewMainWorkflow = false` while discovering an Internal Workflow only through their valid own Division/Team/Member context.
- A same-tenant, resource-authorized `tenant_super_admin` receives Main Route `canViewMainWorkflow = true`; Internal Workflow remains available only through separately authorized cycle reads. No cross-tenant actor receives either projection.
- The Main Route visibility signal is authoritative for Main Workflow presentation; Internal Cycle availability/403 is authoritative only for Internal Workflow presentation. Frontend omits an expected unauthorized Internal Workflow without rendering an error card or hiding Main Workflow.
- Main Workflow execution/route occurrence/projection regression remains unchanged, and Internal Workflow authorization remains unchanged.

## Sequential Team Lead submission — future acceptance tests

- In Team A's ordered multiple-Member flow, Member A submission activates Member B; the last Member submission returns responsibility to Team A Lead, keeps Team A current, and leaves Team B upcoming. No Member submission activates a Team or forwards a Division.
- Team A's responsible Lead invokes `COMPLETE_TEAM_STEP`: Team A completes, only Team B activates, and responsibility transfers to Team B Lead. The Team A Lead has no further execution action on the completed step. Only one TeamStep is current throughout.
- Team B Lead independently manages Team B's own ordered Members, without reusing Team A's sequence. Team B's last Member returns responsibility to Team B Lead and leaves Team B current until explicit Team completion.
- When Team B is last, its Lead's `COMPLETE_TEAM_STEP` completes Team B and makes Division End current; the next Main Division is not activated. The responsible Division-level actor then reviews and separately forwards, completing the Division route occurrence and activating the next approved Main Route occurrence.
- An active Team with no Member sequence gives its responsible Lead `COMPLETE_TEAM_STEP` directly; no fake Member is required. An appended legitimate end Member executes before Team Lead return and completion.
- Reject Team completion by an actor without the exact current Team responsibility or another required permission, tenant, scope, relationship, assignment, or state predicate; reject Division Forward without the corresponding current Division responsibility and prerequisites. Do not authorize by custom role name.
- Revision does not alter normal Team or Member sequences; Request Info, document/version links, and Main Workflow route order remain unchanged. Existing revision and archive action restrictions continue to apply.
- With no Team sequence, preserve the two Division boundary nodes and direct Division-level handling without synthetic TeamSteps.

## Completed Member participation — future acceptance tests

- Member A's current step gives authorized Work Request list/dashboard and detail visibility and the Member submit action. After A submits to Member B, B becomes current, A loses submit, and A retains the list/dashboard entry and detail read.
- After submission, A can discover and read the authorized own-Division Internal Workflow without Main Workflow visibility. Subsequent Team Lead return, Team completion, next-Team activation, and Division forward do not remove A's authorized historical Work Request or own-cycle reads; all completed Team Members retain their respective relationships.
- Eligible completed Member A retains Request Info access under the existing recipient matrix and reciprocal-pair rules. When current Member B sends an eligible Request Info to A, A can open the Work Request and addressed thread, read it, and respond while the request is open and the Work Request permits mutation.
- A completed Member never regains Member submit, Team completion, or Division Forward from historical participation; a later revision uses its existing separate assignment and authorization. Existing allowed document/version and history reads remain subject to their existing scope and exact resource relationships.
- An unrelated Member and a cross-tenant Member receive no Work Request list/detail, Internal Workflow, execution action, or Request Info access through this rule. Existing Request Info recipient matrix, Member Main Workflow denial, and own-Division visibility boundary remain unchanged.
- An authorized completed Member retains permitted archived reads under the existing archive filter and authorization; archived Request Info create/reply and other normal execution mutations remain blocked.

## Historical Team and Division responsibility — future acceptance tests

- A completed Member retains the previously approved list/detail and own Internal Workflow access without regaining submit.
- When Team A Lead completes Team A and Team B becomes current, Team A Lead retains authorized list/detail and own-Division Internal Workflow reads and eligible Request Info; Team A's `COMPLETE_TEAM_STEP` disappears. Team B gains only its existing current responsibility.
- The prior Team Lead retains authorized access after the last Team completes, responsibility returns to Division Lead, and Division Forward advances the Main Workflow. A legitimately participating prior Division-level actor retains authorized Division read/history after forward, without obsolete execution actions.
- A historical participant cannot execute a completed step or forward merely because historical read access exists. Existing revision, archive, and current-responsibility gates remain enforced.
- An unrelated same-tenant actor with the same permission but no persisted actor-to-Work-Request relationship, an actor outside compatible resource scope, and a cross-tenant actor remain denied. A current Team/Division title or permission alone does not establish historical responsibility.
- Existing Request Info recipient matrix, addressed-thread reciprocity and lifecycle rules remain unchanged; eligible former participants can read/reply only where those rules permit. Existing Main/Internal Workflow presentation and cross-Division isolation remain unchanged.

## Proposed responsibility-history persistence — future tests

- Activation transaction records the exact TeamStep actor and the exact DivisionCycle actor for origin, intermediate and final-review contexts; return records only genuinely assigned Division responsibility. Rollback, idempotent retry and concurrent transfer never leave duplicate open records or partial handoffs.
- Completing a Team or forwarding a Division preserves the former responsible actor's authorized Work Request list/detail and own Internal Workflow/history access, but removes obsolete Team completion or Division Forward actions. Team B activation and last-Team completion do not erase Team A Lead history.
- Leadership changes preserve original actor/context history, close and add intervals atomically where applicable, and do not grant historical access merely to a newly appointed or unrelated Lead. Simultaneous valid Division Leads and later reassignment remain possible.
- Conservative, idempotent backfill accepts only conclusive tenant-qualified actor/context evidence; ambiguous events and current titles do not fabricate history or interval boundaries. Point-only evidence cannot assert current responsibility.
- Tenant-qualified foreign keys, request/route/cycle/step ownership, actor/Member consistency, context shape, ordering, duplicate protection, RLS and least grants reject cross-tenant or mismatched records; unrelated or permission-only actors remain denied.
- Existing MemberStep retention, Main/Internal execution and presentation, Request Info recipient matrix and pair rules, revision, document/version access, and archive/restore behavior remain unchanged. Archived history remains readable only under existing archive/read authorization and normal mutations remain blocked.

## Same-transaction responsibility history — future integration tests

- Team assignment/activation and exact-actor history commit together. A forced business rollback removes history, and a forced history insert/close failure rolls back the Team mutation; test initial activation, Team replacement/clear, next-Team activation and completion.
- DivisionCycle activation/assignment and history commit together. Forced rollback or history failure leaves neither a partial Division mutation nor a history fact; exercise origin, intermediate, multiple simultaneous Division Leads, supported replacement/revoke and forward.
- Final-Team completion and a genuinely established Division-return actor commit atomically; no actor or cycle is invented when the existing transition does not assign one. Final Review re-entry records a new period only for an established actor and actual occurrence.
- Repeated operation after commit, after closure, and concurrent assignment/replacement produce no duplicated interval or conflicting open Team responsibility; concurrent valid Division Leads remain allowed. Races lock/revalidate source and context and retry serializable failures safely.
- Failed or delayed post-commit outbox delivery does not alter committed authorization history correctness. Current execution behavior/actions and Main/Internal Workflow projections remain unchanged.
- Against a disposable RLS-enabled database, cross-tenant reads/writes, mismatched tenant/route/cycle/TeamStep and invalid actor/source provenance are denied; normal tenant-scoped transactions, least grants, immutable history and one-time close work. Ambiguous legacy and profile mappings remain unbackfilled, never guessed.

## Exact responsible ActorProfile — future acceptance tests

- One context-compatible active profile for the exact assigned Member/User is selected and recorded for a TeamStep and a DivisionCycle; with multiple profiles, only one matching the required tenant, grant, compatible scope and exact Team/Division context is selected.
- Two equally compatible profiles, no compatible profile, an unrelated Team/scope, permission-only profile, revoked grant or cross-tenant profile cause fail-closed assignment/activation; no first/default/oldest profile is chosen. The future conflict response is explicitly tested without changing Team sequence, handoff or forward ordering.
- Automatic next-Team/Division and final-review activation resolve the assigned person's exact profile rather than the actor performing the previous transition; multiple legitimate Division Leads resolve independently. Unordered multiple Team grants do not serve as an arbitrary disambiguator.
- Writer records the exact ActorProfile/Member/User snapshots, tenant, Work Request, cycle/TeamStep, provenance and stable retry key atomically. Same-key same-identity retry is idempotent; changed identity/context fails and concurrent assignments cannot manufacture duplicate/conflicting responsibility.
- Role, Team, Division, default-profile and active-profile changes do not rewrite historical evidence. A profile/user/member rebind cannot transfer historical access; inactive or unauthorized current actors cannot use preserved proof to bypass authentication or permission. A different current profile receives no continuity grant without a separate approved rule.
- Existing execution guards, workflow ordering and Main/Internal presentation, Member participation, Request Info recipient matrix, revision, documents and archive semantics remain unchanged; live tenant RLS, identity locks and rollback behavior are verified on a separately authorized disposable database.
