package io.yggdrasil.labs.mealmate.lite.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import io.yggdrasil.labs.mealmate.lite.data.local.dao.ContractCacheDao
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ChatDraftEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ConversationMessageEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionState
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PlanItemEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.RecipeEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SettingsCacheEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncFailureEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncStateEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.WeeklyPlanEntity

/**
 * Room database boundary for the nine local business tables.
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
    ],
    version = 1,
    exportSchema = false,
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
}
