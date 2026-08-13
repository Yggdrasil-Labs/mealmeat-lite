CREATE SEQUENCE "sync_server_version_seq" AS bigint START WITH 1 INCREMENT BY 1;
--> statement-breakpoint
CREATE TABLE "auth_attempt_throttles" (
	"scope" varchar(40) NOT NULL,
	"source_key_hash" text NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_attempt_throttles_scope_source_key_hash_pk" PRIMARY KEY("scope","source_key_hash"),
	CONSTRAINT "auth_attempt_throttles_failure_count_check" CHECK ("auth_attempt_throttles"."failure_count" >= 0),
	CONSTRAINT "auth_attempt_throttles_scope_check" CHECK ("auth_attempt_throttles"."scope" in ('bootstrap', 'register')),
	CONSTRAINT "auth_attempt_throttles_source_key_hash_format_check" CHECK ("auth_attempt_throttles"."source_key_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "auth_config" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"family_code_hash" text NOT NULL,
	"family_code_version" bigint DEFAULT 1 NOT NULL,
	"initialized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_config_singleton_check" CHECK ("auth_config"."singleton" = true),
	CONSTRAINT "auth_config_family_code_hash_format_check" CHECK ("auth_config"."family_code_hash" ~ '^\$argon2id\$v=19\$m=[1-9][0-9]*,t=[1-9][0-9]*,p=[1-9][0-9]*\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$'),
	CONSTRAINT "auth_config_family_code_version_check" CHECK ("auth_config"."family_code_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"device_name" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "device_tokens_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "device_tokens_token_hash_format_check" CHECK ("device_tokens"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "device_tokens_device_name_check" CHECK (char_length("device_tokens"."device_name") >= 1),
	CONSTRAINT "device_tokens_timestamps_check" CHECK ("device_tokens"."last_used_at" >= "device_tokens"."created_at" AND ("device_tokens"."revoked_at" IS NULL OR "device_tokens"."revoked_at" >= "device_tokens"."created_at"))
);
--> statement-breakpoint
CREATE TABLE "chat_request_receipts" (
	"device_id" uuid NOT NULL,
	"chat_request_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"model_id" varchar(100),
	"message" text,
	"status" varchar(16) NOT NULL,
	"retryable" boolean DEFAULT false NOT NULL,
	"lease_owner" uuid,
	"lease_generation" integer DEFAULT 1 NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"tool_receipts" jsonb,
	"tool_receipts_schema_version" integer,
	"final_response" text,
	"error_code" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_request_receipts_device_id_chat_request_id_pk" PRIMARY KEY("device_id","chat_request_id"),
	CONSTRAINT "chat_request_receipts_request_hash_format_check" CHECK ("chat_request_receipts"."request_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chat_request_receipts_status_check" CHECK ("chat_request_receipts"."status" in ('running', 'completed', 'failed', 'expired')),
	CONSTRAINT "chat_request_receipts_lease_generation_check" CHECK ("chat_request_receipts"."lease_generation" >= 1),
	CONSTRAINT "chat_request_receipts_attempt_count_check" CHECK ("chat_request_receipts"."attempt_count" >= 1),
	CONSTRAINT "chat_request_receipts_tool_receipts_schema_version_check" CHECK ("chat_request_receipts"."tool_receipts_schema_version" IS NULL OR "chat_request_receipts"."tool_receipts_schema_version" >= 1),
	CONSTRAINT "chat_request_receipts_tool_receipts_version_pair_check" CHECK (("chat_request_receipts"."tool_receipts" IS NULL) = ("chat_request_receipts"."tool_receipts_schema_version" IS NULL)),
	CONSTRAINT "chat_request_receipts_lease_check" CHECK (CASE WHEN "chat_request_receipts"."status" = 'running' THEN "chat_request_receipts"."lease_owner" IS NOT NULL AND "chat_request_receipts"."lease_expires_at" IS NOT NULL AND "chat_request_receipts"."heartbeat_at" IS NOT NULL AND "chat_request_receipts"."lease_expires_at" >= "chat_request_receipts"."heartbeat_at" AND "chat_request_receipts"."lease_expires_at" <= "chat_request_receipts"."heartbeat_at" + interval '30 seconds' ELSE "chat_request_receipts"."lease_owner" IS NULL AND "chat_request_receipts"."lease_expires_at" IS NULL AND "chat_request_receipts"."heartbeat_at" IS NULL END),
	CONSTRAINT "chat_request_receipts_terminal_state_check" CHECK (CASE WHEN "chat_request_receipts"."status" = 'running' THEN "chat_request_receipts"."model_id" IS NOT NULL AND "chat_request_receipts"."message" IS NOT NULL AND "chat_request_receipts"."final_response" IS NULL AND "chat_request_receipts"."error_code" IS NULL WHEN "chat_request_receipts"."status" = 'completed' THEN "chat_request_receipts"."final_response" IS NOT NULL AND "chat_request_receipts"."error_code" IS NULL AND "chat_request_receipts"."retryable" = false WHEN "chat_request_receipts"."status" = 'failed' THEN "chat_request_receipts"."final_response" IS NULL AND "chat_request_receipts"."error_code" IS NOT NULL WHEN "chat_request_receipts"."status" = 'expired' THEN "chat_request_receipts"."model_id" IS NULL AND "chat_request_receipts"."message" IS NULL AND "chat_request_receipts"."tool_receipts" IS NULL AND "chat_request_receipts"."final_response" IS NULL AND "chat_request_receipts"."error_code" IS NULL AND "chat_request_receipts"."retryable" = false ELSE false END)
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"device_id" uuid PRIMARY KEY NOT NULL,
	"messages" jsonb NOT NULL,
	"messages_schema_version" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_messages_schema_version_check" CHECK ("conversations"."messages_schema_version" >= 1),
	CONSTRAINT "conversations_messages_limit_check" CHECK (CASE WHEN jsonb_typeof("conversations"."messages" -> 'messages') = 'array' THEN jsonb_array_length("conversations"."messages" -> 'messages') <= 40 ELSE false END)
);
--> statement-breakpoint
CREATE TABLE "pending_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"chat_request_id" uuid NOT NULL,
	"tool_index" integer NOT NULL,
	"token_hash" text NOT NULL,
	"kind" varchar(32) NOT NULL,
	"state" varchar(16) NOT NULL,
	"draft_payload" jsonb NOT NULL,
	"draft_schema_version" integer NOT NULL,
	"target_resource_id" uuid,
	"target_version" bigint,
	"consumed_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"commit_action_id" uuid,
	"commit_request_hash" text,
	"result" jsonb,
	"result_schema_version" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_confirmations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "pending_confirmations_device_request_tool_unique" UNIQUE("device_id","chat_request_id","tool_index"),
	CONSTRAINT "pending_confirmations_token_hash_format_check" CHECK ("pending_confirmations"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "pending_confirmations_tool_index_check" CHECK ("pending_confirmations"."tool_index" >= 0),
	CONSTRAINT "pending_confirmations_kind_check" CHECK ("pending_confirmations"."kind" in ('recipe_batch', 'weekly_plan_replace')),
	CONSTRAINT "pending_confirmations_state_check" CHECK ("pending_confirmations"."state" in ('pending', 'expired', 'superseded', 'consumed')),
	CONSTRAINT "pending_confirmations_draft_schema_version_check" CHECK ("pending_confirmations"."draft_schema_version" >= 1),
	CONSTRAINT "pending_confirmations_result_version_pair_check" CHECK (("pending_confirmations"."result" IS NULL) = ("pending_confirmations"."result_schema_version" IS NULL)),
	CONSTRAINT "pending_confirmations_result_schema_version_check" CHECK ("pending_confirmations"."result_schema_version" IS NULL OR "pending_confirmations"."result_schema_version" >= 1),
	CONSTRAINT "pending_confirmations_expiry_check" CHECK ("pending_confirmations"."expires_at" >= "pending_confirmations"."created_at" AND "pending_confirmations"."expires_at" <= "pending_confirmations"."created_at" + interval '10 minutes'),
	CONSTRAINT "pending_confirmations_target_version_pair_check" CHECK (("pending_confirmations"."target_resource_id" IS NULL) = ("pending_confirmations"."target_version" IS NULL) AND ("pending_confirmations"."target_version" IS NULL OR "pending_confirmations"."target_version" >= 1)),
	CONSTRAINT "pending_confirmations_commit_pair_check" CHECK (("pending_confirmations"."commit_action_id" IS NULL) = ("pending_confirmations"."commit_request_hash" IS NULL)),
	CONSTRAINT "pending_confirmations_commit_request_hash_format_check" CHECK ("pending_confirmations"."commit_request_hash" IS NULL OR "pending_confirmations"."commit_request_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "pending_confirmations_state_timestamps_check" CHECK (CASE WHEN "pending_confirmations"."state" in ('pending', 'expired') THEN "pending_confirmations"."consumed_at" IS NULL AND "pending_confirmations"."superseded_at" IS NULL WHEN "pending_confirmations"."state" = 'superseded' THEN "pending_confirmations"."consumed_at" IS NULL AND "pending_confirmations"."superseded_at" IS NOT NULL WHEN "pending_confirmations"."state" = 'consumed' THEN "pending_confirmations"."consumed_at" IS NOT NULL AND "pending_confirmations"."superseded_at" IS NULL AND "pending_confirmations"."commit_action_id" IS NOT NULL AND "pending_confirmations"."result" IS NOT NULL ELSE false END)
);
--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekly_plan_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal_type" varchar(16) NOT NULL,
	"recipe_id" uuid NOT NULL,
	"recipe_name_snapshot" text NOT NULL,
	CONSTRAINT "plan_items_plan_date_meal_type_unique" UNIQUE("weekly_plan_id","date","meal_type"),
	CONSTRAINT "plan_items_meal_type_check" CHECK ("plan_items"."meal_type" in ('breakfast', 'lunch', 'dinner'))
);
--> statement-breakpoint
CREATE TABLE "weekly_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" date NOT NULL,
	"server_version" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_plans_week_start_unique" UNIQUE("week_start"),
	CONSTRAINT "weekly_plans_server_version_unique" UNIQUE("server_version"),
	CONSTRAINT "weekly_plans_week_start_monday_check" CHECK (extract(isodow from "weekly_plans"."week_start") = 1),
	CONSTRAINT "weekly_plans_server_version_positive_check" CHECK ("weekly_plans"."server_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"tags" text[] NOT NULL,
	"ingredients" text[] NOT NULL,
	"steps" text[] NOT NULL,
	"image_url" text,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"server_version" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_server_version_unique" UNIQUE("server_version"),
	CONSTRAINT "recipes_name_non_empty_check" CHECK (char_length("recipes"."name") >= 1),
	CONSTRAINT "recipes_server_version_positive_check" CHECK ("recipes"."server_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"value_schema_version" integer NOT NULL,
	"server_version" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_server_version_unique" UNIQUE("server_version"),
	CONSTRAINT "settings_key_check" CHECK ("settings"."key" = 'familyPreference'),
	CONSTRAINT "settings_value_schema_version_check" CHECK ("settings"."value_schema_version" >= 1),
	CONSTRAINT "settings_server_version_positive_check" CHECK ("settings"."server_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "sync_action_receipts" (
	"device_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"action_type" varchar(32) NOT NULL,
	"payload_hash" text NOT NULL,
	"status" varchar(16) NOT NULL,
	"result" jsonb NOT NULL,
	"result_schema_version" integer NOT NULL,
	"server_version" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_action_receipts_device_id_action_id_pk" PRIMARY KEY("device_id","action_id"),
	CONSTRAINT "sync_action_receipts_action_type_check" CHECK ("sync_action_receipts"."action_type" in ('recipe.patch', 'recipe.delete')),
	CONSTRAINT "sync_action_receipts_payload_hash_format_check" CHECK ("sync_action_receipts"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "sync_action_receipts_result_schema_version_check" CHECK ("sync_action_receipts"."result_schema_version" >= 1),
	CONSTRAINT "sync_action_receipts_status_check" CHECK ("sync_action_receipts"."status" in ('applied', 'rejected')),
	CONSTRAINT "sync_action_receipts_server_version_check" CHECK ("sync_action_receipts"."server_version" IS NULL OR "sync_action_receipts"."server_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "sync_changes" (
	"server_version" bigint PRIMARY KEY NOT NULL,
	"resource" varchar(32) NOT NULL,
	"resource_id" text NOT NULL,
	"operation" varchar(32) NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_schema_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_changes_server_version_positive_check" CHECK ("sync_changes"."server_version" >= 1),
	CONSTRAINT "sync_changes_payload_schema_version_check" CHECK ("sync_changes"."payload_schema_version" >= 1),
	CONSTRAINT "sync_changes_resource_operation_check" CHECK (("sync_changes"."resource", "sync_changes"."operation") in (('recipe', 'upsert'), ('recipe', 'delete'), ('weekly_plan', 'upsert'), ('settings', 'upsert'))),
	CONSTRAINT "sync_changes_payload_object_check" CHECK (jsonb_typeof("sync_changes"."payload") = 'object'),
	CONSTRAINT "sync_changes_resource_id_check" CHECK (CASE WHEN "sync_changes"."resource" = 'settings' THEN "sync_changes"."resource_id" = 'familyPreference' ELSE "sync_changes"."resource_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' END)
);
--> statement-breakpoint
ALTER TABLE "chat_request_receipts" ADD CONSTRAINT "chat_request_receipts_device_id_device_tokens_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_tokens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_device_id_device_tokens_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_tokens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_confirmations" ADD CONSTRAINT "pending_confirmations_device_id_device_tokens_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_tokens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_confirmations" ADD CONSTRAINT "pending_confirmations_chat_receipt_fk" FOREIGN KEY ("device_id","chat_request_id") REFERENCES "public"."chat_request_receipts"("device_id","chat_request_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_weekly_plan_id_weekly_plans_id_fk" FOREIGN KEY ("weekly_plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_action_receipts" ADD CONSTRAINT "sync_action_receipts_device_id_device_tokens_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_tokens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_request_receipts_device_status_lease_idx" ON "chat_request_receipts" USING btree ("device_id","status","lease_expires_at");--> statement-breakpoint
CREATE INDEX "pending_confirmations_device_kind_created_idx" ON "pending_confirmations" USING btree ("device_id","kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_confirmations_device_commit_action_idx" ON "pending_confirmations" USING btree ("device_id","commit_action_id") WHERE "pending_confirmations"."commit_action_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "plan_items_recipe_id_idx" ON "plan_items" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipes_deleted_at_idx" ON "recipes" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "sync_action_receipts_created_at_idx" ON "sync_action_receipts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sync_changes_resource_id_version_idx" ON "sync_changes" USING btree ("resource","resource_id","server_version" DESC NULLS LAST);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "assert_weekly_plan_slots"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_plan_id uuid;
  target_week_start date;
BEGIN
  IF TG_TABLE_NAME = 'weekly_plans' THEN
    target_plan_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    SELECT week_start INTO target_week_start FROM weekly_plans WHERE id = target_plan_id;
    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
    IF (SELECT count(*) FROM plan_items WHERE weekly_plan_id = target_plan_id) <> 21
      OR EXISTS (
        SELECT 1 FROM plan_items
        WHERE weekly_plan_id = target_plan_id
          AND (date < target_week_start OR date >= target_week_start + 7)
      ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'weekly_plans_complete_slots_check',
        MESSAGE = 'weekly plan must contain exactly 21 in-week meal slots';
    END IF;
  ELSE
    FOR target_plan_id IN
      SELECT DISTINCT candidate.plan_id
      FROM unnest(
        CASE
          WHEN TG_OP = 'UPDATE' THEN ARRAY[OLD.weekly_plan_id, NEW.weekly_plan_id]
          WHEN TG_OP = 'DELETE' THEN ARRAY[OLD.weekly_plan_id]
          ELSE ARRAY[NEW.weekly_plan_id]
        END
      ) AS candidate(plan_id)
    LOOP
      SELECT week_start INTO target_week_start FROM weekly_plans WHERE id = target_plan_id;
      IF NOT FOUND THEN
        CONTINUE;
      END IF;
      IF (SELECT count(*) FROM plan_items WHERE weekly_plan_id = target_plan_id) <> 21
        OR EXISTS (
          SELECT 1 FROM plan_items
          WHERE weekly_plan_id = target_plan_id
            AND (date < target_week_start OR date >= target_week_start + 7)
        ) THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          CONSTRAINT = 'weekly_plans_complete_slots_check',
          MESSAGE = 'weekly plan must contain exactly 21 in-week meal slots';
      END IF;
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "weekly_plans_complete_slots_check"
AFTER INSERT OR UPDATE OR DELETE ON "weekly_plans"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_weekly_plan_slots"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "plan_items_weekly_plan_range_check"
AFTER INSERT OR UPDATE OR DELETE ON "plan_items"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_weekly_plan_slots"();
