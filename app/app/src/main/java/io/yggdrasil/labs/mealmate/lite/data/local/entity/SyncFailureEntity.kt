package io.yggdrasil.labs.mealmate.lite.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sync_failures")
data class SyncFailureEntity(
    @PrimaryKey val actionId: String,
    val errCode: String,
    val errMessage: String,
    val authoritativeSchemaVersion: Int?,
    val authoritativeJson: String?,
    val serverVersion: String?,
    val requiresFullResync: Boolean,
    val createdAt: String,
) {
    init {
        require((authoritativeSchemaVersion == null) == (authoritativeJson == null)) {
            "authoritative schema version and payload must be both null or both present"
        }
        require(authoritativeSchemaVersion == null || authoritativeSchemaVersion >= 1) {
            "authoritativeSchemaVersion must be >= 1"
        }
    }
}
