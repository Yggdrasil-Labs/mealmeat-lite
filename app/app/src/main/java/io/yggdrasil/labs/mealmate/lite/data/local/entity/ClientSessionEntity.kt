package io.yggdrasil.labs.mealmate.lite.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class ClientSessionState {
    SWITCHING,
    PROVISIONING,
    ACTIVE,
}

@Entity(tableName = "client_session")
data class ClientSessionEntity(
    @PrimaryKey
    val singletonId: Int = 0,
    val sessionId: String,
    val sessionGeneration: Long,
    val state: ClientSessionState,
    val selectedModelId: String? = null,
) {
    init {
        require(singletonId == 0) { "client_session must use singletonId=0" }
        require(sessionId.isNotBlank()) { "client_session requires a sessionId" }
        require(sessionGeneration > 0) { "client_session requires a positive generation" }
        require(state != ClientSessionState.ACTIVE || !selectedModelId.isNullOrBlank()) {
            "active client_session requires selectedModelId"
        }
    }
}
