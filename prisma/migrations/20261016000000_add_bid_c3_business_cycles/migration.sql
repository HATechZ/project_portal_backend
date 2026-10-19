-- Add C3 Bid commercial-cycle persistence without changing existing Bid,
-- DirectProject, Work Request, document, C1, or C2 ownership/history.
--
-- Rollback: stop C3 writes; preserve business history needed for audit; revoke
-- grants/drop RLS policies, trigger, Work Request FK/check/index/column, then
-- C3 tables in dependency order. Do not reverse the deterministic membership
-- baseline on a live system after C3 commands have started using it.

INSERT INTO "bid_statuses" ("id", "code", "name", "sort_order", "is_terminal")
VALUES (gen_random_uuid(), 'ARCHIVED', 'Archived', 999, true)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE "bid_business_cycles" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "bid_id" UUID NOT NULL,
  "cycle_number" INTEGER NOT NULL, "opened_by_actor_id" UUID,
  "opened_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(6), "reopened_from_outcome_id" UUID,
  "opened_by_c3_baseline_migration" BOOLEAN NOT NULL DEFAULT false, "idempotency_key" VARCHAR(160),
  CONSTRAINT "bid_business_cycles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bid_business_cycles_id_tenant_bid_key" UNIQUE ("id", "tenant_id", "bid_id"),
  CONSTRAINT "bid_business_cycles_tenant_bid_number_key" UNIQUE ("tenant_id", "bid_id", "cycle_number"),
  CONSTRAINT "bid_business_cycles_tenant_idempotency_key_key" UNIQUE ("tenant_id", "idempotency_key"),
  CONSTRAINT "bid_business_cycles_cycle_number_check" CHECK ("cycle_number" > 0),
  CONSTRAINT "bid_business_cycles_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_business_cycles_bid_tenant_fk" FOREIGN KEY ("bid_id", "tenant_id") REFERENCES "bids"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_business_cycles_opened_actor_tenant_fk" FOREIGN KEY ("opened_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE SET NULL ("opened_by_actor_id") ON UPDATE CASCADE
);
CREATE INDEX "bid_business_cycles_tenant_bid_opened_at_idx" ON "bid_business_cycles"("tenant_id", "bid_id", "opened_at");
CREATE INDEX "bid_business_cycles_tenant_bid_closed_at_idx" ON "bid_business_cycles"("tenant_id", "bid_id", "closed_at");
CREATE UNIQUE INDEX "bid_business_cycles_one_open_per_bid_key" ON "bid_business_cycles"("tenant_id", "bid_id") WHERE "closed_at" IS NULL;

CREATE TABLE "bid_business_outcomes" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "bid_id" UUID NOT NULL, "business_cycle_id" UUID NOT NULL,
  "outcome" "bid_outcome_code" NOT NULL, "decided_by_actor_id" UUID NOT NULL,
  "decided_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "note" TEXT,
  "correlation_id" UUID, "idempotency_key" VARCHAR(160),
  CONSTRAINT "bid_business_outcomes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bid_business_outcomes_id_tenant_bid_key" UNIQUE ("id", "tenant_id", "bid_id"),
  CONSTRAINT "bid_business_outcomes_cycle_tenant_key" UNIQUE ("business_cycle_id", "tenant_id"),
  CONSTRAINT "bid_business_outcomes_cycle_tenant_bid_key" UNIQUE ("business_cycle_id", "tenant_id", "bid_id"),
  CONSTRAINT "bid_business_outcomes_tenant_idempotency_key_key" UNIQUE ("tenant_id", "idempotency_key"),
  CONSTRAINT "bid_business_outcomes_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_business_outcomes_bid_tenant_fk" FOREIGN KEY ("bid_id", "tenant_id") REFERENCES "bids"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_business_outcomes_cycle_tenant_bid_fk" FOREIGN KEY ("business_cycle_id", "tenant_id", "bid_id") REFERENCES "bid_business_cycles"("id", "tenant_id", "bid_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_business_outcomes_actor_tenant_fk" FOREIGN KEY ("decided_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "bid_business_outcomes_tenant_bid_decided_at_idx" ON "bid_business_outcomes"("tenant_id", "bid_id", "decided_at");
