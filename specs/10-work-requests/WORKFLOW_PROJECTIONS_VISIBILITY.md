# Workflow Projections & Visibility

The main projection displays route occurrences and handoffs only: Originating Division, intermediate occurrences, Originating final review, and Client. It never exposes Team-by-Team or Member-by-Member detail. Its actor-specific presentation signal is `GET /work-requests/:id/route` → `workflowVisibility.canViewMainWorkflow`; Main Workflow visibility must never depend on successful access to an Internal Cycle.

The internal projection displays only to authorized related actors: Division cycle, Team and Member sequences, submission/completion facts, revisions, authorized communication entry points, and audit history. `GET /work-requests/:id/internal-cycles` is the actor-specific discovery read for these projections; it returns only cycle IDs and safe projections authorized for that caller, not every cycle in the Main Route. It must not leak hidden Team/member steps through labels, counts, route progress, search, or available actions.

Read and execution checks apply the module authorization equation to their own context. A legitimate MemberStep relationship, including a completed or earlier MemberStep, supports authorized Work Request and own-Division Internal Workflow reads after current responsibility moves; it does not grant current execution authority. Execution checks still require the exact active route occurrence/cycle, Team step, Member step, revision requester/source, or other responsible actor as applicable. Historical pair conversation visibility remains a narrower independent exception: an ended pair participant may read their own stored pair conversation only, never use that fact alone to infer current route/internal access or send a message.

Archive does not widen, reduce, or otherwise replace this read-visibility policy. An authorized actor may read an archived Work Request's existing Main Workflow route/history and authorized Internal Division Workflow projection, but receives no normal execution action while the archive overlay is active. The projections remain a faithful read-only view of the exact preserved route/cycle/TeamStep/MemberStep facts; archive/restore creates no nodes, alters no ordering, and exposes nothing to unrelated or cross-tenant actors.

`GET available-actions` is backend-derived. Conceptual actions include define Team/member sequence, append Member, submit Member, complete Team, forward, each revision class, communicate, Originating final review, C1 package submit, Client decisions, and reconsideration. It reuses existing generic permissions when semantically correct; a catalogue audit may add only the smallest necessary generic permission. It returns no action merely because a caller shares a Tenant, name, role, or status label.

## Internal Division Workflow visibility

Internal Division Workflow is a separate Division-level projection derived from the existing ordered Team sequence: automatic Division Start, the ordered Team steps, and automatic Division Return. It is not merged with the Main Workflow and does not share Main Workflow business or execution logic. Reusing a visual component is presentation reuse only.

An authorized originating responsible actor retains Main Workflow presentation after route responsibility moves to another Division, when Main Route authorization remains valid. Every authorized participating Division-level actor—originating, current, or another participating Division—sees Main Workflow plus that actor's own authorized Division Internal Workflow cycle or cycles in a separate section. Discovery is not limited to the current Main Route `divisionCycleId`: a completed prior own-Division cycle remains readable as historical projection, while another Division's current cycle remains unavailable unless independently authorized. Neither actor needs another Division's Internal Cycle access to establish Main Workflow visibility.

`tenant_super_admin` is the sole predefined/system role. When it is same-tenant and the Work Request is otherwise route-readable, Main Route returns `{ workflowVisibility: { canViewMainWorkflow: true } }`. An Internal Cycle remains separately authorized; when available its existing metadata may report `{ canViewMainWorkflow: true, canViewInternalWorkflow: true }`. This does not create a global business-relationship bypass: tenant, Work Request, compatible resource, and existing data-availability checks remain mandatory. If multiple Internal Division Workflow projections are legitimately available for that Work Request/tenant, the backend may expose those available projections additively; the frontend may offer them without changing Main Workflow behavior.

A valid Team-level responsible actor and a valid Member within the authorized Division must not see the Main Workflow. In the workflow location where that actor previously saw it, the frontend displays only the actor's authorized own-Division Internal Workflow; it may reuse the Main Workflow visual style while using Internal Workflow data. It must not receive or infer cross-Division route information, Main Workflow occurrences/progress, or Client-stage information.

The backend, not frontend hiding, enforces these reads. Authorization is explicit permission + tenant + compatible scope + Work Request relationship + assignment/responsibility + workflow state, never a hardcoded organizational role name. An unrelated Division actor has no access to another Division's Internal Workflow, and a cross-tenant actor has no access. The system-defined `tenant_super_admin` exception does not convert custom organizational roles into predefined roles or bypass the contracted workflow-context checks.

**Non-regression:** Internal Division Workflow must not change the existing Main Workflow execution, endpoint/data, route occurrences, lifecycle, Division forward logic, or Division Lead Main Workflow component behavior.

| Actor context | Main Workflow | Internal Workflow |
|---|---:|---:|
| Originating Division actor | YES | own Division |
| Current Division actor | YES | own Division |
| Other authorized participating Division actor | YES | own Division |
| `tenant_super_admin` (same-tenant, resource-authorized) | YES | authorized Division workflow(s) |
| Team-level responsible actor | NO | own Division |
| Participating Member | NO | own Division |
| Unrelated actor | NO | NO |
| Cross-tenant actor | NO | NO |

