package io.yggdrasil.labs.mealmate.lite.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "plan_items",
    foreignKeys = [
        ForeignKey(
            entity = WeeklyPlanEntity::class,
            parentColumns = ["id"],
            childColumns = ["weeklyPlanId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("weeklyPlanId"), Index(value = ["weeklyPlanId", "date", "mealType"], unique = true)],
)
data class PlanItemEntity(
    @PrimaryKey val id: String,
    val weeklyPlanId: String,
    val date: String,
    val mealType: String,
    val recipeId: String,
    val recipeNameSnapshot: String,
)
