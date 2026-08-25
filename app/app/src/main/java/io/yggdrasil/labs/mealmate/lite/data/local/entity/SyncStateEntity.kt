package io.yggdrasil.labs.mealmate.lite.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sync_state")
data class SyncStateEntity(
    @PrimaryKey val singletonId: Int = SINGLETON_ID,
    val cursor: String?,
    val phase: SyncCursorPhase? = null,
    val lastResource: String? = null,
    val lastResourceId: String? = null,
    val lastServerVersion: String? = null,
) {
    init {
        require(singletonId == SINGLETON_ID) { "sync_state must use the singleton id" }
    }

    companion object {
        const val SINGLETON_ID = 0
    }
}

enum class SyncCursorPhase {
    SNAPSHOT,
    INCREMENTAL,
}
