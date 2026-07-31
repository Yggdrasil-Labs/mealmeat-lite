package io.yggdrasil.labs.mealmate.lite.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "chat_draft")
data class ChatDraftEntity(
    @PrimaryKey val singletonId: Int = SINGLETON_ID,
    val text: String,
) {
    init {
        require(singletonId == SINGLETON_ID) { "chat_draft must use the singleton id" }
    }

    companion object {
        const val SINGLETON_ID = 0
    }
}
