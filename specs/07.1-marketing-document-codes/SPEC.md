# SPEC: 07.1 — Marketing Document Codes

**Status:** WIP — Gate 4. Marketing Document Code is an independent tenant master-data module, not an alias of General Document Code.

It owns Marketing records explicitly; ownership is never inferred from a code's numeric value. Initial starter data is `801 | 수주통보서`, `802 | Contract`, `803 | Invoice`. This is an extendable starter catalogue: users may add Marketing codes with any generically valid code value; no 800–899 restriction exists.

Future capabilities are list, detail, create, update, deactivate and reactivate, following current platform envelopes/tenant isolation as reference only. General's existing `802`/`803` rows are a future migration/data-ownership consideration; no data is moved by this spec.
