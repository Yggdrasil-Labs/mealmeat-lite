import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { GenericContainer, Wait } from 'testcontainers'
import { describe, expect, it } from 'vitest'
import { resolveMigrationsFolder } from './migration-folder.js'

describe('v0.1 migration', () => {
  it('is applied against PostgreSQL 16 by the integration environment', async () => {
    const container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'mealmate',
        POSTGRES_PASSWORD: 'test',
        POSTGRES_USER: 'mealmate',
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forAll([
          Wait.forListeningPorts(),
          Wait.forLogMessage(/database system is ready to accept connections/, 2),
        ]),
      )
      .start()
    const client = postgres({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: 'mealmate',
      password: 'test',
      database: 'mealmate',
    })
    try {
      await migrate(drizzle(client), {
        migrationsFolder: await resolveMigrationsFolder(
          fileURLToPath(new URL('./migrations/', import.meta.url)),
        ),
      })
      await expect(
        migrate(drizzle(client), {
          migrationsFolder: await resolveMigrationsFolder(
            fileURLToPath(new URL('./migrations/', import.meta.url)),
          ),
        }),
      ).resolves.toBeUndefined()
      const tables = await client<{ table_name: string }[]>`
        select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name
      `
      expect(tables.map((table) => table.table_name)).toEqual([
        'auth_attempt_throttles',
        'auth_config',
        'chat_request_receipts',
        'conversations',
        'device_tokens',
        'pending_confirmations',
        'plan_items',
        'recipes',
        'settings',
        'sync_action_receipts',
        'sync_changes',
        'weekly_plans',
      ])
      const jsonbCarriers = await client<{ carrier: string }[]>`
        select concat(table_name, '.', column_name) as carrier from information_schema.columns
        where table_schema = 'public' and data_type = 'jsonb'
        order by carrier
      `
      expect(jsonbCarriers.map((row) => row.carrier)).toEqual([
        'chat_request_receipts.tool_receipts',
        'conversations.messages',
        'pending_confirmations.draft_payload',
        'pending_confirmations.result',
        'settings.value',
        'sync_action_receipts.result',
        'sync_changes.payload',
      ])
      const constraints = await client<{ conname: string }[]>`
        select conname from pg_constraint
        where connamespace = 'public'::regnamespace and contype in ('c', 'f', 'u')
        order by conname
      `
      expect(constraints.map((row) => row.conname)).toEqual([
        'auth_attempt_throttles_failure_count_check',
        'auth_attempt_throttles_source_key_hash_format_check',
        'auth_config_bootstrap_secret_hash_format_check',
        'auth_config_family_code_hash_format_check',
        'auth_config_singleton_check',
        'chat_request_receipts_device_id_device_tokens_id_fk',
        'chat_request_receipts_device_request_unique',
        'chat_request_receipts_generation_check',
        'chat_request_receipts_lease_check',
        'chat_request_receipts_tool_receipts_schema_version_check',
        'chat_request_receipts_tool_receipts_version_pair_check',
        'conversations_device_id_device_tokens_id_fk',
        'conversations_messages_limit_check',
        'conversations_messages_schema_version_check',
        'device_tokens_token_hash_format_check',
        'device_tokens_token_hash_unique',
        'pending_confirmations_chat_receipt_fk',
        'pending_confirmations_device_id_device_tokens_id_fk',
        'pending_confirmations_device_request_tool_unique',
        'pending_confirmations_draft_schema_version_check',
        'pending_confirmations_expiry_check',
        'pending_confirmations_result_schema_version_check',
        'pending_confirmations_result_version_pair_check',
        'pending_confirmations_token_hash_format_check',
        'pending_confirmations_token_hash_unique',
        'pending_confirmations_tool_index_check',
        'plan_items_meal_type_check',
        'plan_items_plan_date_meal_type_unique',
        'plan_items_recipe_id_recipes_id_fk',
        'plan_items_weekly_plan_id_weekly_plans_id_fk',
        'recipes_name_non_empty_check',
        'recipes_server_version_positive_check',
        'recipes_server_version_unique',
        'settings_key_check',
        'settings_server_version_positive_check',
        'settings_server_version_unique',
        'settings_value_schema_version_check',
        'sync_action_receipts_device_id_device_tokens_id_fk',
        'sync_action_receipts_result_schema_version_check',
        'sync_action_receipts_status_check',
        'sync_changes_payload_schema_version_check',
        'sync_changes_resource_operation_check',
        'sync_changes_server_version_positive_check',
        'weekly_plans_server_version_positive_check',
        'weekly_plans_server_version_unique',
        'weekly_plans_week_start_monday_check',
        'weekly_plans_week_start_unique',
      ])
      const primaryKeys = await client<{ conname: string }[]>`
        select conname from pg_constraint
        where connamespace = 'public'::regnamespace and contype = 'p'
        order by conname
      `
      expect(primaryKeys.map((row) => row.conname)).toEqual([
        'auth_attempt_throttles_scope_source_key_hash_pk',
        'auth_config_pkey',
        'chat_request_receipts_pkey',
        'conversations_pkey',
        'device_tokens_pkey',
        'pending_confirmations_pkey',
        'plan_items_pkey',
        'recipes_pkey',
        'settings_pkey',
        'sync_action_receipts_device_id_action_id_pk',
        'sync_changes_pkey',
        'weekly_plans_pkey',
      ])
      const constraintTriggers = await client<{ conname: string }[]>`
        select conname from pg_constraint
        where connamespace = 'public'::regnamespace and contype = 't'
        order by conname
      `
      expect(constraintTriggers.map((row) => row.conname)).toEqual([
        'plan_items_weekly_plan_range_check',
        'weekly_plans_complete_slots_check',
      ])
      const indexes = await client<{ indexname: string }[]>`
        select indexname from pg_indexes
        where schemaname = 'public' and right(indexname, 4) = '_idx'
        order by indexname
      `
      expect(indexes.map((row) => row.indexname)).toEqual([
        'plan_items_recipe_id_idx',
        'recipes_deleted_at_idx',
      ])

      const acceptedConversationDeviceId = '0f23bcb0-3f6f-47a4-9c5f-e4ece9bf3001'
      const rejectedConversationDeviceId = '0f23bcb0-3f6f-47a4-9c5f-e4ece9bf3002'
      const overLimitConversationDeviceId = '0f23bcb0-3f6f-47a4-9c5f-e4ece9bf3003'
      const emptyEnvelopeConversationDeviceId = '0f23bcb0-3f6f-47a4-9c5f-e4ece9bf3004'
      const nullEnvelopeConversationDeviceId = '0f23bcb0-3f6f-47a4-9c5f-e4ece9bf3005'
      await client`
        insert into device_tokens (id, token_hash, device_name)
        values
          (${acceptedConversationDeviceId}::uuid, repeat('a', 64), 'migration-test'),
          (${rejectedConversationDeviceId}::uuid, repeat('b', 64), 'migration-test'),
          (${overLimitConversationDeviceId}::uuid, repeat('c', 64), 'migration-test'),
          (${emptyEnvelopeConversationDeviceId}::uuid, repeat('d', 64), 'migration-test'),
          (${nullEnvelopeConversationDeviceId}::uuid, repeat('e', 64), 'migration-test')
      `
      await expect(client`
        insert into conversations (device_id, messages, messages_schema_version)
        values (${acceptedConversationDeviceId}::uuid, ${JSON.stringify({ messages: [] })}::jsonb, 1)
      `).resolves.toBeDefined()
      await expect(client`
        insert into conversations (device_id, messages, messages_schema_version)
        values (${rejectedConversationDeviceId}::uuid, '[]'::jsonb, 1)
      `).rejects.toThrow('conversations_messages_limit_check')
      await expect(client`
        insert into conversations (device_id, messages, messages_schema_version)
        values (${overLimitConversationDeviceId}::uuid, ${JSON.stringify({ messages: Array.from({ length: 41 }, () => ({})) })}::jsonb, 1)
      `).rejects.toThrow('conversations_messages_limit_check')
      await expect(client`
        insert into conversations (device_id, messages, messages_schema_version)
        values (${emptyEnvelopeConversationDeviceId}::uuid, '{}'::jsonb, 1)
      `).rejects.toThrow('conversations_messages_limit_check')
      await expect(client`
        insert into conversations (device_id, messages, messages_schema_version)
        values (${nullEnvelopeConversationDeviceId}::uuid, '{"messages": null}'::jsonb, 1)
      `).rejects.toThrow('conversations_messages_limit_check')

      const pendingChatRequestId = 'c4b3ad2e-ef4c-420d-b67c-474b4f33fa7e'
      await client`
        insert into chat_request_receipts (device_id, chat_request_id, lease_expires_at, tool_receipts, tool_receipts_schema_version)
        values (${acceptedConversationDeviceId}::uuid, ${pendingChatRequestId}::uuid, now() + interval '10 seconds', '{}'::jsonb, 1)
      `
      await client`
        insert into pending_confirmations (device_id, chat_request_id, tool_index, token_hash, kind, state, draft_payload, draft_schema_version, result, result_schema_version, expires_at)
        values (${acceptedConversationDeviceId}::uuid, ${pendingChatRequestId}::uuid, 0, repeat('f', 64), 'recipe', 'pending', '{}'::jsonb, 1, '{}'::jsonb, 1, now() + interval '5 minutes')
      `
      await client`
        insert into settings (key, value, value_schema_version, server_version)
        values ('familyPreference', '{}'::jsonb, 1, 1)
      `
      await client`
        insert into sync_action_receipts (device_id, action_id, status, result, result_schema_version)
        values (${acceptedConversationDeviceId}::uuid, 'd4b3ad2e-ef4c-420d-b67c-474b4f33fa7e'::uuid, 'applied', '{}'::jsonb, 1)
      `
      await client`
        insert into sync_changes (server_version, resource, operation, payload, payload_schema_version)
        values (1, 'recipe', 'upsert', '{}'::jsonb, 1)
      `

      const jsonbConstraintCases: ReadonlyArray<{
        readonly carrier: string
        readonly insert: () => Promise<unknown>
        readonly constraint: string
      }> = [
        {
          carrier: 'conversations.messages',
          insert: () => client`
            insert into conversations (device_id, messages, messages_schema_version)
            values (${nullEnvelopeConversationDeviceId}::uuid, '{"messages": []}'::jsonb, 0)
          `,
          constraint: 'conversations_messages_schema_version_check',
        },
        {
          carrier: 'chat_request_receipts.tool_receipts',
          insert: () => client`
            insert into chat_request_receipts (device_id, chat_request_id, generation, lease_expires_at, tool_receipts, tool_receipts_schema_version)
            values (${acceptedConversationDeviceId}::uuid, 'e4b3ad2e-ef4c-420d-b67c-474b4f33fa7e'::uuid, 1, now() + interval '10 seconds', '{}'::jsonb, 0)
          `,
          constraint: 'chat_request_receipts_tool_receipts_schema_version_check',
        },
        {
          carrier: 'chat_request_receipts.tool_receipts nullable pair',
          insert: () => client`
            insert into chat_request_receipts (device_id, chat_request_id, generation, lease_expires_at, tool_receipts_schema_version)
            values (${acceptedConversationDeviceId}::uuid, '04b3ad2e-ef4c-420d-b67c-474b4f33fa7e'::uuid, 1, now() + interval '10 seconds', 1)
          `,
          constraint: 'chat_request_receipts_tool_receipts_version_pair_check',
        },
        {
          carrier: 'pending_confirmations.draft_payload',
          insert: () => client`
            insert into pending_confirmations (device_id, chat_request_id, tool_index, token_hash, kind, state, draft_payload, draft_schema_version, expires_at)
            values (${acceptedConversationDeviceId}::uuid, ${pendingChatRequestId}::uuid, 1, repeat('0', 64), 'recipe', 'pending', '{}'::jsonb, 0, now() + interval '5 minutes')
          `,
          constraint: 'pending_confirmations_draft_schema_version_check',
        },
        {
          carrier: 'pending_confirmations.result',
          insert: () => client`
            insert into pending_confirmations (device_id, chat_request_id, tool_index, token_hash, kind, state, draft_payload, draft_schema_version, result, expires_at)
            values (${acceptedConversationDeviceId}::uuid, ${pendingChatRequestId}::uuid, 2, repeat('1', 64), 'recipe', 'pending', '{}'::jsonb, 1, '{}'::jsonb, now() + interval '5 minutes')
          `,
          constraint: 'pending_confirmations_result_version_pair_check',
        },
        {
          carrier: 'settings.value',
          insert: () => client`
            insert into settings (key, value, value_schema_version, server_version)
            values ('familyPreference', '{}'::jsonb, 0, 2)
          `,
          constraint: 'settings_value_schema_version_check',
        },
        {
          carrier: 'sync_action_receipts.result',
          insert: () => client`
            insert into sync_action_receipts (device_id, action_id, status, result, result_schema_version)
            values (${acceptedConversationDeviceId}::uuid, 'f4b3ad2e-ef4c-420d-b67c-474b4f33fa7e'::uuid, 'applied', '{}'::jsonb, 0)
          `,
          constraint: 'sync_action_receipts_result_schema_version_check',
        },
        {
          carrier: 'sync_changes.payload',
          insert: () => client`
            insert into sync_changes (server_version, resource, operation, payload, payload_schema_version)
            values (2, 'recipe', 'upsert', '{}'::jsonb, 0)
          `,
          constraint: 'sync_changes_payload_schema_version_check',
        },
      ]
      for (const testCase of jsonbConstraintCases) {
        await expect(testCase.insert(), testCase.carrier).rejects.toThrow(testCase.constraint)
      }

      await expect(client`
        insert into device_tokens (id, token_hash, device_name)
        values ('1f23bcb0-3f6f-47a4-9c5f-e4ece9bf3001'::uuid, 'plaintext', 'invalid-token')
      `).rejects.toThrow('device_tokens_token_hash_format_check')
      await expect(client`
        insert into auth_config (bootstrap_secret_hash, family_code_hash)
        values ('plaintext', 'plaintext')
      `).rejects.toThrow('auth_config_bootstrap_secret_hash_format_check')
      await expect(client`
        insert into auth_config (bootstrap_secret_hash, family_code_hash)
        values ('$argon2id$v=19$', '$argon2id$v=19$')
      `).rejects.toThrow('auth_config_bootstrap_secret_hash_format_check')
      await expect(client`
        insert into auth_config (bootstrap_secret_hash, family_code_hash)
        values (
          '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA==$aGFzaA==',
          '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA==$aGFzaA=='
        )
      `).resolves.toBeDefined()
      await expect(client`
        insert into auth_attempt_throttles (scope, source_key_hash)
        values ('migration-test', 'plaintext')
      `).rejects.toThrow('auth_attempt_throttles_source_key_hash_format_check')
      await expect(client`
        insert into chat_request_receipts (device_id, chat_request_id, generation, lease_expires_at)
        values (${acceptedConversationDeviceId}::uuid, '14b3ad2e-ef4c-420d-b67c-474b4f33fa7e'::uuid, 0, now() + interval '10 seconds')
      `).rejects.toThrow('chat_request_receipts_generation_check')
      await expect(client`
        insert into pending_confirmations (device_id, chat_request_id, tool_index, token_hash, kind, state, draft_payload, draft_schema_version, expires_at)
        values (${acceptedConversationDeviceId}::uuid, ${pendingChatRequestId}::uuid, 3, 'plaintext', 'recipe', 'pending', '{}'::jsonb, 1, now() + interval '5 minutes')
      `).rejects.toThrow('pending_confirmations_token_hash_format_check')
      await expect(client`
        insert into pending_confirmations (device_id, chat_request_id, tool_index, token_hash, kind, state, draft_payload, draft_schema_version, expires_at, created_at)
        values (${acceptedConversationDeviceId}::uuid, ${pendingChatRequestId}::uuid, 3, repeat('2', 64), 'recipe', 'pending', '{}'::jsonb, 1, '2026-07-26T00:00:00Z', '2026-07-26T00:01:00Z')
      `).rejects.toThrow('pending_confirmations_expiry_check')
      await expect(client`
        insert into pending_confirmations (device_id, chat_request_id, tool_index, token_hash, kind, state, draft_payload, draft_schema_version, expires_at, created_at)
        values (${acceptedConversationDeviceId}::uuid, ${pendingChatRequestId}::uuid, 4, repeat('3', 64), 'recipe', 'pending', '{}'::jsonb, 1, '2026-07-26T00:11:00Z', '2026-07-26T00:00:00Z')
      `).rejects.toThrow('pending_confirmations_expiry_check')

      const validWeeklyPlanId = '24b3ad2e-ef4c-420d-b67c-474b4f33fa7e'
      const validWeeklyRecipeId = '34b3ad2e-ef4c-420d-b67c-474b4f33fa7e'
      await expect(
        client.begin(async (tx) => {
          await tx`
          insert into recipes (id, name, tags, ingredients, steps, server_version)
          values (${validWeeklyRecipeId}::uuid, 'weekly-plan recipe', '{}', '{}', '{}', 3)
        `
          await tx`
          insert into weekly_plans (id, week_start, server_version)
          values (${validWeeklyPlanId}::uuid, '2026-07-27', 4)
        `
          await tx`
          insert into plan_items (weekly_plan_id, date, meal_type, recipe_id, recipe_name_snapshot)
          select ${validWeeklyPlanId}::uuid, '2026-07-27'::date + day_offset, meal_type, ${validWeeklyRecipeId}::uuid, 'weekly-plan recipe'
          from generate_series(0, 6) as day_offset
          cross join unnest(array['breakfast', 'lunch', 'dinner']) as meal_type
        `
        }),
      ).resolves.toBeUndefined()

      const secondWeeklyPlanId = '54b3ad2e-ef4c-420d-b67c-474b4f33fa7e'
      await client.begin(async (tx) => {
        await tx`
          insert into weekly_plans (id, week_start, server_version)
          values (${secondWeeklyPlanId}::uuid, '2026-08-03', 6)
        `
        await tx`
          insert into plan_items (weekly_plan_id, date, meal_type, recipe_id, recipe_name_snapshot)
          select ${secondWeeklyPlanId}::uuid, '2026-08-03'::date + day_offset, meal_type, ${validWeeklyRecipeId}::uuid, 'weekly-plan recipe'
          from generate_series(0, 6) as day_offset
          cross join unnest(array['breakfast', 'lunch', 'dinner']) as meal_type
        `
      })
      await expect(
        client.begin(async (tx) => {
          await tx`
            delete from plan_items
            where weekly_plan_id = ${secondWeeklyPlanId}::uuid
              and date = '2026-08-09'
              and meal_type = 'dinner'
          `
          await tx`
            update plan_items
            set weekly_plan_id = ${secondWeeklyPlanId}::uuid
            where weekly_plan_id = ${validWeeklyPlanId}::uuid
              and date = '2026-08-02'
              and meal_type = 'dinner'
          `
        }),
      ).rejects.toMatchObject({ constraint_name: 'weekly_plans_complete_slots_check' })

      const invalidWeeklyPlanId = '44b3ad2e-ef4c-420d-b67c-474b4f33fa7e'
      await expect(
        client.begin(async (tx) => {
          await tx`
            insert into weekly_plans (id, week_start, server_version)
            values (${invalidWeeklyPlanId}::uuid, '2026-08-10', 5)
        `
          await tx`
          insert into plan_items (weekly_plan_id, date, meal_type, recipe_id, recipe_name_snapshot)
          select
            ${invalidWeeklyPlanId}::uuid,
            case when day_offset = 6 and meal_type = 'dinner' then '2026-08-17'::date else '2026-08-10'::date + day_offset end,
            meal_type,
            ${validWeeklyRecipeId}::uuid,
            'weekly-plan recipe'
          from generate_series(0, 6) as day_offset
          cross join unnest(array['breakfast', 'lunch', 'dinner']) as meal_type
        `
        }),
      ).rejects.toMatchObject({ constraint_name: 'weekly_plans_complete_slots_check' })

      await client`delete from weekly_plans where id = ${secondWeeklyPlanId}::uuid`
      const deletedPlans = await client<{ count: string }[]>`
        select count(*) as count from weekly_plans where id = ${secondWeeklyPlanId}::uuid
      `
      expect(deletedPlans[0]?.count).toBe('0')

      await expect(client`
        insert into recipes (name, tags, ingredients, steps, server_version)
        values ('non-positive recipe version', '{}', '{}', '{}', 0)
      `).rejects.toThrow('recipes_server_version_positive_check')
      await expect(client`
        insert into weekly_plans (week_start, server_version)
        values ('2026-07-27', 0)
      `).rejects.toThrow('weekly_plans_server_version_positive_check')
      await expect(client`
        insert into settings (key, value, value_schema_version, server_version)
        values ('familyPreference', '{}'::jsonb, 1, 0)
      `).rejects.toThrow('settings_server_version_positive_check')
      await expect(client`
        insert into sync_changes (server_version, resource, operation, payload, payload_schema_version)
        values (0, 'recipe', 'upsert', '{}'::jsonb, 1)
      `).rejects.toThrow('sync_changes_server_version_positive_check')
    } finally {
      await client.end()
      await container.stop()
    }
  })
})
