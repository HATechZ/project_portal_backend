# API Contract: Marketing Document Codes

Future base route: `/api/v1/marketing-document-codes`. It is its own API surface. Expected operations are list (`status=active|inactive|all`), detail, create, update, deactivate and reactivate. Responses/errors use current platform conventions and expose safe code fields, not tenant or persistence ownership fields.

Create/update accept generically normalized `code`, nonblank `name`, and optional `description`; no numeric range validation is permitted. Authorization temporarily reuses `MANAGE_GENERAL_DOCUMENT_CODES` through the current document-code management pattern. Routes and capabilities may evolve independently from General Document Code.
