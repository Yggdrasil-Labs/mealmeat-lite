package io.yggdrasil.labs.mealmate.lite.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "conversation_messages")
data class ConversationMessageEntity(
    @PrimaryKey(autoGenerate = true) val localSequence: Long = 0,
    val role: String,
    val content: String,
    val createdAt: String,
)
