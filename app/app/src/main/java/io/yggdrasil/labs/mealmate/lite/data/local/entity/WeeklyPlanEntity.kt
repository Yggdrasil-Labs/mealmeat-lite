package io.yggdrasil.labs.mealmate.lite.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "weekly_plans", indices = [Index(value = ["weekStart"], unique = true)])
data class WeeklyPlanEntity(
    @PrimaryKey val id: String,
    val weekStart: String,
    val serverVersion: String,
    val createdAt: String,
    val updatedAt: String,
)
