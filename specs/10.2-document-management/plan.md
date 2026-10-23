# Plan: 10.2 — Document Management Reads

**No implementation is authorized by this plan.** Source of truth remains `SPEC.md`, API/data contracts, and upstream 10.1.

1. Confirm final-audited 10.1 parent-owned version persistence, exact-version links, and storage port before 10.2 writes any read surface.
2. Consume frozen server naming/version facts: NFC normalization, Bid alphabetic progression, Project `01` minimum-width progression, and formal rounds only from committed `CROSS_DIVISION_FORMAL`. 10.2 never allocates or rewrites them.
3. Implement a shared authorized exact-version read resolver, then use it for C1/C2/10.1 references, metadata, tree, search, preview, and download.
4. Implement database-backed logical tree projections and cursor search from canonical metadata; never infer from local/S3 paths.
5. Implement preview/download as provider-neutral exact-version reads: LOCAL controlled stream first; S3 presign/proxy only through the 10.1 port.
6. Prove tenant/parent/external package visibility, immutable links, no node/count leakage, naming/revision/version concurrency, local backward compatibility, and provider-invariant logical behavior.

S3 is a later provider implementation, not a prerequisite for logical tree/search contracts. No reparenting occurs at Bid → DirectProject conversion.
