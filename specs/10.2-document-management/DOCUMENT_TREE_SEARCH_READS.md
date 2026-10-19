# Logical Tree, Search, Preview & Download

## Logical tree (storage-independent)

`ROOT → BID_GROUP|PROJECT_GROUP → BID|PROJECT → DOCUMENT_CODE → DATE → FILE` is a metadata query tree, never `./uploads` or S3 paths. Groups display `Bids / Proposals` and `Projects Portfolio`. Bid root label is `<biddingNumber> - <client label> - <bid name>`; Project root is `<projectCode> - <client label> - <project name>` (use existing projectCode, no duplicate identifier). Labels are presentation only.

Code node label is `<code> <name>` from the canonical configured code snapshot/current code; illustrative configured labels include `000 Info`, `011 Action Log`, and `001 Project Information`. They are examples only, never universal hardcoded folders. Sort is `sortOrder, code, id`. A code node is unique per parent/code. Only active configured codes with visible documents appear; deactivated referenced codes retain their historical snapshot node. Empty projected folders are not returned. Date node uses version `uploadedAt` finalization time in Tenant-configured timezone (UTC fallback), formatted `DD-MM-YYYY`; filenames never determine it. Sort roots/code/date/files deterministically: labels/code ascending, date descending, then `uploadedAt ASC, versionId ASC` for files.

Nodes carry opaque node ID, type, label, parent ID, `hasChildren`, visible-item count, and safe version/file summary. `GET` children is lazy and paginated; inaccessible documents never affect node existence/count/date/file metadata.

## Search and reads

Search is database metadata only, never recursive physical storage scan. Tenant-scoped filters: parent kind/id/code/name, Work Request, document code/name, generated/original/uploaded name, date range, revisionCode, versionNumber, MIME, uploader, and latest/exact mode. Empty query requires a bounded parent/filter; pagination is cursor-based, deterministic `uploadedAt DESC, versionId DESC`; case-insensitive normalized partial matching applies to names, exact matching to IDs/codes. Results expose safe metadata only and use the same visibility predicate as direct reads.

Preview/download require exact version ID. Internal: `VIEW_DOCUMENT` + tenant + visible parent + required relationship. External Client/ClientContact: only exact Client-linked C1 package versions in authorized external context. Preview only supported safe MIME types; unsupported types return metadata/download availability. LOCAL streams through authorized backend; S3 later uses short-lived authorized presign or proxy. Content-Disposition download uses immutable `generatedFileName` (fallback safe uploaded name only where historical generated name is null), declared MIME, and no key/path/public URL. Missing/corrupt/integrity-failed objects return safe unavailable errors and audit material attempted access where repository policy requires.

## Required proof

Naming, alphabetic/numeric context isolation, version concurrency/immutability, exact C1/C2/10.1 links, tree lazy/hidden counts, search tenant/visibility/pagination, exact-version preview/download, external package-only access, missing/corrupt objects, and identical local/future-S3 logical results must be tested.
