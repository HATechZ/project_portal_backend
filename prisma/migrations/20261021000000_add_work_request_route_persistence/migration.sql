-- Additive route-model persistence. No legacy V1/C1/C2/C3 row is updated,
-- reparented, inferred, or deleted.
-- Rollback: stop route writes, retain route history for audit, revoke grants and
-- drop RLS policies/triggers/tables in reverse dependency order. Do not drop
-- tables after route commands have begun without an approved archival plan.

CREATE TYPE "work_request_route_step_kind" AS ENUM ('ORIGIN_START','INTERMEDIATE','ORIGIN_FINAL_REVIEW','CLIENT');
CREATE TYPE "work_request_route_revision_classification" AS ENUM ('INTERNAL_MEMBER','INTERNAL_TEAM','CROSS_DIVISION_FORMAL');
CREATE TYPE "work_request_route_reconsideration_decision_code" AS ENUM ('ACCEPT','DENY');

-- Platform metadata, not tenant-owned data. The route insert trigger below
-- makes this an explicit cutover boundary without fabricating legacy routes.
CREATE TABLE "work_request_route_cutovers" (
  "id" SMALLINT PRIMARY KEY CHECK ("id" = 1),
  "cutover_at" TIMESTAMP(6) NOT NULL
);
INSERT INTO "work_request_route_cutovers" ("id", "cutover_at") VALUES (1, CURRENT_TIMESTAMP);

CREATE TABLE "work_request_routes" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "work_request_id" UUID NOT NULL,
  "bid_id" UUID, "direct_project_id" UUID, "bid_business_cycle_id" UUID,
  "originating_division_id" UUID NOT NULL, "responsible_originating_division_lead_id" UUID NOT NULL,
  "cutover_at" TIMESTAMP(6) NOT NULL, "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("work_request_id","tenant_id"),
  UNIQUE ("id","tenant_id","work_request_id"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("work_request_id","tenant_id") REFERENCES "work_requests_v1"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("bid_id","tenant_id") REFERENCES "bids"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("direct_project_id","tenant_id") REFERENCES "direct_projects"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("bid_business_cycle_id","tenant_id","bid_id") REFERENCES "bid_business_cycles"("id","tenant_id","bid_id") ON DELETE RESTRICT,
  FOREIGN KEY ("originating_division_id","tenant_id") REFERENCES "divisions"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("responsible_originating_division_lead_id","tenant_id") REFERENCES "division_leads"("id","tenant_id") ON DELETE RESTRICT
);
CREATE INDEX "wr_routes_tenant_origin_idx" ON "work_request_routes"("tenant_id","originating_division_id");
CREATE INDEX "wr_routes_tenant_lead_idx" ON "work_request_routes"("tenant_id","responsible_originating_division_lead_id");

CREATE TABLE "work_request_route_responsibility_changes" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL,
  "predecessor_division_lead_id" UUID NOT NULL, "successor_division_lead_id" UUID NOT NULL,
  "changed_by_actor_id" UUID NOT NULL, "reason" TEXT NOT NULL,
  "changed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "correlation_id" UUID, "idempotency_key" VARCHAR(160),
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("tenant_id","idempotency_key"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id","tenant_id") REFERENCES "work_request_routes"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("predecessor_division_lead_id","tenant_id") REFERENCES "division_leads"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("successor_division_lead_id","tenant_id") REFERENCES "division_leads"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("changed_by_actor_id","tenant_id") REFERENCES "actor_profiles"("id","tenant_id") ON DELETE RESTRICT,
  CHECK ("predecessor_division_lead_id" <> "successor_division_lead_id")
);

