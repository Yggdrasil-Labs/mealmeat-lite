package io.yggdrasil.labs.mealmate.lite.contract

import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedProtocolCatalog
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.AddRecipeInput
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.BatchGenerateRecipesInput
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.BatchGenerateRecipesOutput
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.BootstrapResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ChatHistoryResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ConfirmationCommitResultDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ConfirmationEventDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.DeleteRecipeInput
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.DeviceListResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ErrorResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.GenerateWeeklyPlanInput
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.HealthLiveResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.HealthReadyResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.LogoutResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ModelListResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeListResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeTombstone
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeView
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RegisterResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RejectedResultDtoOneOf
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RejectedResultDtoOneOf1
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RestoreRecipeInput
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RevokeDeviceResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RotateFamilyCodeResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SearchRecipesInput
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SettingsResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SuccessResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionResultDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionResultDtoOneOf1
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionResultDtoOneOf2
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionsResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.UpdatePlanItemInput
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.UpdateRecipeInput
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.WeeklyPlanView
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.io.File

class ContractFixturesTest {
    private val root = File(requireNotNull(System.getProperty("mealmate.fixtures.root")))
    private val noDefaultsJson = Json(contractJson) { encodeDefaults = false }
    private val allowedConsumers = setOf("server", "android", "postgres", "room")

    @Test
    fun corpus_metadata_rejects_empty_consumers_unknown_consumers_and_duplicate_ids() {
        assertThrows<IllegalStateException> {
            validateCorpusMetadata(listOf("empty" to emptySet()))
        }
        assertThrows<IllegalStateException> {
            validateCorpusMetadata(listOf("unknown" to setOf("browser")))
        }
        assertThrows<IllegalStateException> {
            validateCorpusMetadata(listOf("duplicate" to setOf("android"), "duplicate" to setOf("server")))
        }
    }

    @Test
    fun manifest_declared_android_consumers_execute_exactly_once() {
        val corpus = loadCorpus()
        val executions = mutableMapOf<String, Int>()
        corpus.fixtures.filter { "android" in it.consumers }.forEach { fixture ->
            val actual = executeFixture(fixture)
            executions[fixture.id] = (executions[fixture.id] ?: 0) + 1
            assertEquals(fixture.expectedCategory, actual.category, fixture.id)
            assertEquals(fixture.expected == "accept", actual.accepted, fixture.id)
        }
        corpus.traces.filter { "android" in it.consumers }.forEach { trace ->
            val frames = trace.frames.map(::toFrame)
            executions[trace.id] = (executions[trace.id] ?: 0) + 1
            assertEquals("trace", trace.expectedCategory)
            assertEquals(trace.expected == "accept", validateSseTrace(frames).success, trace.id)
        }
        val declared =
            (
                corpus.fixtures.filter { "android" in it.consumers }.map { it.id } +
                    corpus.traces.filter { "android" in it.consumers }.map { it.id }
            ).toSet()
        assertEquals(declared, executions.keys)
        assertTrue(executions.values.all { it == 1 }, "duplicate android execution: $executions")
    }

    @Test
    fun http_successes_round_trip_through_generated_models() {
        loadCorpus().fixtures.filter { it.id.startsWith("http-") && it.expected == "accept" }.forEach { fixture ->
            assertEquals(canonicalJson(fixture.value), canonicalJson(reserializeHttp(fixture)), fixture.id)
        }
    }

