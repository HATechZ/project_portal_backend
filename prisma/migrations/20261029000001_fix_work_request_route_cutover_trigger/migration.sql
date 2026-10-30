CREATE OR REPLACE FUNCTION public.enforce_work_request_route_cutover()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_cutover timestamp(6); v_created timestamp(6); v_bid uuid; v_direct_project uuid; v_cycle uuid;
BEGIN
  SELECT "cutover_at" INTO v_cutover FROM "work_request_route_cutovers" WHERE "id" = 1;
  NEW."cutover_at" := v_cutover;
  SELECT "created_at", "bid_id", "direct_project_id", "bid_business_cycle_id"
    INTO v_created, v_bid, v_direct_project, v_cycle
    FROM "work_requests_v1"
    WHERE "id" = NEW."work_request_id" AND "tenant_id" = NEW."tenant_id";
  IF v_cutover IS NULL OR v_created IS NULL OR v_created < v_cutover THEN
    RAISE EXCEPTION 'route persistence requires a post-cutover Work Request';
  END IF;
  IF NEW."bid_id" IS DISTINCT FROM v_bid
     OR NEW."direct_project_id" IS DISTINCT FROM v_direct_project
     OR NEW."bid_business_cycle_id" IS DISTINCT FROM v_cycle THEN
    RAISE EXCEPTION 'route parent and C3 cycle must match its WorkRequestV1 anchor';
  END IF;
  RETURN NEW;
END; $$;