CREATE TABLE "work_request_route_versions" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL, "version_number" INTEGER NOT NULL,
  "predecessor_version_id" UUID, "created_by_actor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "correlation_id" UUID, "idempotency_key" VARCHAR(160),
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("id","tenant_id","route_id"),
  UNIQUE ("tenant_id","route_id","version_number"), UNIQUE ("tenant_id","idempotency_key"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id","tenant_id") REFERENCES "work_request_routes"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("created_by_actor_id","tenant_id") REFERENCES "actor_profiles"("id","tenant_id") ON DELETE RESTRICT,
  CHECK ("version_number" > 0)
);
ALTER TABLE "work_request_route_versions" ADD FOREIGN KEY ("predecessor_version_id","tenant_id","route_id")
  REFERENCES "work_request_route_versions"("id","tenant_id","route_id") ON DELETE RESTRICT;

CREATE TABLE "work_request_route_steps" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL, "route_version_id" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL, "kind" "work_request_route_step_kind" NOT NULL, "division_id" UUID,
  "carried_from_step_id" UUID, "activated_at" TIMESTAMP(6), "completed_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("id","tenant_id","route_id"),
  UNIQUE ("tenant_id","route_version_id","ordinal"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id","tenant_id") REFERENCES "work_request_routes"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_version_id","tenant_id","route_id") REFERENCES "work_request_route_versions"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("division_id","tenant_id") REFERENCES "divisions"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("carried_from_step_id","tenant_id") REFERENCES "work_request_route_steps"("id","tenant_id") ON DELETE RESTRICT,
  CHECK ("ordinal" > 0),
  CHECK (("kind" = 'CLIENT' AND "division_id" IS NULL) OR ("kind" <> 'CLIENT' AND "division_id" IS NOT NULL)),
  CHECK ("completed_at" IS NULL OR ("activated_at" IS NOT NULL AND "completed_at" >= "activated_at"))
);
CREATE UNIQUE INDEX "wr_route_steps_one_active_idx" ON "work_request_route_steps"("tenant_id","route_id") WHERE "activated_at" IS NOT NULL AND "completed_at" IS NULL;

CREATE TABLE "work_request_division_cycles" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL, "route_step_id" UUID NOT NULL,
  "activated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completed_at" TIMESTAMP(6), "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("id","tenant_id","route_id"), UNIQUE ("tenant_id","route_step_id"),
  UNIQUE ("route_step_id","tenant_id","route_id"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id","tenant_id") REFERENCES "work_request_routes"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_step_id","tenant_id","route_id") REFERENCES "work_request_route_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  CHECK ("completed_at" IS NULL OR "completed_at" >= "activated_at")
);

CREATE TABLE "work_request_team_steps" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL, "division_cycle_id" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL, "team_id" UUID NOT NULL, "defined_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activated_at" TIMESTAMP(6), "completed_at" TIMESTAMP(6),
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("id","tenant_id","route_id"), UNIQUE ("tenant_id","division_cycle_id","ordinal"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id","tenant_id") REFERENCES "work_request_routes"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("division_cycle_id","tenant_id","route_id") REFERENCES "work_request_division_cycles"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("team_id","tenant_id") REFERENCES "teams"("id","tenant_id") ON DELETE RESTRICT,
  CHECK ("ordinal" > 0), CHECK ("completed_at" IS NULL OR ("activated_at" IS NOT NULL AND "completed_at" >= "activated_at"))
);
CREATE UNIQUE INDEX "wr_team_steps_one_active_idx" ON "work_request_team_steps"("tenant_id","division_cycle_id") WHERE "activated_at" IS NOT NULL AND "completed_at" IS NULL;

CREATE TABLE "work_request_member_steps" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL, "team_step_id" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL, "member_id" UUID NOT NULL, "appended_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activated_at" TIMESTAMP(6), "submitted_at" TIMESTAMP(6),
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("id","tenant_id","route_id"), UNIQUE ("tenant_id","team_step_id","ordinal"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id","tenant_id") REFERENCES "work_request_routes"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("team_step_id","tenant_id","route_id") REFERENCES "work_request_team_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("member_id","tenant_id") REFERENCES "members"("id","tenant_id") ON DELETE RESTRICT,
  CHECK ("ordinal" > 0), CHECK ("submitted_at" IS NULL OR ("activated_at" IS NOT NULL AND "submitted_at" >= "activated_at"))
);
CREATE UNIQUE INDEX "wr_member_steps_one_active_idx" ON "work_request_member_steps"("tenant_id","team_step_id") WHERE "activated_at" IS NOT NULL AND "submitted_at" IS NULL;