Frontend renders Main Workflow only from the authoritative Main Route `workflowVisibility.canViewMainWorkflow`; it must not infer this from a role name or from an Internal Cycle response. It renders Internal Workflow only from the actor-authorized `GET /:id/internal-cycles` discovery result and independently authorized selected-cycle availability. It must not guess an actor's cycle ID from Main Route's current projection. If a non-discovered cycle returns 403 because the actor is unrelated to that Division, frontend omits that Internal Workflow without an error card and leaves any authorized Main Workflow visible. A Team-level actor or Member remains internal-only when Main Route returns false and discovery returns that actor's authorized Internal Workflow.

### Sequential execution projection

For `Division Start → Team A → Team B → Division End`, while Team A executes and while its Lead awaits `COMPLETE_TEAM_STEP` after the final Member submits, the states are `completed → current → upcoming → upcoming`. Team A Lead completion changes them to `completed → completed → current → upcoming`; Team B's final Member submission leaves that state unchanged until Team B Lead completes it. The final Team completion changes them to `completed → completed → completed → current`. Division Forward then makes Division End completed and advances the Main Workflow. Only one TeamStep is current at a time. Each Team's Member sequence is independent, and Team completion does not itself forward the Division. With no Teams, retain both Division boundary nodes and derive their states from Division responsibility and the existing route lifecycle.

### Member participation after submission

Execution responsibility and Work Request participation are separate. A legitimate MemberStep assigned to the Member remains evidence of participation when the step is submitted, completed, no longer current, or earlier in the sequence. Subject to the existing permission, tenant, compatible scope, and actual Work Request resource relationship, an authorized participating Member retains the Work Request list/dashboard entry, detail read, and own authorized Division Internal Workflow after Member handoff, Team completion, and Division forward. Current execution in that MemberStep, Team, or Division is not required for these reads. Do not expose another Division's Internal Workflow or Main Workflow to the Member.

Submission removes the completed Member's `SUBMIT_MEMBER_STEP` and grants neither Team Lead nor Division Forward actions. `REQUEST_WORKFLOW_INFO`, Request Info history, and a response to an addressed open request remain available only when the existing eligibility, recipient, reciprocity, and lifecycle rules permit them; this does not widen the recipient matrix. A later Member may request information from an eligible completed Member under the existing Team relationship rules, and that addressed Member may read and respond to the open thread. Permitted documents, exact document versions, status and history remain governed by their existing read authorization. Revision does not confer execution authority through participation alone. Archive remains governed by its existing read-only contract and blocks normal mutations, including Request Info create/reply, while archived.

| Actor state | Work Request read | Dashboard/list | Own Internal Workflow | Member Submit | Request Info |
|---|---|---|---|---|---|
| Current Member | YES | YES | YES | YES | YES when eligible |
| Completed Member | YES | YES | YES | NO | YES when eligible |
| Later Member current | YES | YES | YES | YES | YES when eligible |
| Team Lead current | YES | YES | YES | N/A | YES when eligible |
| Unrelated Member | NO | NO | NO | NO | NO |
| Cross-tenant Member | NO | NO | NO | NO | NO |

YES entries assume the actor satisfies the applicable permission, tenant, scope, resource and lifecycle predicates; Member Submit additionally requires the active assigned MemberStep and all existing execution guards. An archived Work Request follows the existing archived-list filter and read-only restrictions. Historical participation is not a tenant-wide or unrelated Work Request grant.

### Historical Team and Division participants

Conceptually, `hasCurrentExecutionResponsibility` governs executable actions, while `hasHistoricalWorkRequestParticipation` governs continued eligible reads and collaboration. Neither replaces permission, same-tenant, compatible-scope, actual resource relationship, or the relevant lifecycle checks. The latter requires a persisted legitimate relationship between the exact actor and this Work Request, such as a MemberStep, TeamStep Lead responsibility, DivisionCycle responsibility, originating Division responsibility, or another existing Work Request-specific responsibility fact. A permission or a current organizational title alone is insufficient to prove a historical responsibility.

An authorized prior Team Lead retains list/detail and independently authorized own-Division Internal Workflow access after Team completion, later Teams, Division return, and forward. A legitimately participating Division-level actor retains the previously approved Division read/history and presentation access after forward. Existing completed Member retention is preserved. No completed actor regains an obsolete execution action; Request Info and addressed replies remain available only when the unchanged recipient, reciprocity, permission, and lifecycle rules permit. Main Workflow remains hidden from Team and Member contexts; Division presentation, unrelated and cross-tenant denial, and the archive read-only overlay remain unchanged.

### Proposed persisted responsibility proof

Once separately implemented and migrated, exact actor-specific Team and Division responsibility-history facts described in `DATA_CONTRACT.md` may support Work Request list/detail, own authorized Internal Workflow and permitted document/history reads, including after handoff. Permission, tenant, compatible scope, actual resource context, and the existing archive rules still apply. Current Team/Division title and permission alone are not historical proof. MemberStep and existing originating binding remain valid independent relationship sources. Historical responsibility does not grant execution actions, new Request Info recipients, or any right to bypass existing thread, response, revision or archive rules.
