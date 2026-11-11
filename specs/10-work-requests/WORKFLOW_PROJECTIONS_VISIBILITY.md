# Workflow Projections & Visibility

The main projection displays route occurrences and handoffs only: Originating Division, intermediate occurrences, Originating final review, and Client. It never exposes Team-by-Team or Member-by-Member detail.

The internal projection displays only to authorized related actors: Division cycle, Team and Member sequences, submission/completion facts, revisions, authorized communication entry points, and audit history. It must not leak hidden Team/member steps through labels, counts, route progress, search, or available actions.

Read/write checks apply the module authorization equation and exact context: bound Responsible Originating Division Lead where originating authority applies, active route occurrence/cycle, active Team step, active Member step, active revision requester/source, or established conversation participant. Historical pair conversation visibility is the narrow exception: an ended participant may read their own stored pair conversation only, never use it to infer current route/internal access or send a message.

`GET available-actions` is backend-derived. Conceptual actions include define Team/member sequence, append Member, submit Member, complete Team, forward, each revision class, communicate, Originating final review, C1 package submit, Client decisions, and reconsideration. It reuses existing generic permissions when semantically correct; a catalogue audit may add only the smallest necessary generic permission. It returns no action merely because a caller shares a Tenant, name, role, or status label.

## Internal Division Workflow visibility

Internal Division Workflow is a separate Division-level projection derived from the existing ordered Team sequence: automatic Division Start, the ordered Team steps, and automatic Division Return. It is not merged with the Main Workflow and does not share Main Workflow business or execution logic. Reusing a visual component is presentation reuse only.

An authorized Division-level responsible actor continues to see the existing Main Workflow in the same location, with identical data, design, and behavior. That actor may additionally see the authorized Internal Division Workflow in a separate section of the same Work Request page.

A valid Team-level responsible actor and a valid Member within the authorized Division must not see the Main Workflow. In the workflow location where that actor previously saw it, the frontend displays only the authorized Internal Division Workflow; it may reuse the Main Workflow visual style while using Internal Workflow data. It must not receive or infer cross-Division route information, Main Workflow occurrences/progress, or Client-stage information.

The backend, not frontend hiding, enforces these reads. Authorization is explicit permission + tenant + compatible scope + Work Request relationship + assignment/responsibility + workflow state, never a hardcoded organizational role name. An unrelated Division actor has no access to another Division's Internal Workflow, and a cross-tenant actor has no access. The system-defined `tenant_super_admin` exception does not convert custom organizational roles into predefined roles or bypass the contracted workflow-context checks.

**Non-regression:** Internal Division Workflow must not change the existing Main Workflow execution, endpoint/data, route occurrences, lifecycle, Division forward logic, or Division Lead Main Workflow component behavior.