    @Test
    fun authoritative_generated_catalog_is_fully_consumed_by_android_fixtures() {
        val corpus = loadCorpus()
        val manifest =
            contractJson
                .parseToJsonElement(requireNotNull(root.parentFile).resolve("generated/manifest.json").readText())
                .jsonObject
        val expectedHttp =
            manifest["httpOperations"]!!
                .jsonArray
                .flatMap { operation ->
                    val operationObject = operation.jsonObject
                    val operationId = operationObject["operationId"]!!.jsonPrimitive.content
                    operationObject["responses"]!!
                        .jsonObject
                        .filter { (status, schema) -> status.startsWith("2") && schema !is JsonNull }
                        .map { (_, schema) -> operationId to schema.jsonPrimitive.content }
                }.toMap()
        val httpFixtures = corpus.fixtures.filter { it.id.startsWith("http-") && it.expected == "accept" }
        assertEquals(expectedHttp, httpFixtures.associate { it.operationId to it.schemaId })
        assertTrue(httpFixtures.all { "server" in it.consumers && "android" in it.consumers })

        val expectedTools =
            manifest["functionTools"]!!
                .jsonArray
                .associate { tool ->
                    tool.jsonObject["name"]!!.jsonPrimitive.content to
                        tool.jsonObject["inputSchemaId"]!!.jsonPrimitive.content
                }
        val toolFixtures = corpus.fixtures.filter { it.toolName != null && it.expected == "accept" }
        assertEquals(expectedTools, toolFixtures.associate { it.toolName!! to it.schemaId })
        assertTrue(toolFixtures.all { "server" in it.consumers && "android" in it.consumers })

        val expectedSseEvents = manifest["sseEvents"]!!.jsonArray.map { it.jsonObject["event"]!!.jsonPrimitive.content }.toSet()
        val acceptedTraces = corpus.traces.filter { it.expected == "accept" }
        assertEquals(
            expectedSseEvents,
            acceptedTraces
                .flatMap { trace ->
                    trace.frames.map { it.jsonObject["event"]!!.jsonPrimitive.content }
                }.toSet(),
        )
        assertTrue(acceptedTraces.all { "server" in it.consumers && "android" in it.consumers })
    }

    @Test
    fun shared_corpus_contains_documented_negative_http_and_sse_vectors() {
        val corpus = loadCorpus()
        assertTrue(
            corpus.fixtures.map { it.id }.containsAll(
                listOf(
                    "http-recipe-unknown-field",
                    "http-chat-history-illegal-enum",
                    "http-recipe-missing-required",
                    "http-sync-result-mutually-exclusive",
                ),
            ),
        )
        assertTrue(
            corpus.traces.map { it.id }.containsAll(
                listOf(
                    "sse-invalid-missing-start",
                    "sse-invalid-non-increasing-event-id",
                    "sse-invalid-tool-terminal-before-start",
                    "sse-invalid-after-terminal",
                    "sse-invalid-double-terminal",
                ),
            ),
        )
    }

