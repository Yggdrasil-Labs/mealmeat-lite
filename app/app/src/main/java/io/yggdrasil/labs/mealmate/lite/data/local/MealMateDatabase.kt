package io.yggdrasil.labs.mealmate.lite.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import io.yggdrasil.labs.mealmate.lite.data.local.dao.ContractCacheDao
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ChatDraftEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ClientSessionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ClientSessionState
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ConversationMessageEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionState
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PlanItemEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.RecipeEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ReplicaVersionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SettingsCacheEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncCursorPhase
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncDiagnosticEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncDiagnosticKind
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncFailureEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncStateEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.WeeklyPlanEntity

/**
 * Room database boundary for nine business tables plus local coordination metadata.
 * Source: https://developer.android.com/training/data-storage/room/defining-data
 */
@Database(
    entities = [
        RecipeEntity::class,
        WeeklyPlanEntity::class,
        PlanItemEntity::class,
        SettingsCacheEntity::class,
        ConversationMessageEntity::class,
        PendingActionEntity::class,
        SyncFailureEntity::class,
        SyncStateEntity::class,
        ChatDraftEntity::class,
        ClientSessionEntity::class,
        ReplicaVersionEntity::class,
        SyncDiagnosticEntity::class,
    ],
    version = 2,
    exportSchema = true,
)
@TypeConverters(MealMateRoomConverters::class)
abstract class MealMateDatabase : RoomDatabase() {
    abstract fun contractCacheDao(): ContractCacheDao
}

class MealMateRoomConverters {
    @TypeConverter
    fun pendingActionStateToString(value: PendingActionState): String = value.name

    @TypeConverter
    fun pendingActionStateFromString(value: String): PendingActionState = PendingActionState.valueOf(value)

    @TypeConverter
    fun clientSessionStateToString(value: ClientSessionState): String = value.name.lowercase()

    @TypeConverter
    fun clientSessionStateFromString(value: String): ClientSessionState = ClientSessionState.valueOf(value.uppercase())

    @TypeConverter
    fun syncDiagnosticKindToString(value: SyncDiagnosticKind): String = value.name.lowercase()

    @TypeConverter
    fun syncDiagnosticKindFromString(value: String): SyncDiagnosticKind = SyncDiagnosticKind.valueOf(value.uppercase())

    @TypeConverter
    fun syncCursorPhaseToString(value: SyncCursorPhase): String = value.name.lowercase()

    @TypeConverter
    fun syncCursorPhaseFromString(value: String): SyncCursorPhase = SyncCursorPhase.valueOf(value.uppercase())
}

/**
 * Preserves all v1 business data while adding local session/sync metadata.
 * Source: https://developer.android.com/training/data-storage/room/migrating-db-versions
 */
val MIGRATION_1_2 =
    object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE `sync_state` ADD COLUMN `phase` TEXT")
            db.execSQL("ALTER TABLE `sync_state` ADD COLUMN `lastResource` TEXT")
            db.execSQL("ALTER TABLE `sync_state` ADD COLUMN `lastResourceId` TEXT")
            db.execSQL("ALTER TABLE `sync_state` ADD COLUMN `lastServerVersion` TEXT")
            // A v1 cursor has no persisted phase/boundary metadata. It cannot be resumed
            // safely under v2 ordering checks, so restart from a signed full snapshot.
            db.execSQL("UPDATE `sync_state` SET `cursor` = NULL")
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `client_session` (
                    `singletonId` INTEGER NOT NULL,
                    `sessionId` TEXT NOT NULL,
                    `sessionGeneration` INTEGER NOT NULL,
                    `state` TEXT NOT NULL CHECK (`state` IN ('switching', 'provisioning', 'active')),
                    `selectedModelId` TEXT,
                    PRIMARY KEY(`singletonId`),
                    CHECK (`singletonId` = 0),
                    CHECK (`state` != 'active' OR (`selectedModelId` IS NOT NULL AND length(`selectedModelId`) > 0))
                )
                """.trimIndent(),
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `replica_versions` (
                    `resource` TEXT NOT NULL,
                    `resourceId` TEXT NOT NULL,
                    `serverVersion` TEXT NOT NULL,
                    PRIMARY KEY(`resource`, `resourceId`)
                )
                """.trimIndent(),
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `sync_diagnostics` (
                    `diagnosticId` TEXT NOT NULL,
                    `sessionId` TEXT NOT NULL,
                    `sessionGeneration` INTEGER NOT NULL,
                    `kind` TEXT NOT NULL CHECK (`kind` IN ('cursor', 'protocol')),
                    `errorCode` TEXT NOT NULL,
                    `message` TEXT NOT NULL,
                    `resource` TEXT,
                    `createdAt` TEXT NOT NULL,
                    PRIMARY KEY(`diagnosticId`)
                )
                """.trimIndent(),
            )

            // v1 settings rows have no authoritative version metadata, so they deliberately
            // receive their baseline from the next full snapshot instead of guessing a version.
            db.execSQL(
                """
                INSERT OR IGNORE INTO `replica_versions` (`resource`, `resourceId`, `serverVersion`)
                SELECT 'recipe', `id`, `serverVersion` FROM `recipes`
                WHERE `serverVersion` != ''
                    AND `serverVersion` NOT GLOB '*[^0-9]*'
                    AND `serverVersion` != '0'
                    AND substr(`serverVersion`, 1, 1) != '0'
                    AND (length(`serverVersion`) < 19 OR
                        (length(`serverVersion`) = 19 AND `serverVersion` <= '9223372036854775807'))
                """.trimIndent(),
            )
            db.execSQL(
                """
                INSERT OR IGNORE INTO `replica_versions` (`resource`, `resourceId`, `serverVersion`)
                SELECT 'weekly_plan', `id`, `serverVersion` FROM `weekly_plans`
                WHERE `serverVersion` != ''
                    AND `serverVersion` NOT GLOB '*[^0-9]*'
                    AND `serverVersion` != '0'
                    AND substr(`serverVersion`, 1, 1) != '0'
                    AND (length(`serverVersion`) < 19 OR
                        (length(`serverVersion`) = 19 AND `serverVersion` <= '9223372036854775807'))
                """.trimIndent(),
            )
        }
    }