CREATE TABLE "work_request_route_revisions" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL,
  "classification" "work_request_route_revision_classification" NOT NULL, "round_number" INTEGER NOT NULL,
  "requester_actor_id" UUID NOT NULL, "requester_route_step_id" UUID NOT NULL,
  "source_actor_id" UUID NOT NULL, "source_route_step_id" UUID NOT NULL, "resume_route_step_id" UUID NOT NULL,
  "reason" TEXT NOT NULL, "requested_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMP(6), "resumed_at" TIMESTAMP(6), "correlation_id" UUID, "idempotency_key" VARCHAR(160),
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("id","tenant_id","route_id"),
  UNIQUE ("tenant_id","route_id","round_number"), UNIQUE ("tenant_id","route_id","idempotency_key"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id","tenant_id") REFERENCES "work_request_routes"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("requester_actor_id","tenant_id") REFERENCES "actor_profiles"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("source_actor_id","tenant_id") REFERENCES "actor_profiles"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("requester_route_step_id","tenant_id","route_id") REFERENCES "work_request_route_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("source_route_step_id","tenant_id","route_id") REFERENCES "work_request_route_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("resume_route_step_id","tenant_id","route_id") REFERENCES "work_request_route_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  CHECK ("round_number" > 0), CHECK ("resumed_at" IS NULL OR "submitted_at" IS NOT NULL)
);
CREATE UNIQUE INDEX "wr_route_revisions_one_open_idx" ON "work_request_route_revisions"("tenant_id","route_id") WHERE "resumed_at" IS NULL;
ALTER TABLE "work_request_route_revisions"
  ADD COLUMN "requester_division_cycle_id" UUID, ADD COLUMN "requester_team_step_id" UUID, ADD COLUMN "requester_member_step_id" UUID,
  ADD COLUMN "source_division_cycle_id" UUID, ADD COLUMN "source_team_step_id" UUID, ADD COLUMN "source_member_step_id" UUID,
  ADD COLUMN "resume_division_cycle_id" UUID, ADD COLUMN "resume_team_step_id" UUID, ADD COLUMN "resume_member_step_id" UUID;
ALTER TABLE "work_request_route_revisions"
  ADD CONSTRAINT "wr_route_revisions_requester_cycle_route_fk"
    FOREIGN KEY ("requester_division_cycle_id","tenant_id","route_id") REFERENCES "work_request_division_cycles"("id","tenant_id","route_id") ON DELETE RESTRICT,
  ADD CONSTRAINT "wr_route_revisions_requester_team_route_fk"
    FOREIGN KEY ("requester_team_step_id","tenant_id","route_id") REFERENCES "work_request_team_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  ADD CONSTRAINT "wr_route_revisions_requester_member_route_fk"
    FOREIGN KEY ("requester_member_step_id","tenant_id","route_id") REFERENCES "work_request_member_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  ADD CONSTRAINT "wr_route_revisions_source_cycle_route_fk"
    FOREIGN KEY ("source_division_cycle_id","tenant_id","route_id") REFERENCES "work_request_division_cycles"("id","tenant_id","route_id") ON DELETE RESTRICT,
  ADD CONSTRAINT "wr_route_revisions_source_team_route_fk"
    FOREIGN KEY ("source_team_step_id","tenant_id","route_id") REFERENCES "work_request_team_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  ADD CONSTRAINT "wr_route_revisions_source_member_route_fk"
    FOREIGN KEY ("source_member_step_id","tenant_id","route_id") REFERENCES "work_request_member_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  ADD CONSTRAINT "wr_route_revisions_resume_cycle_route_fk"
    FOREIGN KEY ("resume_division_cycle_id","tenant_id","route_id") REFERENCES "work_request_division_cycles"("id","tenant_id","route_id") ON DELETE RESTRICT,
  ADD CONSTRAINT "wr_route_revisions_resume_team_route_fk"
    FOREIGN KEY ("resume_team_step_id","tenant_id","route_id") REFERENCES "work_request_team_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  ADD CONSTRAINT "wr_route_revisions_resume_member_route_fk"
    FOREIGN KEY ("resume_member_step_id","tenant_id","route_id") REFERENCES "work_request_member_steps"("id","tenant_id","route_id") ON DELETE RESTRICT;

