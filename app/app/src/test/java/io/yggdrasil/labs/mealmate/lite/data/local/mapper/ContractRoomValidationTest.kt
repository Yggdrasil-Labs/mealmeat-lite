package io.yggdrasil.labs.mealmate.lite.data.local.mapper

import io.yggdrasil.labs.mealmate.lite.contract.contractJson
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeView
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SettingsDto
import kotlinx.serialization.encodeToString
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

class ContractRoomValidationTest {
    @Test
    fun settings_mapper_rejects_values_outside_its_contract() {
        assertThrows<IllegalArgumentException> {
            settingsCacheEntityFromContract(SettingsDto(key = "other", value = "value"))
        }
        assertThrows<IllegalArgumentException> {
            settingsCacheEntityFromContract(SettingsDto(key = "familyPreference", value = "x".repeat(5_001)))
        }
    }

    @Test
    fun authoritative_snapshot_rejects_an_invalid_server_version() {
        assertThrows<IllegalArgumentException> {
            decodeAuthoritativeSnapshot(
                schemaVersion = ROOM_PAYLOAD_SCHEMA_VERSION,
                authoritativeJson = contractJson.encodeToString(RecipeView.serializer(), recipeView(serverVersion = "0")),
            )
        }
    }

    @Test
    fun recipe_mapper_rejects_a_corrupted_entity_version_on_read() {
        assertThrows<IllegalArgumentException> {
            RecipeRoomMapper.toContract(RecipeRoomMapper.toEntity(recipeView(serverVersion = "1")).copy(serverVersion = "0"))
        }
    }

    private fun recipeView(serverVersion: String): RecipeView =
        RecipeView(
            id = UUID.fromString("11111111-1111-4111-8111-111111111111"),
            name = "Noodles",
            tags = listOf("quick"),
            ingredients = listOf("noodles"),
            steps = listOf("cook"),
            serverVersion = serverVersion,
            createdAt = now,
            updatedAt = now,
        )

    private companion object {
        val now: OffsetDateTime = OffsetDateTime.of(2026, 8, 1, 12, 0, 0, 0, ZoneOffset.UTC)
    }
}
