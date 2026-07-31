package io.yggdrasil.labs.mealmate.lite.data.local.mapper

import io.yggdrasil.labs.mealmate.lite.contract.InvariantId
import io.yggdrasil.labs.mealmate.lite.contract.contractJson
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.AppliedResultDtoResource
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.PlanItemView
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeTombstone
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeView
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SettingsDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.WeeklyPlanView
import io.yggdrasil.labs.mealmate.lite.contract.validateInvariant
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PlanItemEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.RecipeEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SettingsCacheEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.WeeklyPlanEntity
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.put

interface ContractRoomMapper<Contract : Any, Entity : Any> {
    fun toEntity(contract: Contract): Entity

    fun toContract(entity: Entity): Contract
}

internal fun requireValidServerVersion(value: String) {
    require(validateInvariant(InvariantId.SERVER_VERSION_WITHIN_DB_BIGINT, value).success) {
        "Invalid serverVersion: $value"
    }
}

internal fun requireValidRecipeView(contract: RecipeView) {
    requireValidServerVersion(contract.serverVersion)
}

internal fun requireValidRecipeTombstone(contract: RecipeTombstone) {
    requireValidServerVersion(contract.serverVersion)
}

internal fun requireValidAuthoritativeSnapshot(snapshot: AppliedResultDtoResource) {
    when (snapshot) {
        is AppliedResultDtoResource.RecipeViewValue -> requireValidRecipeView(snapshot.value)
        is AppliedResultDtoResource.RecipeTombstoneValue -> requireValidRecipeTombstone(snapshot.value)
    }
}

object RecipeRoomMapper : ContractRoomMapper<RecipeView, RecipeEntity> {
    override fun toEntity(contract: RecipeView): RecipeEntity {
        requireValidRecipeView(contract)
        return RecipeEntity(
            id = contract.id.toString(),
            name = contract.name,
            tagsJson = contractJson.encodeToString(contract.tags),
            ingredientsJson = contractJson.encodeToString(contract.ingredients),
            stepsJson = contractJson.encodeToString(contract.steps),
            serverVersion = contract.serverVersion,
            createdAt = contract.createdAt.toInstant().toString(),
            updatedAt = contract.updatedAt.toInstant().toString(),
            imageUrl = contract.imageUrl?.toString(),
            notes = contract.notes,
        )
    }

    override fun toContract(entity: RecipeEntity): RecipeView =
        contractJson
            .decodeFromJsonElement(
                RecipeView.serializer(),
                buildJsonObject {
                    put("id", entity.id)
                    put("name", entity.name)
                    put("tags", contractJson.parseToJsonElement(entity.tagsJson))
                    put("ingredients", contractJson.parseToJsonElement(entity.ingredientsJson))
                    put("steps", contractJson.parseToJsonElement(entity.stepsJson))
                    put("serverVersion", entity.serverVersion)
                    put("createdAt", entity.createdAt)
                    put("updatedAt", entity.updatedAt)
                    put("imageUrl", entity.imageUrl?.let(::JsonPrimitive) ?: JsonNull)
                    put("notes", entity.notes?.let(::JsonPrimitive) ?: JsonNull)
                },
            ).also(::requireValidRecipeView)
}

fun weeklyPlanEntityFromContract(contract: WeeklyPlanView): WeeklyPlanEntity {
    requireValidServerVersion(contract.serverVersion)
    require(validateInvariant(InvariantId.WEEK_START_IS_MONDAY, contract.weekStart.toString()).success) {
        "weekStart must be Monday"
    }
    require(validateInvariant(InvariantId.WEEKLY_PLAN_HAS_21_SLOTS, mapOf("items" to contract.items)).success) {
        "weekly plan must contain 21 slots"
    }
    return WeeklyPlanEntity(
        id = contract.id.toString(),
        weekStart = contract.weekStart.toString(),
        serverVersion = contract.serverVersion,
        createdAt = contract.createdAt.toInstant().toString(),
        updatedAt = contract.updatedAt.toInstant().toString(),
    )
}

fun planItemEntityFromContract(
    weeklyPlanId: String,
    contract: PlanItemView,
): PlanItemEntity =
    PlanItemEntity(
        id = contract.id.toString(),
        weeklyPlanId = weeklyPlanId,
        date = contract.date.toString(),
        mealType = contract.mealType.toString(),
        recipeId = contract.recipeId.toString(),
        recipeNameSnapshot = contract.recipeNameSnapshot,
    )

fun settingsCacheEntityFromContract(contract: SettingsDto): SettingsCacheEntity {
    require(contract.key == "familyPreference") { "Settings key must be familyPreference" }
    require(contract.value.length <= 5_000) { "Settings value exceeds 5000 characters" }
    return SettingsCacheEntity(key = contract.key, value = contract.value)
}
