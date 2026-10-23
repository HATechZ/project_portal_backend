# Document Naming, Revision & Version Policy

## Already implemented / preserve

`originalFileName` is first-source metadata; `uploadedFileName` is this version's safe incoming metadata; `generatedFileName` is the server official display/download filename; `storageKey` is opaque infrastructure identity. None is a lineage substitute. `versionNumber` is chronological immutable per logical document and independent from `revisionCode`, 10.1 formal revision round, and `REV-001` request code.

Current canonical Bid formatter is:
`<BiddingNumber> <ProjectCode>-<CargoCode>-<VesselCode>-<ShipmentNumber>-<DocumentCode>-<RevisionCode> <DocumentCodeName>.<original extension>`.
Example: `21128 PERSISTED-CRA-CA2-01-100-A Stowage Plan.pdf`.
Project formatter in shared contract omits Bidding Number:
`<ProjectCode>-<CargoCode>-<VesselCode>-<ShipmentNumber>-<DocumentCode>-<RevisionCode> <DocumentCodeName>.<extension>`.
Example: `SKM-CRA-CA2-01-100-01 Stowage Plan.pdf`.
Current DirectProject-backed Work Request generated-name null behavior conflicts with that target Project formatter; preserve it until 10.1 implementation aligns it—do not invent a third naming system.

Server uses canonical snapshots, NFC-normalized safe document-code/source names, uploaded extension, existing whitespace sanitization, and the current 260-character limit. Client cannot supply any canonical fragment, generated name, key, version, or revision. Historical generated names never recalculate; key/version identity resolves collisions, not filename. Existing uppercase code/revision casing is preserved. Unsafe/path separator characters are removed by existing safe-name rules.

## New next-week rules

Finalized versions are insert-only: binary/key, name, MIME/size/integrity facts, versionNumber and revisionCode never change. Corrections create another version. Pending 10.1 sessions are not finalized versions.

Bid/Proposal-context documents, including Bid-owned Work Request documents, use uppercase alphabetic revision codes. Initial is `A`; each newly finalized document version increments (`A…Z, AA, AB…`) server-side under the same serialization as version allocation. Project-context documents, including Project-owned Work Request documents, must use numeric codes, but starting value/width (`0`, `1`, `00`, etc.) is **OWNER DECISION REQUIRED**. Historical Bid versions never convert to Project format on C3 conversion.

## Exact-version resolution

C1 packages, 10.1 formal submissions, C2 attachments, preview/download, and future references store and resolve exact immutable version IDs. They never use latest, filename, document ID, or revision code as replacement. Resolver verifies tenant + owner parent + expected relationship + visibility. Newer uploads never alter historical links.

C1 final-package resolver maps each immutable item to its exact version metadata/object. Duplicate item IDs are rejected on package creation; multiple distinct items remain ordered by frozen package position. Missing/corrupt objects produce a safe unavailable result, never a latest-version fallback; unauthorized callers receive no metadata.