    @Test
    fun boolean_const_models_enforce_all_generated_properties_on_decode_and_encode() {
        val recipe =
            """{"id":"11111111-1111-4111-8111-111111111111","name":"合成番茄面","tags":[],"ingredients":[],"steps":[],"serverVersion":"9007199254740993","createdAt":"2026-08-03T00:00:00Z","updatedAt":"2026-08-03T00:00:00Z"}"""
        assertBooleanConst(
            expected = false,
            decodeValid = {
                contractJson
                    .decodeFromString<ErrorResponse>(
                        """{"success":false,"errCode":"INVALID_REQUEST","errMessage":"invalid","requestId":"11111111-1111-4111-8111-111111111111","retryable":false}""",
                    ).success
            },
            decodeOpposite = {
                contractJson.decodeFromString<ErrorResponse>(
                    """{"success":true,"errCode":"INVALID_REQUEST","errMessage":"invalid","requestId":"11111111-1111-4111-8111-111111111111","retryable":false}""",
                )
            },
            encodeOpposite = {
                contractJson.encodeToString(
                    contractJson
                        .decodeFromString<ErrorResponse>(
                            """{"success":false,"errCode":"INVALID_REQUEST","errMessage":"invalid","requestId":"11111111-1111-4111-8111-111111111111","retryable":false}""",
                        ).copy(success = true),
                )
            },
        )
        assertBooleanConst(
            expected = true,
            decodeValid = { contractJson.decodeFromString<LogoutResponse>("""{"revoked":true}""").revoked },
            decodeOpposite = { contractJson.decodeFromString<LogoutResponse>("""{"revoked":false}""") },
            encodeOpposite = {
                contractJson.encodeToString(
                    contractJson.decodeFromString<LogoutResponse>("""{"revoked":true}""").copy(revoked = false),
                )
            },
        )
        assertBooleanConst(
            expected = true,
            decodeValid = {
                contractJson
                    .decodeFromString<RevokeDeviceResponse>(
                        """{"id":"11111111-1111-4111-8111-111111111111","revoked":true}""",
                    ).revoked
            },
            decodeOpposite = {
                contractJson.decodeFromString<RevokeDeviceResponse>(
                    """{"id":"11111111-1111-4111-8111-111111111111","revoked":false}""",
                )
            },
            encodeOpposite = {
                contractJson.encodeToString(
                    contractJson
                        .decodeFromString<RevokeDeviceResponse>(
                            """{"id":"11111111-1111-4111-8111-111111111111","revoked":true}""",
                        ).copy(revoked = false),
                )
            },
        )
        assertBooleanConst(
            expected = true,
            decodeValid = {
                contractJson
                    .decodeFromString<BatchGenerateRecipesOutput>(
                        """{"confirmationRequired":true,"count":1,"skippedDuplicates":[],"expiresAt":"2026-08-03T00:00:00Z"}""",
                    ).confirmationRequired
            },
            decodeOpposite = {
                contractJson.decodeFromString<BatchGenerateRecipesOutput>(
                    """{"confirmationRequired":false,"count":1,"skippedDuplicates":[],"expiresAt":"2026-08-03T00:00:00Z"}""",
                )
            },
            encodeOpposite = {
                contractJson.encodeToString(
                    contractJson
                        .decodeFromString<BatchGenerateRecipesOutput>(
                            """{"confirmationRequired":true,"count":1,"skippedDuplicates":[],"expiresAt":"2026-08-03T00:00:00Z"}""",
                        ).copy(confirmationRequired = false),
                )
            },
        )
        assertBooleanConst(
            expected = true,
            decodeValid = { contractJson.decodeFromString<SuccessResponse>("""{"success":true,"data":null}""").success },
            decodeOpposite = { contractJson.decodeFromString<SuccessResponse>("""{"success":false,"data":null}""") },
            encodeOpposite = {
                contractJson.encodeToString(
                    contractJson.decodeFromString<SuccessResponse>("""{"success":true,"data":null}""").copy(success = false),
                )
            },
        )
        assertBooleanConst(
            expected = false,
            decodeValid = {
                contractJson
                    .decodeFromString<RejectedResultDtoOneOf>(
                        """{"status":"rejected","errCode":"VERSION_CONFLICT","errMessage":"server wins","requiresFullResync":false,"authoritative":$recipe,"serverVersion":"9007199254740993"}""",
                    ).requiresFullResync
            },
            decodeOpposite = {
                contractJson.decodeFromString<RejectedResultDtoOneOf>(
                    """{"status":"rejected","errCode":"VERSION_CONFLICT","errMessage":"server wins","requiresFullResync":true,"authoritative":$recipe,"serverVersion":"9007199254740993"}""",
                )
            },
            encodeOpposite = {
                contractJson.encodeToString(
                    contractJson
                        .decodeFromString<RejectedResultDtoOneOf>(
                            """{"status":"rejected","errCode":"VERSION_CONFLICT","errMessage":"server wins","requiresFullResync":false,"authoritative":$recipe,"serverVersion":"9007199254740993"}""",
                        ).copy(requiresFullResync = true),
                )
            },
        )
        assertBooleanConst(
            expected = true,
            decodeValid = {
                contractJson
                    .decodeFromString<RejectedResultDtoOneOf1>(
                        """{"status":"rejected","errCode":"RESYNC_REQUIRED","errMessage":"resync required","requiresFullResync":true}""",
                    ).requiresFullResync
            },
            decodeOpposite = {
                contractJson.decodeFromString<RejectedResultDtoOneOf1>(
                    """{"status":"rejected","errCode":"RESYNC_REQUIRED","errMessage":"resync required","requiresFullResync":false}""",
                )
            },
            encodeOpposite = {
                contractJson.encodeToString(
                    contractJson
                        .decodeFromString<RejectedResultDtoOneOf1>(
                            """{"status":"rejected","errCode":"RESYNC_REQUIRED","errMessage":"resync required","requiresFullResync":true}""",
                        ).copy(requiresFullResync = false),
                )
            },
        )
        assertBooleanConst(
            expected = false,
            decodeValid = {
                contractJson
                    .decodeFromString<SyncActionResultDtoOneOf1>(
                        """{"actionId":"44444444-4444-4444-8444-444444444444","status":"rejected","errCode":"VERSION_CONFLICT","errMessage":"server wins","requiresFullResync":false,"authoritative":$recipe,"serverVersion":"9007199254740993"}""",
                    ).requiresFullResync
            },
            decodeOpposite = {
                contractJson.decodeFromString<SyncActionResultDtoOneOf1>(
                    """{"actionId":"44444444-4444-4444-8444-444444444444","status":"rejected","errCode":"VERSION_CONFLICT","errMessage":"server wins","requiresFullResync":true,"authoritative":$recipe,"serverVersion":"9007199254740993"}""",
                )
            },
            encodeOpposite = {
                contractJson.encodeToString(
                    contractJson
                        .decodeFromString<SyncActionResultDtoOneOf1>(
                            """{"actionId":"44444444-4444-4444-8444-444444444444","status":"rejected","errCode":"VERSION_CONFLICT","errMessage":"server wins","requiresFullResync":false,"authoritative":$recipe,"serverVersion":"9007199254740993"}""",
                        ).copy(requiresFullResync = true),
                )
            },
        )
        assertBooleanConst(
            expected = true,
            decodeValid = {
                contractJson
                    .decodeFromString<SyncActionResultDtoOneOf2>(
                        """{"actionId":"55555555-5555-4555-8555-555555555555","status":"rejected","errCode":"RESYNC_REQUIRED","errMessage":"resync required","requiresFullResync":true}""",
                    ).requiresFullResync
            },
            decodeOpposite = {
                contractJson.decodeFromString<SyncActionResultDtoOneOf2>(
                    """{"actionId":"55555555-5555-4555-8555-555555555555","status":"rejected","errCode":"RESYNC_REQUIRED","errMessage":"resync required","requiresFullResync":false}""",
                )
            },
            encodeOpposite = {
                contractJson.encodeToString(
                    contractJson
                        .decodeFromString<SyncActionResultDtoOneOf2>(
                            """{"actionId":"55555555-5555-4555-8555-555555555555","status":"rejected","errCode":"RESYNC_REQUIRED","errMessage":"resync required","requiresFullResync":true}""",
                        ).copy(requiresFullResync = false),
                )
            },
        )
    }

