CREATE SEQUENCE "sync_server_version_seq" AS bigint START WITH 1 INCREMENT BY 1;
--> statement-breakpoint
CREATE TABLE "auth_attempt_throttles" (
	"scope" varchar(40) NOT NULL,
	"source_key_hash" text NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_attempt_throttles_scope_source_key_hash_pk" PRIMARY KEY("scope","source_key_hash"),
	CONSTRAINT "auth_attempt_throttles_failure_count_check" CHECK ("auth_attempt_throttles"."failure_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "auth_config" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"bootstrap_secret_hash" text NOT NULL,
	"family_code_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_config_singleton_check" CHECK ("auth_config"."singleton" = true)
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"device_name" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "device_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "chat_request_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"chat_request_id" uuid NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"lease_expires_at" timestamp with time zone NOT NULL,
	"tool_receipts" jsonb,
	"tool_receipts_schema_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_request_receipts_device_request_unique" UNIQUE("device_id","chat_request_id"),
	CONSTRAINT "chat_request_receipts_tool_receipts_schema_version_check" CHECK ("chat_request_receipts"."tool_receipts_schema_version" IS NULL OR "chat_request_receipts"."tool_receipts_schema_version" >= 1),
	CONSTRAINT "chat_request_receipts_tool_receipts_version_pair_check" CHECK (("chat_request_receipts"."tool_receipts" IS NULL) = ("chat_request_receipts"."tool_receipts_schema_version" IS NULL)),
	CONSTRAINT "chat_request_receipts_lease_check" CHECK ("chat_request_receipts"."lease_expires_at" >= "chat_request_receipts"."created_at" AND "chat_request_receipts"."lease_expires_at" <= "chat_request_receipts"."created_at" + interval '30 seconds')
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"device_id" uuid PRIMARY KEY NOT NULL,
	"messages" jsonb NOT NULL,
	"messages_schema_version" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_messages_schema_version_check" CHECK ("conversations"."messages_schema_version" >= 1),
	CONSTRAINT "conversations_messages_limit_check" CHECK (jsonb_array_length("conversations"."messages") <= 40)
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
	"result" jsonb,
	"result_schema_version" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_confirmations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "pending_confirmations_device_request_tool_unique" UNIQUE("device_id","chat_request_id","tool_index"),
	CONSTRAINT "pending_confirmations_draft_schema_version_check" CHECK ("pending_confirmations"."draft_schema_version" >= 1),
	CONSTRAINT "pending_confirmations_result_version_pair_check" CHECK (("pending_confirmations"."result" IS NULL) = ("pending_confirmations"."result_schema_version" IS NULL)),
	CONSTRAINT "pending_confirmations_result_schema_version_check" CHECK ("pending_confirmations"."result_schema_version" IS NULL OR "pending_confirmations"."result_schema_version" >= 1),
	CONSTRAINT "pending_confirmations_expiry_check" CHECK ("pending_confirmations"."expires_at" <= "pending_confirmations"."created_at" + interval '10 minutes')
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
	CONSTRAINT "weekly_plans_week_start_monday_check" CHECK (extract(isodow from "weekly_plans"."week_start") = 1)
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
	CONSTRAINT "recipes_name_non_empty_check" CHECK (char_length("recipes"."name") >= 1)
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
	CONSTRAINT "settings_value_schema_version_check" CHECK ("settings"."value_schema_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "sync_action_receipts" (
	"device_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"status" varchar(16) NOT NULL,
	"result" jsonb NOT NULL,
	"result_schema_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_action_receipts_device_id_action_id_pk" PRIMARY KEY("device_id","action_id"),
	CONSTRAINT "sync_action_receipts_result_schema_version_check" CHECK ("sync_action_receipts"."result_schema_version" >= 1),
	CONSTRAINT "sync_action_receipts_status_check" CHECK ("sync_action_receipts"."status" in ('applied', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "sync_changes" (
	"server_version" bigint PRIMARY KEY NOT NULL,
	"resource" varchar(32) NOT NULL,
	"operation" varchar(32) NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_schema_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_changes_payload_schema_version_check" CHECK ("sync_changes"."payload_schema_version" >= 1),
	CONSTRAINT "sync_changes_resource_operation_check" CHECK (("sync_changes"."resource", "sync_changes"."operation") in (('recipe', 'upsert'), ('recipe', 'delete'), ('weekly_plan', 'upsert'), ('settings', 'upsert')))
);
--> statement-breakpoint
ALTER TABLE "chat_request_receipts" ADD CONSTRAINT "chat_request_receipts_device_id_device_tokens_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_tokens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_device_id_device_tokens_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_tokens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_confirmations" ADD CONSTRAINT "pending_confirmations_device_id_device_tokens_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_tokens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_confirmations" ADD CONSTRAINT "pending_confirmations_chat_receipt_fk" FOREIGN KEY ("device_id","chat_request_id") REFERENCES "public"."chat_request_receipts"("device_id","chat_request_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_weekly_plan_id_weekly_plans_id_fk" FOREIGN KEY ("weekly_plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_action_receipts" ADD CONSTRAINT "sync_action_receipts_device_id_device_tokens_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_tokens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_items_recipe_id_idx" ON "plan_items" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipes_deleted_at_idx" ON "recipes" USING btree ("deleted_at");