CREATE TABLE "work_request_route_events" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL, "route_step_id" UUID,
  "division_cycle_id" UUID, "team_step_id" UUID, "member_step_id" UUID, "revision_id" UUID,
  "action" VARCHAR(120) NOT NULL, "performed_by_actor_id" UUID NOT NULL,
  "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "note" TEXT, "correlation_id" UUID, "idempotency_key" VARCHAR(160),
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("tenant_id","route_id","idempotency_key"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id","tenant_id") REFERENCES "work_request_routes"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_step_id","tenant_id","route_id") REFERENCES "work_request_route_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("division_cycle_id","tenant_id","route_id") REFERENCES "work_request_division_cycles"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("team_step_id","tenant_id","route_id") REFERENCES "work_request_team_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("member_step_id","tenant_id","route_id") REFERENCES "work_request_member_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("revision_id","tenant_id","route_id") REFERENCES "work_request_route_revisions"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("performed_by_actor_id","tenant_id") REFERENCES "actor_profiles"("id","tenant_id") ON DELETE RESTRICT
);
CREATE INDEX "wr_route_events_latest_idx" ON "work_request_route_events"("route_id","occurred_at" DESC,"id" DESC);

CREATE TABLE "work_request_route_projections" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL,
  "route_version_id" UUID, "route_step_id" UUID, "division_cycle_id" UUID, "team_step_id" UUID, "member_step_id" UUID, "open_revision_id" UUID,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("route_id","tenant_id"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id","tenant_id") REFERENCES "work_request_routes"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_version_id","tenant_id","route_id") REFERENCES "work_request_route_versions"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_step_id","tenant_id","route_id") REFERENCES "work_request_route_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("division_cycle_id","tenant_id","route_id") REFERENCES "work_request_division_cycles"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("team_step_id","tenant_id","route_id") REFERENCES "work_request_team_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("member_step_id","tenant_id","route_id") REFERENCES "work_request_member_steps"("id","tenant_id","route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("open_revision_id","tenant_id","route_id") REFERENCES "work_request_route_revisions"("id","tenant_id","route_id") ON DELETE RESTRICT
);

CREATE TABLE "work_request_route_conversations" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL, "work_request_id" UUID NOT NULL,
  "first_participant_actor_id" UUID NOT NULL, "second_participant_actor_id" UUID NOT NULL, "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("id","tenant_id","work_request_id"),
  UNIQUE ("tenant_id","work_request_id","first_participant_actor_id","second_participant_actor_id"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id","tenant_id","work_request_id") REFERENCES "work_request_routes"("id","tenant_id","work_request_id") ON DELETE RESTRICT,
  FOREIGN KEY ("first_participant_actor_id","tenant_id") REFERENCES "actor_profiles"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("second_participant_actor_id","tenant_id") REFERENCES "actor_profiles"("id","tenant_id") ON DELETE RESTRICT,
  CHECK ("first_participant_actor_id" < "second_participant_actor_id")
);
CREATE TABLE "work_request_route_messages" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL, "work_request_id" UUID NOT NULL, "conversation_id" UUID NOT NULL,
  "sequence_number" INTEGER NOT NULL, "sender_actor_id" UUID NOT NULL, "recipient_actor_id" UUID NOT NULL, "body" TEXT NOT NULL,
  "sent_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "correlation_id" UUID, "idempotency_key" VARCHAR(160),
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("id","tenant_id","work_request_id"),
  UNIQUE ("tenant_id","conversation_id","sequence_number"), UNIQUE ("tenant_id","work_request_id","idempotency_key"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id","tenant_id","work_request_id") REFERENCES "work_request_routes"("id","tenant_id","work_request_id") ON DELETE RESTRICT,
  FOREIGN KEY ("conversation_id","tenant_id","work_request_id") REFERENCES "work_request_route_conversations"("id","tenant_id","work_request_id") ON DELETE RESTRICT,
  FOREIGN KEY ("sender_actor_id","tenant_id") REFERENCES "actor_profiles"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("recipient_actor_id","tenant_id") REFERENCES "actor_profiles"("id","tenant_id") ON DELETE RESTRICT,
  CHECK ("sender_actor_id" <> "recipient_actor_id"), CHECK (length(btrim("body")) > 0)
);
CREATE TABLE "work_request_route_message_attachments" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL, "work_request_id" UUID NOT NULL,
  "message_id" UUID NOT NULL, "document_version_id" UUID NOT NULL, "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("tenant_id","message_id","document_version_id"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id","tenant_id","work_request_id") REFERENCES "work_request_routes"("id","tenant_id","work_request_id") ON DELETE RESTRICT,
  FOREIGN KEY ("message_id","tenant_id","work_request_id") REFERENCES "work_request_route_messages"("id","tenant_id","work_request_id") ON DELETE RESTRICT,
  FOREIGN KEY ("document_version_id","tenant_id") REFERENCES "work_request_v1_document_versions"("id","tenant_id") ON DELETE RESTRICT
);

