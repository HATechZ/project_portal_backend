-- CreateTable
CREATE TABLE "outbox_messages" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "event_type" VARCHAR(160) NOT NULL,
    "routing_key" VARCHAR(160) NOT NULL,
    "payload" JSONB NOT NULL,
    "actor_id" UUID,
    "correlation_id" UUID,
    "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "consumer" VARCHAR(120) NOT NULL,
    "processed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_messages_occurred_at_idx" ON "outbox_messages"("occurred_at");

-- CreateIndex
CREATE INDEX "outbox_messages_event_type_idx" ON "outbox_messages"("event_type");

-- CreateIndex
CREATE INDEX "outbox_messages_tenant_id_idx" ON "outbox_messages"("tenant_id");

-- CreateIndex
CREATE INDEX "processed_events_processed_at_idx" ON "processed_events"("processed_at");

-- CreateIndex
CREATE INDEX "processed_events_tenant_id_idx" ON "processed_events"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "processed_events_tenant_id_event_id_consumer_key" ON "processed_events"("tenant_id", "event_id", "consumer");

-- AddForeignKey
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "actor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_events" ADD CONSTRAINT "processed_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
