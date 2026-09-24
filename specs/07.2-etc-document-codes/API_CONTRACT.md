# API Contract: ETC Document Codes

Future base route: `/api/v1/etc-document-codes`; independent list, detail, create, update, deactivate/reactivate operations use platform envelopes/errors. Codes are required generic strings, normalized by current convention, not range-validated. Authorization temporarily reuses `MANAGE_GENERAL_DOCUMENT_CODES` through the current pattern.