    private fun assertBooleanConst(
        expected: Boolean,
        decodeValid: () -> Boolean,
        decodeOpposite: () -> Unit,
        encodeOpposite: () -> Unit,
    ) {
        assertEquals(expected, decodeValid())
        assertThrows<SerializationException>(decodeOpposite)
        assertThrows<SerializationException>(encodeOpposite)
    }

    private fun executeFixture(fixture: Fixture): Actual =
        try {
            if (fixture.schemaId == "ErrorResponse") {
                Actual(validateErrorTuple(fixture), "error-tuple")
            } else if (!validateSchemaFixture(fixture)) {
                Actual(false, "schema")
            } else if (fixture.schemaId == "SyncChangeDto" &&
                fixture.value.jsonObject["resource"]
                    ?.jsonPrimitive
                    ?.content == "weekly_plan"
            ) {
                val invariantValid = validateWeeklyPlanInvariant(fixture.value)
                Actual(invariantValid, if (invariantValid) "schema" else "protocol-invariant")
            } else {
                Actual(true, "schema")
            }
        } catch (_: Exception) {
            Actual(false, "schema")
        }

    private fun validateSchemaFixture(fixture: Fixture): Boolean {
        when (fixture.schemaId) {
            "RecipeView" -> {
                contractJson.decodeFromString<RecipeView>(fixture.value.toString())
            }

            "SettingsResponse" -> {
                contractJson.decodeFromString<SettingsResponse>(fixture.value.toString())
            }

            "ConfirmationEventDto" -> {
                contractJson.decodeFromString<ConfirmationEventDto>(fixture.value.toString())
            }

            "SyncChangeDto" -> {
                check(
                    hasExpectedSyncChangeDiscriminator(
                        contractJson.decodeFromString<SyncChangeDto>(fixture.value.toString()),
                    ),
                )
            }

            "SyncActionResultDto" -> {
                check(
                    hasExpectedSyncActionResultDiscriminator(
                        contractJson.decodeFromString<SyncActionResultDto>(fixture.value.toString()),
                    ),
                )
            }

            "UpdateRecipeInput" -> {
                val input = contractJson.decodeFromString<UpdateRecipeInput>(fixture.value.toString())
                check(hasPatchField(input))
            }

            "AddRecipeInput" -> {
                contractJson.decodeFromString<AddRecipeInput>(fixture.value.toString())
            }

            "BatchGenerateRecipesInput" -> {
                val input = contractJson.decodeFromString<BatchGenerateRecipesInput>(fixture.value.toString())
                check(input.recipes.size in 1..50)
            }

            "DeleteRecipeInput" -> {
                contractJson.decodeFromString<DeleteRecipeInput>(fixture.value.toString())
            }

            "GenerateWeeklyPlanInput" -> {
                val input = contractJson.decodeFromString<GenerateWeeklyPlanInput>(fixture.value.toString())
                check(input.items.size == 21)
            }

            "RestoreRecipeInput" -> {
                contractJson.decodeFromString<RestoreRecipeInput>(fixture.value.toString())
            }

            "SearchRecipesInput" -> {
                contractJson.decodeFromString<SearchRecipesInput>(fixture.value.toString())
            }

            "UpdatePlanItemInput" -> {
                contractJson.decodeFromString<UpdatePlanItemInput>(fixture.value.toString())
            }

            else if (fixture.id.startsWith("http-")) -> {
                reserializeHttp(fixture)
            }

            else -> {
                return false
            }
        }
        return true
    }