CREATE TABLE "work_request_route_reconsiderations" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL, "work_request_id" UUID NOT NULL,
  "requested_by_actor_id" UUID NOT NULL, "reason" TEXT, "requested_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "correlation_id" UUID, "idempotency_key" VARCHAR(160),
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("tenant_id","work_request_id"),
  UNIQUE ("tenant_id","work_request_id","idempotency_key"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id","tenant_id","work_request_id") REFERENCES "work_request_routes"("id","tenant_id","work_request_id") ON DELETE RESTRICT,
  FOREIGN KEY ("requested_by_actor_id","tenant_id") REFERENCES "actor_profiles"("id","tenant_id") ON DELETE RESTRICT
);
CREATE TABLE "work_request_route_reconsideration_decisions" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "reconsideration_id" UUID NOT NULL, "decided_by_actor_id" UUID NOT NULL,
  "decision" "work_request_route_reconsideration_decision_code" NOT NULL, "note" TEXT,
  "decided_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "correlation_id" UUID, "idempotency_key" VARCHAR(160),
  PRIMARY KEY ("id"), UNIQUE ("id","tenant_id"), UNIQUE ("reconsideration_id","tenant_id"), UNIQUE ("tenant_id","idempotency_key"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("reconsideration_id","tenant_id") REFERENCES "work_request_route_reconsiderations"("id","tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("decided_by_actor_id","tenant_id") REFERENCES "actor_profiles"("id","tenant_id") ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION prevent_work_request_route_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '% records are immutable after insert', TG_TABLE_NAME; END; $$;
CREATE OR REPLACE FUNCTION enforce_work_request_route_step_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."tenant_id" IS DISTINCT FROM OLD."tenant_id" OR NEW."route_id" IS DISTINCT FROM OLD."route_id"
     OR NEW."route_version_id" IS DISTINCT FROM OLD."route_version_id" OR NEW."ordinal" IS DISTINCT FROM OLD."ordinal"
     OR NEW."kind" IS DISTINCT FROM OLD."kind" OR NEW."division_id" IS DISTINCT FROM OLD."division_id"
     OR NEW."carried_from_step_id" IS DISTINCT FROM OLD."carried_from_step_id"
     OR (OLD."activated_at" IS NOT NULL AND NEW."activated_at" IS DISTINCT FROM OLD."activated_at")
     OR (OLD."completed_at" IS NOT NULL AND NEW."completed_at" IS DISTINCT FROM OLD."completed_at") THEN
    RAISE EXCEPTION 'route step immutable fields cannot be changed';
  END IF; RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION enforce_work_request_route_cutover()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_cutover timestamp(6); v_created timestamp(6); v_bid uuid; v_direct_project uuid; v_cycle uuid;
BEGIN
  SELECT "cutover_at" INTO v_cutover FROM "work_request_route_cutovers" WHERE "id" = 1;
  SELECT "created_at", "bid_id", "direct_project_id", "bid_business_cycle_id"
    INTO v_created, v_bid, v_direct_project, v_cycle
    FROM "work_requests_v1"
    WHERE "id" = NEW."work_request_id" AND "tenant_id" = NEW."tenant_id";
  IF v_cutover IS NULL OR v_created IS NULL OR v_created < v_cutover OR NEW."cutover_at" <> v_cutover THEN
    RAISE EXCEPTION 'route persistence requires a post-cutover Work Request';
  END IF;
  IF NEW."bid_id" IS DISTINCT FROM v_bid
     OR NEW."direct_project_id" IS DISTINCT FROM v_direct_project
     OR NEW."bid_business_cycle_id" IS DISTINCT FROM v_cycle THEN
    RAISE EXCEPTION 'route parent and C3 cycle must match its WorkRequestV1 anchor';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER wr_routes_cutover BEFORE INSERT ON "work_request_routes" FOR EACH ROW EXECUTE FUNCTION enforce_work_request_route_cutover();
CREATE TRIGGER wr_routes_immutable BEFORE UPDATE OR DELETE ON "work_request_routes" FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();
CREATE TRIGGER wr_versions_immutable BEFORE UPDATE OR DELETE ON "work_request_route_versions" FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();
CREATE TRIGGER wr_steps_lifecycle BEFORE UPDATE ON "work_request_route_steps" FOR EACH ROW EXECUTE FUNCTION enforce_work_request_route_step_lifecycle();
CREATE TRIGGER wr_steps_no_delete BEFORE DELETE ON "work_request_route_steps" FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();
CREATE TRIGGER wr_cycles_no_delete BEFORE DELETE ON "work_request_division_cycles" FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();
CREATE TRIGGER wr_team_steps_no_delete BEFORE DELETE ON "work_request_team_steps" FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();
CREATE TRIGGER wr_member_steps_no_delete BEFORE DELETE ON "work_request_member_steps" FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();
CREATE TRIGGER wr_events_immutable BEFORE UPDATE OR DELETE ON "work_request_route_events" FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();
CREATE TRIGGER wr_conversations_immutable BEFORE UPDATE OR DELETE ON "work_request_route_conversations" FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();
CREATE TRIGGER wr_messages_immutable BEFORE UPDATE OR DELETE ON "work_request_route_messages" FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();
CREATE TRIGGER wr_message_attachments_immutable BEFORE UPDATE OR DELETE ON "work_request_route_message_attachments" FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();
CREATE TRIGGER wr_reconsiderations_immutable BEFORE UPDATE OR DELETE ON "work_request_route_reconsiderations" FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();
CREATE TRIGGER wr_reconsideration_decisions_immutable BEFORE UPDATE OR DELETE ON "work_request_route_reconsideration_decisions" FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['work_request_routes','work_request_route_responsibility_changes','work_request_route_versions','work_request_route_steps','work_request_division_cycles','work_request_team_steps','work_request_member_steps','work_request_route_revisions','work_request_route_events','work_request_route_projections','work_request_route_conversations','work_request_route_messages','work_request_route_message_attachments','work_request_route_reconsiderations','work_request_route_reconsideration_decisions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I AS PERMISSIVE FOR ALL TO app_user USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)', 'tenant_isolation_' || t, t);
  END LOOP;
END $$;
GRANT SELECT, INSERT ON TABLE "work_request_routes","work_request_route_responsibility_changes","work_request_route_versions","work_request_route_events","work_request_route_conversations","work_request_route_messages","work_request_route_message_attachments","work_request_route_reconsiderations","work_request_route_reconsideration_decisions" TO app_user;
GRANT SELECT, INSERT, UPDATE ON TABLE "work_request_route_steps","work_request_division_cycles","work_request_team_steps","work_request_member_steps","work_request_route_revisions","work_request_route_projections" TO app_user;
