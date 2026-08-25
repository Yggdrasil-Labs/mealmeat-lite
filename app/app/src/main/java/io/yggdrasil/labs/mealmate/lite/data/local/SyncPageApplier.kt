package io.yggdrasil.labs.mealmate.lite.data.local

import androidx.room.withTransaction
import io.yggdrasil.labs.mealmate.lite.contract.InvariantId
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncResponse
import io.yggdrasil.labs.mealmate.lite.contract.validateInvariant
import io.yggdrasil.labs.mealmate.lite.data.local.entity.RecipeEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ReplicaVersionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncCursorPhase
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncDiagnosticEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncDiagnosticKind
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncStateEntity
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.RecipeRoomMapper
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.planItemEntityFromContract
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.settingsCacheEntityFromContract
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.weeklyPlanEntityFromContract
import java.math.BigInteger
import java.time.Instant
import java.util.UUID

typealias SyncPageDto = SyncResponse

data class SyncApplyResult(
    val appliedChanges: Int,
    val cursor: String?,
)

data class SyncSessionFence(
    val sessionId: String,
    val sessionGeneration: Long,
)

/**
 * Applies a complete sync page in one Room transaction.
 * Source: https://developer.android.com/reference/kotlin/androidx/room/package-summary#withTransaction(androidx.room.RoomDatabase,kotlin.coroutines.SuspendFunction0)
 */
