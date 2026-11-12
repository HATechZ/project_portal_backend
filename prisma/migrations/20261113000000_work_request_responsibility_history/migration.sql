-- Prepared only. Apply manually after the transactional writers and readers are ready.
-- No legacy backfill: existing records do not consistently prove actor-specific
-- responsibility intervals, and transition performers can be different people.
CREATE UNIQUE INDEX "wr_resp_user_tenant_key" ON "users" ("id", "tenant_id");
CREATE UNIQUE INDEX "wr_team_step_history_context_key"
  ON "work_request_team_steps" ("id", "tenant_id", "route_id", "division_cycle_id");
CREATE UNIQUE INDEX "wr_route_event_history_context_key"
  ON "work_request_route_events" ("id", "tenant_id", "route_id");

CREATE TABLE "work_request_responsibility_history" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "work_request_id" UUID NOT NULL,
  "route_id" UUID NOT NULL,
  "actor_profile_id" UUID NOT NULL,
  "responsibility_type" VARCHAR(16) NOT NULL,
  "division_cycle_id" UUID NOT NULL,
  "team_step_id" UUID,
  "started_at" TIMESTAMP(6),
  "ended_at" TIMESTAMP(6),
  "evidence_kind" VARCHAR(16) NOT NULL,
  "evidence_event_id" UUID,
  "evidence_at" TIMESTAMP(6),
  "assignment_key" VARCHAR(200),
  "source_member_id" UUID NOT NULL,
  "source_user_id" UUID NOT NULL,
  "source_role_id" UUID NOT NULL,
  "selection_policy" VARCHAR(32) NOT NULL,
  "source_division_lead_id" UUID,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("id", "tenant_id"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE RESTRICT,
  FOREIGN KEY ("work_request_id", "tenant_id") REFERENCES "work_requests_v1" ("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("route_id", "tenant_id", "work_request_id") REFERENCES "work_request_routes" ("id", "tenant_id", "work_request_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("actor_profile_id", "tenant_id") REFERENCES "actor_profiles" ("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("source_member_id", "tenant_id") REFERENCES "members" ("id", "tenant_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY ("source_user_id", "tenant_id") REFERENCES "users" ("id", "tenant_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY ("source_role_id") REFERENCES "roles" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY ("source_division_lead_id", "tenant_id") REFERENCES "division_leads" ("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("division_cycle_id", "tenant_id", "route_id") REFERENCES "work_request_division_cycles" ("id", "tenant_id", "route_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("team_step_id", "tenant_id", "route_id", "division_cycle_id") REFERENCES "work_request_team_steps" ("id", "tenant_id", "route_id", "division_cycle_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("evidence_event_id", "tenant_id", "route_id") REFERENCES "work_request_route_events" ("id", "tenant_id", "route_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wr_resp_context_shape" CHECK (("responsibility_type" = 'TEAM' AND "team_step_id" IS NOT NULL) OR ("responsibility_type" = 'DIVISION' AND "team_step_id" IS NULL)),
  CONSTRAINT "wr_resp_evidence_shape" CHECK (("evidence_kind" = 'ASSIGNMENT' AND "selection_policy" = 'CONTEXT_UNIQUE' AND "started_at" IS NOT NULL AND "evidence_event_id" IS NULL AND "evidence_at" IS NULL AND "assignment_key" IS NOT NULL AND length(btrim("assignment_key")) > 0 AND "source_member_id" IS NOT NULL AND (("responsibility_type" = 'TEAM' AND "source_division_lead_id" IS NULL) OR ("responsibility_type" = 'DIVISION' AND "source_division_lead_id" IS NOT NULL))) OR ("evidence_kind" = 'EVENT' AND "selection_policy" = 'EVENT_PROVEN' AND "started_at" IS NULL AND "ended_at" IS NULL AND "evidence_event_id" IS NOT NULL AND "evidence_at" IS NOT NULL AND "assignment_key" IS NULL AND "source_division_lead_id" IS NULL)),
  CONSTRAINT "wr_resp_interval_order" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);
CREATE INDEX "wr_resp_actor_request_idx" ON "work_request_responsibility_history" ("tenant_id", "actor_profile_id", "work_request_id");
CREATE INDEX "wr_resp_cycle_actor_idx" ON "work_request_responsibility_history" ("tenant_id", "division_cycle_id", "actor_profile_id");
CREATE INDEX "wr_resp_team_actor_idx" ON "work_request_responsibility_history" ("tenant_id", "team_step_id", "actor_profile_id");
CREATE UNIQUE INDEX "wr_resp_assignment_key" ON "work_request_responsibility_history" ("tenant_id", "assignment_key");
CREATE UNIQUE INDEX "wr_resp_open_team_step_key" ON "work_request_responsibility_history" ("tenant_id", "team_step_id") WHERE "responsibility_type" = 'TEAM' AND "evidence_kind" = 'ASSIGNMENT' AND "ended_at" IS NULL;
CREATE UNIQUE INDEX "wr_resp_open_team_actor_key" ON "work_request_responsibility_history" ("tenant_id", "team_step_id", "actor_profile_id") WHERE "responsibility_type" = 'TEAM' AND "evidence_kind" = 'ASSIGNMENT' AND "ended_at" IS NULL;
CREATE UNIQUE INDEX "wr_resp_open_division_actor_key" ON "work_request_responsibility_history" ("tenant_id", "division_cycle_id", "actor_profile_id") WHERE "responsibility_type" = 'DIVISION' AND "evidence_kind" = 'ASSIGNMENT' AND "ended_at" IS NULL;
CREATE UNIQUE INDEX "wr_resp_event_actor_key" ON "work_request_responsibility_history" ("tenant_id", "evidence_event_id", "actor_profile_id", "responsibility_type") WHERE "evidence_event_id" IS NOT NULL;

-- Event provenance must be the same actor and execution context, not merely
-- any event on the route. Application/backfill still has to establish that the
-- action and its historical authorization semantics are conclusive evidence.
CREATE FUNCTION "validate_work_request_responsibility_evidence"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Immutable snapshots are checked against the exact actor, Member and User
  -- at insertion; no composite FK ties the snapshots to a mutable profile.
  PERFORM 1 FROM "actor_profiles" a
  JOIN "members" m ON m."id" = NEW."source_member_id" AND m."tenant_id" = NEW."tenant_id"
  JOIN "users" u ON u."id" = NEW."source_user_id" AND u."tenant_id" = NEW."tenant_id"
  JOIN "roles" r ON r."id" = NEW."source_role_id"
  WHERE a."id" = NEW."actor_profile_id" AND a."tenant_id" = NEW."tenant_id"
    AND a."member_id" = m."id" AND a."user_id" = u."id"
    AND m."user_id" = u."id" AND a."role_id" = r."id"
    AND (r."tenant_id" = NEW."tenant_id" OR r."tenant_id" IS NULL)
  FOR SHARE OF a, m, u, r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Responsibility identity snapshots do not match';
  END IF;
  IF NEW."evidence_kind" = 'ASSIGNMENT' THEN
    -- The resolver is still responsible for proving candidate uniqueness and
    -- exact required permissions inside the same transaction.
    PERFORM 1 FROM "actor_profiles" a
    JOIN "members" m ON m."id" = NEW."source_member_id" AND m."tenant_id" = NEW."tenant_id"
    JOIN "users" u ON u."id" = NEW."source_user_id" AND u."tenant_id" = NEW."tenant_id"
    JOIN "roles" r ON r."id" = NEW."source_role_id"
    JOIN "user_roles" ur ON ur."tenant_id" = NEW."tenant_id" AND ur."user_id" = u."id" AND ur."role_id" = r."id" AND ur."revoked_at" IS NULL
    WHERE a."id" = NEW."actor_profile_id" AND a."tenant_id" = NEW."tenant_id"
      AND a."is_active" AND m."is_active" AND u."is_active" AND r."is_active"
      AND (r."tenant_id" = NEW."tenant_id" OR r."tenant_id" IS NULL)
      AND r."custom_scope"::text = lower(NEW."responsibility_type")
    FOR SHARE OF a, m, u, r, ur;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Responsibility identity or active compatible role grant is invalid';
    END IF;
    IF NEW."responsibility_type" = 'TEAM' THEN
      -- The TeamStep and its mutable Team lead are the authoritative live
      -- assignment source; lock it while recording the immutable snapshot.
      PERFORM 1 FROM "work_request_team_steps" ts
      JOIN "teams" team ON team."id" = ts."team_id" AND team."tenant_id" = ts."tenant_id"
      WHERE ts."id" = NEW."team_step_id" AND ts."tenant_id" = NEW."tenant_id"
        AND ts."route_id" = NEW."route_id" AND ts."division_cycle_id" = NEW."division_cycle_id"
        AND ts."activated_at" IS NOT NULL AND ts."completed_at" IS NULL
        AND team."is_active" AND team."lead_member_id" = NEW."source_member_id"
      FOR SHARE OF team;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Team responsibility source is not the active assigned lead';
      END IF;
    ELSIF NEW."responsibility_type" = 'DIVISION' THEN
      PERFORM 1 FROM "division_leads" lead
      JOIN "work_request_division_cycles" cycle ON cycle."id" = NEW."division_cycle_id" AND cycle."tenant_id" = lead."tenant_id"
      JOIN "work_request_route_steps" step ON step."id" = cycle."route_step_id" AND step."tenant_id" = cycle."tenant_id" AND step."route_id" = cycle."route_id"
      WHERE lead."id" = NEW."source_division_lead_id" AND lead."tenant_id" = NEW."tenant_id"
        AND lead."member_id" = NEW."source_member_id" AND lead."division_id" = step."division_id"
        AND lead."revoked_at" IS NULL AND cycle."route_id" = NEW."route_id"
      FOR SHARE OF lead;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Division responsibility source is not an active assigned lead';
      END IF;
    END IF;
  END IF;
  IF NEW."evidence_kind" = 'EVENT' AND NOT EXISTS (
    SELECT 1 FROM "work_request_route_events" e
    WHERE e."id" = NEW."evidence_event_id" AND e."tenant_id" = NEW."tenant_id"
      AND e."route_id" = NEW."route_id" AND e."division_cycle_id" = NEW."division_cycle_id"
      AND e."performed_by_actor_id" = NEW."actor_profile_id" AND e."occurred_at" = NEW."evidence_at"
      AND (NEW."responsibility_type" = 'DIVISION' OR e."team_step_id" = NEW."team_step_id")
  ) THEN
    RAISE EXCEPTION 'Responsibility evidence does not match the actor and execution context';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "wr_responsibility_history_evidence" BEFORE INSERT ON "work_request_responsibility_history" FOR EACH ROW EXECUTE FUNCTION "validate_work_request_responsibility_evidence"();
CREATE FUNCTION "guard_work_request_responsibility_history"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Responsibility history cannot be deleted';
  END IF;
  IF OLD."evidence_kind" <> 'ASSIGNMENT' OR OLD."ended_at" IS NOT NULL OR NEW."ended_at" IS NULL OR
     (to_jsonb(NEW) - 'ended_at') IS DISTINCT FROM (to_jsonb(OLD) - 'ended_at') THEN
    RAISE EXCEPTION 'Only one-time closing of a responsibility interval is permitted';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "wr_responsibility_history_immutable" BEFORE UPDATE OR DELETE ON "work_request_responsibility_history" FOR EACH ROW EXECUTE FUNCTION "guard_work_request_responsibility_history"();

ALTER TABLE "work_request_responsibility_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_responsibility_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_wr_responsibility_history" ON "work_request_responsibility_history" AS PERMISSIVE FOR ALL TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
GRANT SELECT, INSERT ON "work_request_responsibility_history" TO app_user;
GRANT UPDATE ("ended_at") ON "work_request_responsibility_history" TO app_user;
-- Rollback requires a reviewed restore/backup: revoke grants and drop the new
-- history table/functions and its two supporting unique indexes, losing the new
-- history, including wr_resp_user_tenant_key; deploy compatible readers/writers first. Never drop established data.
