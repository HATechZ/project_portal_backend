# Migration & Cutover

Existing V1 records cannot losslessly yield ordered route occurrences, origin/final tail identity, Division cycles, Team/Member sequences, source/resume revisions, or continuous private conversations. No timestamp or assignment inference is authorized.

Cutover rule: pre-redesign V1 Work Requests remain **HISTORICAL / LEGACY-LINEAR** records, retaining current events, assignments, C1/C2 data, documents, C3 cycle membership, and reads. New route-based persistence applies only to Work Requests created after the approved migration/cutover marker. No historical rows, documents, DocumentVersions, C1 package rows, C2 records, Bid cycle membership, or parent ownership may be reparented, fabricated, or deleted.

An eventual additive migration must create the route/cycle/sequence/revision/conversation/reconsideration relations with tenant-qualified FKs, RLS, least grants, required indexes, and append-only/immutability protections. It must preserve existing V1 tables and offer explicit read-model discrimination/cutover behavior. Any attempt to map old data requires a separately approved, demonstrably lossless mapping; none is currently known.
