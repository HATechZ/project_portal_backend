This migration is prepared only; it has not been applied by the agent.

It is additive and does not backfill or modify existing revision, Member-step,
event, or document history. Before any revision resubmission uses these records,
an owner can roll back in one transaction by dropping the two RLS policies, the
two immutability triggers, both tables, and the two indexes (the table drops
remove their dependent constraints). Restore the preceding runtime at the same
time. After any submission record is written, retain it as audit history and use
a separately reviewed forward migration; do not delete a correction record.