CREATE UNIQUE INDEX "bid_business_outcomes_one_win_per_bid_key" ON "bid_business_outcomes"("tenant_id", "bid_id") WHERE "outcome" = 'WIN';

ALTER TABLE "bid_business_cycles" ADD CONSTRAINT "bid_business_cycles_reopened_outcome_tenant_bid_fk"
  FOREIGN KEY ("reopened_from_outcome_id", "tenant_id", "bid_id") REFERENCES "bid_business_outcomes"("id", "tenant_id", "bid_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "bid_project_conversions" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "bid_id" UUID NOT NULL, "direct_project_id" UUID NOT NULL,
  "business_cycle_id" UUID NOT NULL, "bid_business_outcome_id" UUID NOT NULL, "converted_by_actor_id" UUID NOT NULL,
  "converted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "note" TEXT, "correlation_id" UUID, "idempotency_key" VARCHAR(160),
  CONSTRAINT "bid_project_conversions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bid_project_conversions_bid_tenant_key" UNIQUE ("bid_id", "tenant_id"),
  CONSTRAINT "bid_project_conversions_project_tenant_key" UNIQUE ("direct_project_id", "tenant_id"),
  CONSTRAINT "bid_project_conversions_outcome_tenant_key" UNIQUE ("bid_business_outcome_id", "tenant_id"),
  CONSTRAINT "bid_project_conversions_cycle_tenant_bid_key" UNIQUE ("business_cycle_id", "tenant_id", "bid_id"),
  CONSTRAINT "bid_project_conversions_outcome_tenant_bid_key" UNIQUE ("bid_business_outcome_id", "tenant_id", "bid_id"),
  CONSTRAINT "bid_project_conversions_tenant_idempotency_key_key" UNIQUE ("tenant_id", "idempotency_key"),
  CONSTRAINT "bid_project_conversions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_project_conversions_bid_tenant_fk" FOREIGN KEY ("bid_id", "tenant_id") REFERENCES "bids"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_project_conversions_project_tenant_fk" FOREIGN KEY ("direct_project_id", "tenant_id") REFERENCES "direct_projects"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_project_conversions_cycle_tenant_bid_fk" FOREIGN KEY ("business_cycle_id", "tenant_id", "bid_id") REFERENCES "bid_business_cycles"("id", "tenant_id", "bid_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_project_conversions_outcome_tenant_bid_fk" FOREIGN KEY ("bid_business_outcome_id", "tenant_id", "bid_id") REFERENCES "bid_business_outcomes"("id", "tenant_id", "bid_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_project_conversions_actor_tenant_fk" FOREIGN KEY ("converted_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "bid_project_conversions_tenant_cycle_idx" ON "bid_project_conversions"("tenant_id", "business_cycle_id");

CREATE TABLE "bid_archived_review_requests" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "bid_id" UUID NOT NULL, "rejected_outcome_id" UUID NOT NULL,
  "requested_by_actor_id" UUID NOT NULL, "requested_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT, "correlation_id" UUID, "idempotency_key" VARCHAR(160),
  CONSTRAINT "bid_archived_review_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bid_archived_review_requests_tenant_idempotency_key_key" UNIQUE ("tenant_id", "idempotency_key"),
  CONSTRAINT "bid_archived_review_requests_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_archived_review_requests_bid_tenant_fk" FOREIGN KEY ("bid_id", "tenant_id") REFERENCES "bids"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_archived_review_requests_outcome_tenant_bid_fk" FOREIGN KEY ("rejected_outcome_id", "tenant_id", "bid_id") REFERENCES "bid_business_outcomes"("id", "tenant_id", "bid_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_archived_review_requests_actor_tenant_fk" FOREIGN KEY ("requested_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "bid_archived_review_requests_tenant_bid_requested_at_idx" ON "bid_archived_review_requests"("tenant_id", "bid_id", "requested_at");

ALTER TABLE "work_requests_v1" ADD COLUMN "bid_business_cycle_id" UUID;
ALTER TABLE "work_requests_v1" ADD CONSTRAINT "work_requests_v1_bid_cycle_tenant_bid_fk"
  FOREIGN KEY ("bid_business_cycle_id", "tenant_id", "bid_id") REFERENCES "bid_business_cycles"("id", "tenant_id", "bid_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_requests_v1" ADD CONSTRAINT "work_requests_v1_bid_cycle_parent_check"
  CHECK ("bid_business_cycle_id" IS NULL OR ("bid_id" IS NOT NULL AND "direct_project_id" IS NULL));
CREATE INDEX "work_requests_v1_tenant_bid_cycle_bid_idx" ON "work_requests_v1"("tenant_id", "bid_business_cycle_id", "bid_id");

-- The only approved historical membership reconstruction: current non-archived
-- independent Bids receive cycle 1, and every already Bid-owned V1 request is
-- enrolled. No timestamps, states, events, documents, or parent IDs are used/changed.
WITH active_bids AS (
  SELECT b."tenant_id", b."id"
  FROM "bids" b
  LEFT JOIN LATERAL (
    SELECT s."code"
    FROM "bid_status_events" e
    JOIN "bid_statuses" s ON s."id" = e."to_status_id"
    WHERE e."tenant_id" = b."tenant_id" AND e."bid_id" = b."id"
    ORDER BY e."occurred_at" DESC, e."id" DESC
    LIMIT 1
  ) latest ON true
  WHERE latest."code" IS DISTINCT FROM 'ARCHIVED'::"bid_status_code"
)
INSERT INTO "bid_business_cycles" ("tenant_id", "id", "bid_id", "cycle_number", "opened_by_c3_baseline_migration")
SELECT "tenant_id", gen_random_uuid(), "id", 1, true FROM active_bids
ON CONFLICT ("tenant_id", "bid_id", "cycle_number") DO NOTHING;

UPDATE "work_requests_v1" wr
SET "bid_business_cycle_id" = cycle."id"
FROM "bid_business_cycles" cycle
WHERE cycle."tenant_id" = wr."tenant_id"
  AND cycle."bid_id" = wr."bid_id"
  AND cycle."cycle_number" = 1
  AND cycle."opened_by_c3_baseline_migration" = true
  AND wr."bid_id" IS NOT NULL
  AND wr."direct_project_id" IS NULL
  AND wr."bid_business_cycle_id" IS NULL;

CREATE OR REPLACE FUNCTION prevent_work_request_v1_bid_cycle_reassignment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."bid_business_cycle_id" IS NOT NULL
     AND NEW."bid_business_cycle_id" IS DISTINCT FROM OLD."bid_business_cycle_id" THEN
    RAISE EXCEPTION 'bid_business_cycle_id is immutable once assigned';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER work_requests_v1_bid_cycle_immutable
BEFORE UPDATE OF "bid_business_cycle_id" ON "work_requests_v1"
FOR EACH ROW EXECUTE FUNCTION prevent_work_request_v1_bid_cycle_reassignment();

-- C3 outcome, conversion, and archived-review rows are the permanent business
-- history/provenance record.  Keep the protection in PostgreSQL as well as in
-- the application: future grants cannot make those facts mutable by app_user.
CREATE OR REPLACE FUNCTION prevent_bid_c3_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% records are immutable after insert', TG_TABLE_NAME;
END;
$$;
CREATE TRIGGER bid_business_outcomes_immutable
BEFORE UPDATE OR DELETE ON "bid_business_outcomes"
FOR EACH ROW EXECUTE FUNCTION prevent_bid_c3_history_mutation();
CREATE TRIGGER bid_project_conversions_immutable
BEFORE UPDATE OR DELETE ON "bid_project_conversions"
FOR EACH ROW EXECUTE FUNCTION prevent_bid_c3_history_mutation();
CREATE TRIGGER bid_archived_review_requests_immutable
BEFORE UPDATE OR DELETE ON "bid_archived_review_requests"
FOR EACH ROW EXECUTE FUNCTION prevent_bid_c3_history_mutation();

ALTER TABLE "bid_business_cycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bid_business_outcomes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bid_project_conversions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bid_archived_review_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_bid_business_cycles ON "bid_business_cycles" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_bid_business_outcomes ON "bid_business_outcomes" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_bid_project_conversions ON "bid_project_conversions" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_bid_archived_review_requests ON "bid_archived_review_requests" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE ON TABLE "bid_business_cycles" TO app_user;
GRANT SELECT, INSERT ON TABLE "bid_business_outcomes", "bid_project_conversions", "bid_archived_review_requests" TO app_user;