    private fun validateErrorTuple(fixture: Fixture): Boolean {
        val error =
            try {
                contractJson.decodeFromString<ErrorResponse>(fixture.value.toString())
            } catch (_: SerializationException) {
                return false
            }
        val definition = GeneratedProtocolCatalog.errorMap[error.errCode] ?: return false
        if ("json" !in definition.channels || definition.httpStatus != fixture.httpStatus) return false
        if (definition.retryable != error.retryable) return false

        val retryAfter =
            fixture.headers.entries
                .firstOrNull { it.key.equals("Retry-After", ignoreCase = true) }
                ?.value
        return when (definition.retryAfter.kind) {
            "none" -> {
                retryAfter == null
            }

            "fixed" -> {
                retryAfter?.toIntOrNull() == definition.retryAfter.seconds
            }

            "range" -> {
                val seconds = retryAfter?.toIntOrNull() ?: return false
                val minimum = definition.retryAfter.minSeconds ?: return false
                val maximum = definition.retryAfter.maxSeconds ?: return false
                seconds in minimum..maximum
            }

            else -> {
                false
            }
        }
    }

    private fun validateWeeklyPlanInvariant(value: JsonElement): Boolean =
        value.jsonObject["data"]!!.jsonObject.let { data ->
            validateInvariant(
                InvariantId.WEEK_START_IS_MONDAY,
                data["weekStart"]!!.jsonPrimitive.content,
            ).success &&
                validateInvariant(
                    InvariantId.WEEKLY_PLAN_HAS_21_SLOTS,
                    data,
                ).success
        }

    private fun hasPatchField(input: UpdateRecipeInput): Boolean {
        val patch = input.patch
        return listOf(patch.name, patch.tags, patch.ingredients, patch.steps, patch.imageUrl, patch.notes).any { it != null }
    }