class SyncPageApplier(
    private val database: MealMateDatabase,
) {
    suspend fun applySyncPage(
        page: SyncPageDto,
        currentCursor: String?,
    ): SyncApplyResult = applyValidatedPage(page, currentCursor, sessionFence = null, promoteOnTerminal = false)

    suspend fun applySyncPage(
        page: SyncPageDto,
        currentCursor: String?,
        sessionFence: SyncSessionFence,
        promoteOnTerminal: Boolean,
    ): SyncApplyResult = applyValidatedPage(page, currentCursor, sessionFence, promoteOnTerminal)

    private suspend fun applyValidatedPage(
        page: SyncPageDto,
        currentCursor: String?,
        sessionFence: SyncSessionFence?,
        promoteOnTerminal: Boolean,
    ): SyncApplyResult {
        val changes = page.changes.map(::metadataFor)
        require(changes.map { Triple(it.resource, it.resourceId, it.serverVersion) }.toSet().size == changes.size) {
            "Sync page contains a duplicate resource version"
        }
        return database.withTransaction {
            val dao = database.contractCacheDao()
            if (sessionFence != null) requireMatchingSession(sessionFence)
            val storedState = dao.getSyncState()
            require(storedState?.cursor == currentCursor) { "Sync cursor changed before page application" }
            val ordering = sessionFence?.let { validateOrdering(changes, storedState, page.nextCursor) }
            var appliedChanges = 0
            changes.forEach { change ->
                val currentVersion = dao.getReplicaVersion(change.resource, change.resourceId)?.serverVersion
                if (currentVersion == null || BigInteger(change.serverVersion) > BigInteger(currentVersion)) {
                    applyChange(change.change)
                    dao.upsertReplicaVersion(
                        ReplicaVersionEntity(change.resource, change.resourceId, change.serverVersion),
                    )
                    appliedChanges += 1
                }
            }
            dao.upsertSyncState(ordering?.toEntity(page.nextCursor) ?: SyncStateEntity(cursor = page.nextCursor))
            if (!page.hasMore && sessionFence != null) {
                dao.clearSyncDiagnostics(sessionFence.sessionId, sessionFence.sessionGeneration)
            }
            if (promoteOnTerminal) {
                require(!page.hasMore && page.nextCursor == null) { "Only a terminal page may activate a session" }
                requireNotNull(sessionFence)
                check(dao.promoteClientSession(sessionFence.sessionId, sessionFence.sessionGeneration) == 1) {
                    "Provisioning session changed before activation"
                }
            }
            SyncApplyResult(appliedChanges = appliedChanges, cursor = page.nextCursor)
        }
    }

    suspend fun recordDiagnostic(
        sessionFence: SyncSessionFence,
        kind: SyncDiagnosticKind,
        errorCode: String,
        message: String,
        resource: String? = null,
    ) {
        database.withTransaction {
            requireMatchingSession(sessionFence)
            val dao = database.contractCacheDao()
            dao.insertSyncDiagnostic(
                SyncDiagnosticEntity(
                    diagnosticId = UUID.randomUUID().toString(),
                    sessionId = sessionFence.sessionId,
                    sessionGeneration = sessionFence.sessionGeneration,
                    kind = kind,
                    errorCode = errorCode,
                    message = message.take(MAX_DIAGNOSTIC_MESSAGE_LENGTH),
                    resource = resource,
                    createdAt = Instant.now().toString(),
                ),
            )
        }
    }

    private fun validateOrdering(
        changes: List<VersionedChange>,
        storedState: SyncStateEntity?,
        nextCursor: String?,
    ): OrderingState {
        if (changes.isEmpty()) {
            require(nextCursor == null || storedState?.phase != SyncCursorPhase.INCREMENTAL) {
                "An incremental continuation page must contain changes"
            }
            return if (nextCursor == null) OrderingState.empty() else OrderingState.incrementalBridge()
        }

        val snapshotOrdered =
            changes.zipWithNext().all { (left, right) -> left.compareResourceKey(right) < 0 }
        val incrementalOrdered =
            changes.zipWithNext().all { (left, right) ->
                BigInteger(left.serverVersion) < BigInteger(right.serverVersion)
            }
        val first = changes.first()
        val snapshotBoundaryValid =
            when (storedState?.phase) {
                null -> storedState?.cursor == null
                SyncCursorPhase.SNAPSHOT -> first.isAfterStoredResource(storedState)
                SyncCursorPhase.INCREMENTAL -> false
            }
        val versionBoundary = storedState?.lastServerVersion?.let(::BigInteger)
        val incrementalBoundaryValid =
            when (storedState?.phase) {
                null -> {
                    false
                }

                SyncCursorPhase.SNAPSHOT -> {
                    versionBoundary != null && BigInteger(first.serverVersion) > versionBoundary
                }

                SyncCursorPhase.INCREMENTAL -> {
                    versionBoundary == null || BigInteger(first.serverVersion) > versionBoundary
                }
            }

        return when {
            snapshotOrdered && snapshotBoundaryValid -> {
                val maxVersion =
                    changes
                        .maxOf { BigInteger(it.serverVersion) }
                        .let { currentMax -> maxOf(currentMax, versionBoundary ?: currentMax) }
                OrderingState(
                    phase = SyncCursorPhase.SNAPSHOT,
                    lastResource = changes.last().resource,
                    lastResourceId = changes.last().resourceId,
                    lastServerVersion = maxVersion.toString(),
                )
            }

            incrementalOrdered && incrementalBoundaryValid -> {
                OrderingState(
                    phase = SyncCursorPhase.INCREMENTAL,
                    lastServerVersion = changes.last().serverVersion,
                )
            }

            else -> {
                throw IllegalArgumentException("Sync page ordering does not continue the stored boundary")
            }
        }
    }

    private suspend fun requireMatchingSession(sessionFence: SyncSessionFence) {
        val session = database.contractCacheDao().getClientSession()
        require(
            session?.sessionId == sessionFence.sessionId &&
                session.sessionGeneration == sessionFence.sessionGeneration,
        ) { "Client session changed before sync write" }
    }

    private fun metadataFor(change: SyncChangeDto): VersionedChange =
        when (change) {
            is SyncChangeDto.SyncChangeDtoOneOfValue -> {
                val value = change.value
                require(value.resource == "recipe" && value.operation == "upsert")
                requireMatchingVersion(value.serverVersion, value.data.serverVersion)
                VersionedChange(change, "recipe", value.data.id.toString(), value.serverVersion)
            }

            is SyncChangeDto.SyncChangeDtoOneOf1Value -> {
                val value = change.value
                require(value.resource == "recipe" && value.operation == "delete")
                requireMatchingVersion(value.serverVersion, value.data.serverVersion)
                VersionedChange(change, "recipe", value.data.id.toString(), value.serverVersion)
            }

            is SyncChangeDto.SyncChangeDtoOneOf2Value -> {
                val value = change.value
                require(value.resource == "weekly_plan" && value.operation == "upsert")
                requireMatchingVersion(value.serverVersion, value.data.serverVersion)
                VersionedChange(change, "weekly_plan", value.data.id.toString(), value.serverVersion)
            }

            is SyncChangeDto.SyncChangeDtoOneOf3Value -> {
                val value = change.value
                require(value.resource == "settings" && value.operation == "upsert")
                requireValidVersion(value.serverVersion)
                VersionedChange(change, "settings", value.data.key, value.serverVersion)
            }
        }

    private suspend fun applyChange(change: SyncChangeDto) {
        val dao = database.contractCacheDao()
        when (change) {
            is SyncChangeDto.SyncChangeDtoOneOfValue -> {
                change.value.let { value ->
                    require(value.resource == "recipe" && value.operation == "upsert") {
                        "Recipe upsert must have resource=recipe and operation=upsert"
                    }
                    requireMatchingVersion(value.serverVersion, value.data.serverVersion)
                    dao.upsertRecipe(RecipeRoomMapper.toEntity(value.data))
                }
            }

            is SyncChangeDto.SyncChangeDtoOneOf1Value -> {
                val value = change.value
                require(value.resource == "recipe" && value.operation == "delete") {
                    "Recipe tombstone must have resource=recipe and operation=delete"
                }
                val tombstone = value.data
                requireMatchingVersion(value.serverVersion, tombstone.serverVersion)
                dao.upsertRecipe(
                    RecipeEntity(
                        id = tombstone.id.toString(),
                        name = "",
                        tagsJson = "[]",
                        ingredientsJson = "[]",
                        stepsJson = "[]",
                        serverVersion = tombstone.serverVersion,
                        createdAt = tombstone.deletedAt.toInstant().toString(),
                        updatedAt = tombstone.deletedAt.toInstant().toString(),
                        imageUrl = null,
                        notes = null,
                        deletedAt = tombstone.deletedAt.toInstant().toString(),
                    ),
                )
            }

            is SyncChangeDto.SyncChangeDtoOneOf2Value -> {
                val value = change.value
                require(value.resource == "weekly_plan" && value.operation == "upsert") {
                    "Weekly plan must have resource=weekly_plan and operation=upsert"
                }
                val plan = value.data
                requireMatchingVersion(value.serverVersion, plan.serverVersion)
                dao.replaceWeeklyPlan(
                    weeklyPlanEntityFromContract(plan),
                    plan.items.map { planItemEntityFromContract(plan.id.toString(), it) },
                )
            }

            is SyncChangeDto.SyncChangeDtoOneOf3Value -> {
                val value = change.value
                require(value.resource == "settings" && value.operation == "upsert") {
                    "Settings must have resource=settings and operation=upsert"
                }
                requireValidVersion(value.serverVersion)
                dao.upsertSettings(settingsCacheEntityFromContract(value.data))
            }
        }
    }

    private fun requireValidVersion(value: String) {
        require(validateInvariant(InvariantId.SERVER_VERSION_WITHIN_DB_BIGINT, value).success) {
            "Invalid serverVersion: $value"
        }
    }

    private fun requireMatchingVersion(
        changeVersion: String,
        resourceVersion: String,
    ) {
        requireValidVersion(changeVersion)
        requireValidVersion(resourceVersion)
        require(changeVersion == resourceVersion) { "Sync change version must match its resource version" }
    }

    private data class VersionedChange(
        val change: SyncChangeDto,
        val resource: String,
        val resourceId: String,
        val serverVersion: String,
    ) {
        fun compareResourceKey(other: VersionedChange): Int =
            compareValuesBy(this, other, VersionedChange::resource, VersionedChange::resourceId)

        fun isAfterStoredResource(state: SyncStateEntity): Boolean {
            val previousResource = state.lastResource ?: return false
            val previousResourceId = state.lastResourceId ?: return false
            val resourceComparison = resource.compareTo(previousResource)
            return resourceComparison > 0 || (resourceComparison == 0 && resourceId > previousResourceId)
        }
    }

    private data class OrderingState(
        val phase: SyncCursorPhase?,
        val lastResource: String? = null,
        val lastResourceId: String? = null,
        val lastServerVersion: String? = null,
    ) {
        fun toEntity(cursor: String?): SyncStateEntity =
            if (cursor == null) {
                SyncStateEntity(cursor = null)
            } else {
                SyncStateEntity(
                    cursor = cursor,
                    phase = phase,
                    lastResource = lastResource,
                    lastResourceId = lastResourceId,
                    lastServerVersion = lastServerVersion,
                )
            }

        companion object {
            fun empty() = OrderingState(phase = null)

            fun incrementalBridge() = OrderingState(phase = SyncCursorPhase.INCREMENTAL)
        }
    }

    private companion object {
        const val MAX_DIAGNOSTIC_MESSAGE_LENGTH = 2_000
    }
}
