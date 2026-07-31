package io.yggdrasil.labs.mealmate.lite.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class PendingActionState { PENDING, SENDING, FAILED }

@Entity(tableName = "pending_actions")
data class PendingActionEntity(
    @PrimaryKey val actionId: String,
    val type: String,
    val payloadSchemaVersion: Int,
    val payloadJson: String,
    val payloadHash: String,
    val createdAt: String,
    val state: PendingActionState,
    val attemptId: String? = null,
    val claimedAt: String? = null,
) {
    init {
        require(payloadSchemaVersion >= 1) { "payloadSchemaVersion must be >= 1" }
        require(type == "recipe.patch" || type == "recipe.delete") { "unsupported pending action type: $type" }
        require(payloadJson.isNotBlank()) { "payloadJson must not be blank" }
        require(payloadHash.matches(Regex("[0-9a-f]{64}"))) { "payloadHash must be SHA-256 hex" }
    }
}
