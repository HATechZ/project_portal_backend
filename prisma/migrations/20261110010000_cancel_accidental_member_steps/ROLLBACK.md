This migration is prepared only; no database has been changed by the agent.

Apply with the cancellation-aware runtime under a maintenance window. The schema
change and exact incident repair are atomic; a changed projection, missing target,
activated/submitted target, or revision/submission reference aborts the migration.
No MemberStep or event is deleted and no ordinal or submission is rewritten.

Rollback before any subsequent workflow activity: owner may transactionally drop
`wr_member_steps_cancellation`, drop function
`enforce_work_request_member_step_cancellation()`, drop constraint
`wr_member_step_cancelled_unused`, then drop `cancelled_at`, and restore the previous
runtime. This reinstates the diagnosed unwanted future steps, so prefer a forward
repair. After subsequent workflow activity, do not drop the cancellation fact:
retain it and prepare a separately reviewed forward correction. Never disable the
existing no-delete trigger or remove audit/submission history.
