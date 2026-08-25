ALTER TABLE "auth_sessions"
ADD COLUMN "previous_refresh_token_hash" VARCHAR(255),
ADD COLUMN "absolute_expires_at" TIMESTAMP(6);

UPDATE "auth_sessions"
SET "absolute_expires_at" = "expires_at"
WHERE "absolute_expires_at" IS NULL;

ALTER TABLE "auth_sessions"
ALTER COLUMN "absolute_expires_at" SET NOT NULL;

CREATE INDEX "auth_sessions_previous_refresh_token_hash_idx"
ON "auth_sessions"("previous_refresh_token_hash");
