# API Contract: Engineering Document Codes

Future base route: `/api/v1/engineering-document-codes`. It owns independent list/detail/create/update/deactivate/reactivate contracts using current platform envelopes/errors as reference. Generic normalized code, nonblank name and optional description are expected; code number does not decide eligibility or ownership. Authorization temporarily reuses `MANAGE_GENERAL_DOCUMENT_CODES` through the current pattern.
