package io.yggdrasil.labs.mealmate.lite.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "recipes")
data class RecipeEntity(
    @PrimaryKey val id: String,
    val name: String,
    val tagsJson: String,
    val ingredientsJson: String,
    val stepsJson: String,
    val serverVersion: String,
    val createdAt: String,
    val updatedAt: String,
    val imageUrl: String?,
    val notes: String?,
    val deletedAt: String? = null,
)