    private fun hasExpectedSyncChangeDiscriminator(change: SyncChangeDto): Boolean =
        when (change) {
            is SyncChangeDto.SyncChangeDtoOneOfValue -> {
                change.value.resource == "recipe" && change.value.operation == "upsert"
            }

            is SyncChangeDto.SyncChangeDtoOneOf1Value -> {
                change.value.resource == "recipe" && change.value.operation == "delete"
            }

            is SyncChangeDto.SyncChangeDtoOneOf2Value -> {
                change.value.resource == "weekly_plan" && change.value.operation == "upsert"
            }

            is SyncChangeDto.SyncChangeDtoOneOf3Value -> {
                change.value.resource == "settings" && change.value.operation == "upsert"
            }
        }

    private fun hasExpectedSyncActionResultDiscriminator(result: SyncActionResultDto): Boolean =
        when (result) {
            is SyncActionResultDto.SyncActionResultDtoOneOfValue -> {
                result.value.status == "applied"
            }

            is SyncActionResultDto.SyncActionResultDtoOneOf1Value -> {
                result.value.status == "rejected" && !result.value.requiresFullResync
            }

            is SyncActionResultDto.SyncActionResultDtoOneOf2Value -> {
                result.value.status == "rejected" && result.value.requiresFullResync
            }

            is SyncActionResultDto.SyncActionResultDtoOneOf3Value -> {
                result.value.status == "duplicate"
            }
        }

    private inline fun <reified T> roundTripHttp(value: JsonElement): JsonElement =
        noDefaultsJson.parseToJsonElement(
            noDefaultsJson.encodeToString(contractJson.decodeFromString<T>(value.toString())),
        )

    private fun reserializeHttp(fixture: Fixture): JsonElement =
        when (fixture.schemaId) {
            "BootstrapResponse" -> {
                roundTripHttp<BootstrapResponse>(fixture.value)
            }

            "ChatHistoryResponse" -> {
                roundTripHttp<ChatHistoryResponse>(fixture.value)
            }

            "ConfirmationCommitResultDto" -> {
                roundTripHttp<ConfirmationCommitResultDto>(fixture.value)
            }

            "DeviceListResponse" -> {
                roundTripHttp<DeviceListResponse>(fixture.value)
            }

            "HealthLiveResponse" -> {
                roundTripHttp<HealthLiveResponse>(fixture.value)
            }

            "HealthReadyResponse" -> {
                roundTripHttp<HealthReadyResponse>(fixture.value)
            }

            "LogoutResponse" -> {
                roundTripHttp<LogoutResponse>(fixture.value)
            }

            "ModelListResponse" -> {
                roundTripHttp<ModelListResponse>(fixture.value)
            }

            "RecipeListResponse" -> {
                roundTripHttp<RecipeListResponse>(fixture.value)
            }

            "RecipeTombstone" -> {
                roundTripHttp<RecipeTombstone>(fixture.value)
            }

            "RecipeView" -> {
                roundTripHttp<RecipeView>(fixture.value)
            }

            "RegisterResponse" -> {
                roundTripHttp<RegisterResponse>(fixture.value)
            }

            "RevokeDeviceResponse" -> {
                roundTripHttp<RevokeDeviceResponse>(fixture.value)
            }

            "RotateFamilyCodeResponse" -> {
                roundTripHttp<RotateFamilyCodeResponse>(fixture.value)
            }

            "SettingsResponse" -> {
                roundTripHttp<SettingsResponse>(fixture.value)
            }

            "SyncActionsResponse" -> {
                roundTripHttp<SyncActionsResponse>(fixture.value)
            }

            "SyncResponse" -> {
                roundTripHttp<SyncResponse>(fixture.value)
            }

            "WeeklyPlanView" -> {
                roundTripHttp<WeeklyPlanView>(fixture.value)
            }

            "CurrentWeeklyPlanResponse" -> {
                roundTripHttp<WeeklyPlanView?>(fixture.value)
            }

            else -> {
                error("No HTTP model handler for ${fixture.id}")
            }
        }

