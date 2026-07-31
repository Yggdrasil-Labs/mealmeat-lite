package io.yggdrasil.labs.mealmate.lite.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "settings_cache")
data class SettingsCacheEntity(
    @PrimaryKey val key: String,
    val value: String,
)
