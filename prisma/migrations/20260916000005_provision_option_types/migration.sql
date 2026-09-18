-- Provision the fixed, global OptionType catalogue required by runtime lookups.
-- Existing matching codes are deliberately preserved without changing their IDs or metadata.
--
-- Rollback:
-- Manual only, after confirming any newly provisioned rows have no OptionValue references.
-- Preserve global metadata that is already in use.

INSERT INTO "option_types" ("id", "code", "name")
VALUES
  (gen_random_uuid(), 'POL'::"option_type_code", 'POL'),
  (gen_random_uuid(), 'POD'::"option_type_code", 'POD'),
  (gen_random_uuid(), 'CARGO_CODE'::"option_type_code", 'Cargo Code'),
  (gen_random_uuid(), 'VESSEL_CODE'::"option_type_code", 'Vessel Code'),
  (gen_random_uuid(), 'PROJECT_INFO_CATEGORY'::"option_type_code", 'Project Info Category'),
  (gen_random_uuid(), 'WORK_REQUEST_TYPE'::"option_type_code", 'Work Request Type'),
  (gen_random_uuid(), 'DOCUMENT_CATEGORY'::"option_type_code", 'Document Category'),
  (gen_random_uuid(), 'ATTACHMENT_CATEGORY'::"option_type_code", 'Attachment Category')
ON CONFLICT ("code") DO NOTHING;