    private fun loadCorpus(): Corpus {
        val paths =
            root
                .resolve("manifest.json")
                .readText()
                .let(contractJson::parseToJsonElement)
                .jsonObject["files"]!!
                .jsonArray
        val bodies = paths.associate { path -> path.jsonPrimitive.content to root.resolve(path.jsonPrimitive.content).readText() }
        val corpus =
            Corpus(
                fixtures =
                    bodies.filterKeys { it.endsWith(".jsonl") }.values.flatMap { body ->
                        body.lines().filter(String::isNotBlank).map(::fixture)
                    },
                traces = bodies.filterKeys { !it.endsWith(".jsonl") }.values.map(::trace),
            )
        validateCorpusMetadata(
            corpus.fixtures.map { it.id to it.consumers } +
                corpus.traces.map { it.id to it.consumers },
        )
        return corpus
    }

    private fun validateCorpusMetadata(entries: List<Pair<String, Set<String>>>) {
        val fixtureIds = mutableSetOf<String>()
        entries.forEach { (id, consumers) ->
            check(consumers.isNotEmpty()) { "Fixture $id must declare at least one consumer" }
            consumers.forEach { consumer ->
                check(consumer in allowedConsumers) { "Unknown consumer $consumer for fixture $id" }
            }
            check(fixtureIds.add(id)) { "Duplicate fixture ID: $id" }
        }
    }

    private fun fixture(line: String): Fixture {
        val value = contractJson.parseToJsonElement(line).jsonObject
        return Fixture(
            id = value["id"]!!.jsonPrimitive.content,
            schemaId = value["schemaId"]!!.jsonPrimitive.content,
            expected = value["expected"]!!.jsonPrimitive.content,
            expectedCategory = value["expectedCategory"]!!.jsonPrimitive.content,
            consumers = value["consumers"]!!.jsonArray.map { it.jsonPrimitive.content }.toSet(),
            operationId = value["operationId"]?.jsonPrimitive?.content,
            toolName = value["toolName"]?.jsonPrimitive?.content,
            httpStatus = value["httpStatus"]?.jsonPrimitive?.content?.toInt(),
            headers =
                value["headers"]
                    ?.jsonObject
                    ?.mapValues { (_, headerValue) ->
                        headerValue.jsonPrimitive.content
                    }.orEmpty(),
            value = value["value"]!!,
        )
    }

    private fun trace(body: String): Trace =
        contractJson.parseToJsonElement(body).jsonObject.let { value ->
            Trace(
                id = value["id"]!!.jsonPrimitive.content,
                expected = value["expected"]!!.jsonPrimitive.content,
                expectedCategory = value["expectedCategory"]!!.jsonPrimitive.content,
                consumers = value["consumers"]!!.jsonArray.map { it.jsonPrimitive.content }.toSet(),
                frames = value["frames"]!!.jsonArray,
            )
        }

    private fun toFrame(value: JsonElement): SseFrame {
        val frame = value.jsonObject
        return SseFrame(frame["event"]!!.jsonPrimitive.content, frame["data"]!!.toString(), frame["eventId"]!!.jsonPrimitive.content)
    }

    private fun canonicalJson(value: JsonElement): String =
        when (value) {
            is JsonArray -> {
                value.joinToString(prefix = "[", postfix = "]") { canonicalJson(it) }
            }

            is JsonObject -> {
                value.entries
                    .sortedBy {
                        it.key
                    }.joinToString(prefix = "{", postfix = "}") { "${JsonPrimitive(it.key)}:${canonicalJson(it.value)}" }
            }

            else -> {
                value.toString()
            }
        }

    private data class Actual(
        val accepted: Boolean,
        val category: String,
    )

    private data class Corpus(
        val fixtures: List<Fixture>,
        val traces: List<Trace>,
    )

    private data class Fixture(
        val id: String,
        val schemaId: String,
        val expected: String,
        val expectedCategory: String,
        val consumers: Set<String>,
        val operationId: String?,
        val toolName: String?,
        val httpStatus: Int?,
        val headers: Map<String, String>,
        val value: JsonElement,
    )

    private data class Trace(
        val id: String,
        val expected: String,
        val expectedCategory: String,
        val consumers: Set<String>,
        val frames: JsonArray,
    )
}
