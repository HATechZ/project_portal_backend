# Workflow Projections & Visibility

The main projection displays route occurrences and handoffs only: Originating Division, intermediate occurrences, Originating final review, and Client. It never exposes Team-by-Team or Member-by-Member detail.

The internal projection displays only to authorized related actors: Division cycle, Team and Member sequences, submission/completion facts, revisions, authorized communication entry points, and audit history. It must not leak hidden Team/member steps through labels, counts, route progress, search, or available actions.

Read/write checks apply the module authorization equation and exact context: bound Responsible Originating Division Lead where originating authority applies, active route occurrence/cycle, active Team step, active Member step, active revision requester/source, or established conversation participant. Historical pair conversation visibility is the narrow exception: an ended participant may read their own stored pair conversation only, never use it to infer current route/internal access or send a message.

`GET available-actions` is backend-derived. Conceptual actions include define Team/member sequence, append Member, submit Member, complete Team, forward, each revision class, communicate, Originating final review, C1 package submit, Client decisions, and reconsideration. It reuses existing generic permissions when semantically correct; a catalogue audit may add only the smallest necessary generic permission. It returns no action merely because a caller shares a Tenant, name, role, or status label.
