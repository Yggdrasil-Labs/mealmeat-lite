package io.yggdrasil.labs.mealmate.lite.data.local.mapper

import io.yggdrasil.labs.mealmate.lite.contract.InvariantId
import io.yggdrasil.labs.mealmate.lite.contract.contractJson
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.AppliedResultDtoResource
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDto
import io.yggdrasil.labs.mealmate.lite.contract.validateInvariant
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionState
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncFailureEntity
import kotlinx.serialization.encodeToString
import java.security.MessageDigest

const val ROOM_PAYLOAD_SCHEMA_VERSION = 1

typealias PendingActionPayloadDto = SyncActionDto
typealias SyncAuthoritativeSnapshotDto = AppliedResultDtoResource

/**
 * Version-dispatched codecs for the two Room-persisted discriminated unions.
 * The version is checked before parsing so future payloads cannot be guessed as v0.1.
 */
fun decodePendingActionPayload(
    schemaVersion: Int,
    payloadJson: String,
): PendingActionPayloadDto {
    require(schemaVersion == ROOM_PAYLOAD_SCHEMA_VERSION) { "Unsupported pending action schema version: $schemaVersion" }
    return contractJson
        .decodeFromString(SyncActionDto.serializer(), payloadJson)
        .also(::requireValidPendingActionPayload)
}

fun decodeAuthoritativeSnapshot(
    schemaVersion: Int,
    authoritativeJson: String,
): SyncAuthoritativeSnapshotDto {
    require(schemaVersion == ROOM_PAYLOAD_SCHEMA_VERSION) { "Unsupported authoritative schema version: $schemaVersion" }
    return contractJson
        .decodeFromString(AppliedResultDtoResource.serializer(), authoritativeJson)
        .also(::requireValidAuthoritativeSnapshot)
}

fun pendingActionEntityFromPayload(
    payload: PendingActionPayloadDto,
    state: PendingActionState = PendingActionState.PENDING,
): PendingActionEntity {
    val canonicalJson = contractJson.encodeToString(SyncActionDto.serializer(), payload)
    val (actionId, type, createdAt) =
        when (payload) {
            is SyncActionDto.SyncActionDtoOneOfValue -> {
                payload.value.let {
                    Triple(it.actionId.toString(), it.type, it.createdAt.toInstant().toString())
                }
            }

            is SyncActionDto.SyncActionDtoOneOf1Value -> {
                payload.value.let {
                    Triple(it.actionId.toString(), it.type, it.createdAt.toInstant().toString())
                }
            }
        }
    return PendingActionEntity(
        actionId = actionId,
        type = type,
        payloadSchemaVersion = ROOM_PAYLOAD_SCHEMA_VERSION,
        payloadJson = canonicalJson,
        payloadHash = sha256Hex(canonicalJson),
        createdAt = createdAt,
        state = state,
    )
}

/** Enforces the `const` discriminators that the generated Kotlin DTO represents as strings. */
fun requireValidPendingActionPayload(payload: PendingActionPayloadDto) {
    when (payload) {
        is SyncActionDto.SyncActionDtoOneOfValue -> {
            require(payload.value.type == "recipe.patch") { "recipe.patch action must have type=recipe.patch" }
            val patch = payload.value.payload.patch
            require(patch.name != null || patch.tags != null) { "recipe.patch must change at least one field" }
            patch.name?.let { require(it.length in 1..100) { "recipe.patch name length is invalid" } }
            patch.tags?.let { tags ->
                require(tags.size <= 20) { "recipe.patch may contain at most 20 tags" }
                require(tags.all { it.length <= 30 }) { "recipe.patch tag length is invalid" }
            }
        }

        is SyncActionDto.SyncActionDtoOneOf1Value -> {
            require(payload.value.type == "recipe.delete") { "recipe.delete action must have type=recipe.delete" }
        }
    }
}

/**
 * Defends the DAO boundary against callers that construct an entity rather than using the mapper.
 * Stored payloads must be a known-version strict DTO in the exact canonical representation whose
 * digest is persisted beside it.
 */
fun requireCanonicalPendingActionEntity(entity: PendingActionEntity) {
    val payload = decodePendingActionPayload(entity.payloadSchemaVersion, entity.payloadJson)
    val canonicalJson = contractJson.encodeToString(SyncActionDto.serializer(), payload)
    require(canonicalJson == entity.payloadJson) { "pending action payload must be canonical JSON" }
    require(sha256Hex(canonicalJson) == entity.payloadHash) { "pending action payload hash does not match canonical JSON" }
    val (actionId, type) =
        when (payload) {
            is SyncActionDto.SyncActionDtoOneOfValue -> payload.value.actionId.toString() to payload.value.type
            is SyncActionDto.SyncActionDtoOneOf1Value -> payload.value.actionId.toString() to payload.value.type
        }
    require(entity.actionId == actionId) { "pending action id does not match payload" }
    require(entity.type == type) { "pending action type does not match payload" }
}

/** Ensures a persisted failure cannot enter rollback/retry code with an unknown snapshot schema. */
fun requireValidSyncFailureEntity(entity: SyncFailureEntity) {
    entity.serverVersion?.let { serverVersion ->
        require(validateInvariant(InvariantId.SERVER_VERSION_WITHIN_DB_BIGINT, serverVersion).success) {
            "Invalid sync failure serverVersion: $serverVersion"
        }
    }
    val schemaVersion = entity.authoritativeSchemaVersion
    val snapshot = entity.authoritativeJson
    if (schemaVersion != null && snapshot != null) {
        decodeAuthoritativeSnapshot(schemaVersion, snapshot)
    }
}

fun sha256Hex(value: String): String =
    MessageDigest
        .getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString(separator = "") { byte -> "%02x".format(byte) }
