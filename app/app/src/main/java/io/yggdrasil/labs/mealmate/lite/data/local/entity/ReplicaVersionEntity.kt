package io.yggdrasil.labs.mealmate.lite.data.local.entity

import androidx.room.Entity

@Entity(
    tableName = "replica_versions",
    primaryKeys = ["resource", "resourceId"],
)
data class ReplicaVersionEntity(
    val resource: String,
    val resourceId: String,
    val serverVersion: String,
) {
    init {
        require(resource.isNotBlank() && resourceId.isNotBlank()) { "replica version requires a resource key" }
        require(serverVersion.toLongOrNull()?.let { it > 0 } == true) { "replica version must fit positive DB bigint" }
        require(!serverVersion.startsWith('0')) { "replica version must be canonical decimal" }
    }
}
