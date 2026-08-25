package io.yggdrasil.labs.mealmate.lite.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class SyncDiagnosticKind {
    CURSOR,
    PROTOCOL,
}

@Entity(tableName = "sync_diagnostics")
data class SyncDiagnosticEntity(
    @PrimaryKey
    val diagnosticId: String,
    val sessionId: String,
    val sessionGeneration: Long,
    val kind: SyncDiagnosticKind,
    val errorCode: String,
    val message: String,
    val resource: String? = null,
    val createdAt: String,
)
