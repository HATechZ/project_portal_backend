CREATE TABLE "auth_session_consumed_refresh_tokens" (
    "tenant_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "consumed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_session_consumed_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_session_consumed_refresh_tokens_tenant_id_token_hash_key"
ON "auth_session_consumed_refresh_tokens"("tenant_id", "token_hash");

CREATE INDEX "auth_session_consumed_refresh_tokens_session_id_idx"
ON "auth_session_consumed_refresh_tokens"("session_id");

CREATE INDEX "auth_session_consumed_refresh_tokens_tenant_id_idx"
ON "auth_session_consumed_refresh_tokens"("tenant_id");

ALTER TABLE "auth_session_consumed_refresh_tokens"
ADD CONSTRAINT "auth_session_consumed_refresh_tokens_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve reuse detection for the token consumed immediately before this migration.
INSERT INTO "auth_session_consumed_refresh_tokens" (
    "tenant_id", "id", "session_id", "token_hash", "consumed_at"
)
SELECT "tenant_id", gen_random_uuid(), "id", "previous_refresh_token_hash", CURRENT_TIMESTAMP
FROM "auth_sessions"
WHERE "previous_refresh_token_hash" IS NOT NULL
ON CONFLICT ("tenant_id", "token_hash") DO NOTHING;
