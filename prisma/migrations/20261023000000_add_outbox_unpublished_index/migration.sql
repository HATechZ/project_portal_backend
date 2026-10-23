-- Keep the outbox relay backlog query proportional to unpublished events,
-- rather than the permanent outbox event trace.
CREATE INDEX "outbox_messages_unpublished_idx"
  ON "outbox_messages"("occurred_at")
  WHERE "published_at" IS NULL;
