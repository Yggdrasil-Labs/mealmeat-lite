package io.yggdrasil.labs.mealmate.lite.contract

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ClearPatch
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.CurrentWeeklyPlanResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeView
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SetStringPatch
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.UpdateRecipeInput
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.UpdateRecipeInputPatchNotes
import kotlinx.serialization.SerializationException
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.net.URI

/**
 * 生成契约模型的严格 JSON 解析测试
 *
 * 验收标准：
 * - AC1: strict JSON 拒绝 unknown、非法类型、非法 UUID/URI/date/date-time 和歧义联合
 * - AC2: update_recipe 的 missing、clear、set 三态互不合并
 */
@DisplayName("GeneratedContractTest")
class GeneratedContractTest {
    private val json = contractJson

    @Nested
    @DisplayName("三态 Patch 语义")
    inner class PatchSemantics {
        @Test
        @DisplayName("missing - notes 字段缺失时为 null")
        fun missingNotesIsNull() {
            // notes 字段缺失 → null
            val input =
                """
                {
                    "recipeId": "01912345-6789-7def-abcd-ef0123456789",
                    "patch": {
                        "name": "测试菜品"
                    }
                }
                """.trimIndent()
            val result = json.decodeFromString<UpdateRecipeInput>(input)
            assertNull(result.patch.notes, "缺失的 notes 应为 null")
        }

        @Test
        @DisplayName("clear - notes 设置为 clear 操作")
        fun clearNotesOperation() {
            val input =
                """
                {
                    "recipeId": "01912345-6789-7def-abcd-ef0123456789",
                    "patch": {
                        "notes": {"op": "clear"}
                    }
                }
                """.trimIndent()
            val result = json.decodeFromString<UpdateRecipeInput>(input)
            assertInstanceOf(
                UpdateRecipeInputPatchNotes.ClearPatchValue::class.java,
                result.patch.notes,
                "notes 应为 ClearPatchValue",
            )
        }

        @Test
        @DisplayName("set - notes 设置为具体值")
        fun setNotesValue() {
            val input =
                """
                {
                    "recipeId": "01912345-6789-7def-abcd-ef0123456789",
                    "patch": {
                        "notes": {"op": "set", "value": "少盐少油"}
                    }
                }
                """.trimIndent()
            val result = json.decodeFromString<UpdateRecipeInput>(input)
            val notes = result.patch.notes
            assertInstanceOf(
                UpdateRecipeInputPatchNotes.SetStringPatchValue::class.java,
                notes,
                "notes 应为 SetStringPatchValue",
            )
            val setStringPatch = (notes as UpdateRecipeInputPatchNotes.SetStringPatchValue).value
            assertEquals("少盐少油", setStringPatch.value)
        }
    }

    @Nested
    @DisplayName("Strict JSON 拒绝")
    inner class StrictJsonRejection {
        @Test
        @DisplayName("严格 JSON 保留 explicitNulls 配置")
        fun usesExplicitNulls() {
            assertTrue(json.configuration.explicitNulls, "契约 JSON 必须保留显式 null 语义")
        }

        @Test
        @DisplayName("拒绝 unknown 字段")
        fun rejectUnknownFields() {
            val input =
                """
                {
                    "id": "01912345-6789-7def-abcd-ef0123456789",
                    "name": "测试菜品",
                    "tags": [],
                    "ingredients": [],
                    "steps": [],
                    "serverVersion": "1",
                    "createdAt": "2024-01-01T00:00:00Z",
                    "updatedAt": "2024-01-01T00:00:00Z",
                    "unknownField": "should fail"
                }
                """.trimIndent()
            assertThrows<SerializationException>("应拒绝 unknown 字段") {
                json.decodeFromString<RecipeView>(input)
            }
        }

        @Test
        @DisplayName("验证 UUID 格式 - 接受小写")
        fun acceptLowercaseUuid() {
            val id = "01912345-6789-7def-abcd-ef0123456789"
            assertTrue(validateUuidFormat(id), "小写 UUID 应通过验证")
        }

        @Test
        @DisplayName("验证 UUID 格式 - 拒绝大写")
        fun rejectUppercaseUuid() {
            val id = "01912345-6789-7DEF-ABCD-EF0123456789"
            assertFalse(validateUuidFormat(id), "大写 UUID 应被拒绝")
        }

        @Test
        @DisplayName("验证 UUID 格式 - 拒绝非法格式")
        fun rejectInvalidUuid() {
            val id = "not-a-valid-uuid"
            assertFalse(validateUuidFormat(id), "非法 UUID 应被拒绝")
        }

        @Test
        @DisplayName("验证 UTC date-time - 接受 Z 后缀")
        fun acceptUtcDateTime() {
            val dt = "2024-01-01T00:00:00Z"
            assertTrue(validateUtcDateTimeFormat(dt), "UTC 时间戳应通过验证")
        }

        @Test
        @DisplayName("验证 UTC date-time - 拒绝非 UTC offset")
        fun rejectNonUtcDateTime() {
            val dt = "2024-01-01T08:00:00+08:00"
            assertFalse(validateUtcDateTimeFormat(dt), "非 UTC 时间戳应被拒绝")
        }

        @Test
        @DisplayName("拒绝非法类型")
        fun rejectInvalidType() {
            val input =
                """
                {
                    "id": "01912345-6789-7def-abcd-ef0123456789",
                    "name": 12345,
                    "tags": [],
                    "ingredients": [],
                    "steps": [],
                    "serverVersion": "1",
                    "createdAt": "2024-01-01T00:00:00Z",
                    "updatedAt": "2024-01-01T00:00:00Z"
                }
                """.trimIndent()
            assertThrows<SerializationException>("应拒绝 name 为非字符串类型") {
                json.decodeFromString<RecipeView>(input)
            }
        }

        @Test
        @DisplayName("URI 字段解码为绝对 java.net.URI，并拒绝相对 URI")
        fun uriFieldsUseStrictUriSerializer() {
            val validInput =
                """
                {
                    "id": "01912345-6789-7def-abcd-ef0123456789",
                    "name": "测试菜品",
                    "tags": [],
                    "ingredients": [],
                    "steps": [],
                    "imageUrl": "https://example.test/images/1",
                    "serverVersion": "1",
                    "createdAt": "2024-01-01T00:00:00Z",
                    "updatedAt": "2024-01-01T00:00:00Z"
                }
                """.trimIndent()
            val result = json.decodeFromString<RecipeView>(validInput)
            assertInstanceOf(URI::class.java, result.imageUrl)

            val relativeInput = validInput.replace("https://example.test/images/1", "/images/1")
            assertThrows<SerializationException>("相对 URI 必须在解码边界被拒绝") {
                json.decodeFromString<RecipeView>(relativeInput)
            }
        }
    }

    @Nested
    @DisplayName("联合类型 (oneOf) 解析")
    inner class UnionTypeParsing {
        @Test
        @DisplayName("CurrentWeeklyPlanResponse 保留 WeeklyPlanView | null 语义")
        fun currentWeeklyPlanResponseAllowsNullAndObject() {
            val absent: CurrentWeeklyPlanResponse = json.decodeFromString("null")
            assertNull(absent)

            val items =
                (1..21).joinToString(",") { index ->
                    """{"id":"01912345-6789-7def-abcd-ef0123456789","date":"2024-01-15","mealType":"breakfast","recipeId":"01912345-6789-7def-abcd-ef0123456789","recipeNameSnapshot":"菜品 $index"}"""
                }
            val present: CurrentWeeklyPlanResponse =
                json.decodeFromString(
                    """{"id":"01912345-6789-7def-abcd-ef0123456789","weekStart":"2024-01-15","serverVersion":"1","items":[$items],"createdAt":"2024-01-15T00:00:00Z","updatedAt":"2024-01-15T00:00:00Z"}""",
                )
            val plan = requireNotNull(present)
            assertNotNull(plan)
            assertEquals("2024-01-15", plan.weekStart.toString())
        }

        @Test
        @DisplayName("SyncChangeDto - recipe upsert")
        fun parseSyncChangeRecipeUpsert() {
            val input =
                """
                {
                    "serverVersion": "1",
                    "resource": "recipe",
                    "operation": "upsert",
                    "data": {
                        "id": "01912345-6789-7def-abcd-ef0123456789",
                        "name": "测试菜品",
                        "tags": ["家常"],
                        "ingredients": ["鸡蛋"],
                        "steps": ["打散"],
                        "serverVersion": "1",
                        "createdAt": "2024-01-01T00:00:00Z",
                        "updatedAt": "2024-01-01T00:00:00Z"
                    }
                }
                """.trimIndent()
            val result = json.decodeFromString<SyncChangeDto>(input)
            assertInstanceOf(SyncChangeDto.SyncChangeDtoOneOfValue::class.java, result)
        }

        @Test
        @DisplayName("拒绝歧义联合 - 无法匹配任何变体")
        fun rejectAmbiguousUnion() {
            val input =
                """
                {
                    "serverVersion": "1",
                    "resource": "unknown_resource",
                    "operation": "upsert",
                    "data": {}
                }
                """.trimIndent()
            assertThrows<SerializationException>("应拒绝无法匹配的联合类型") {
                json.decodeFromString<SyncChangeDto>(input)
            }
        }
    }

    @Nested
    @DisplayName("有效输入解析")
    inner class ValidInputParsing {
        @Test
        @DisplayName("完整 RecipeView 解析")
        fun parseCompleteRecipeView() {
            val input =
                """
                {
                    "id": "01912345-6789-7def-abcd-ef0123456789",
                    "name": "番茄炒蛋",
                    "tags": ["家常", "快手"],
                    "ingredients": ["番茄 2个", "鸡蛋 3个"],
                    "steps": ["番茄切块", "鸡蛋打散", "先炒蛋", "再炒番茄"],
                    "imageUrl": "https://example.com/image.jpg",
                    "notes": "可加糖提鲜",
                    "serverVersion": "42",
                    "createdAt": "2024-01-15T10:30:00Z",
                    "updatedAt": "2024-01-15T14:20:00Z"
                }
                """.trimIndent()
            val result = json.decodeFromString<RecipeView>(input)
            assertEquals("番茄炒蛋", result.name)
            assertEquals(listOf("家常", "快手"), result.tags)
            assertEquals("42", result.serverVersion)
            assertTrue(result.imageUrl != null)
            assertEquals("可加糖提鲜", result.notes)
        }

        @Test
        @DisplayName("可选字段缺失时为 null")
        fun optionalFieldsAreNull() {
            val input =
                """
                {
                    "id": "01912345-6789-7def-abcd-ef0123456789",
                    "name": "简单菜",
                    "tags": [],
                    "ingredients": [],
                    "steps": [],
                    "serverVersion": "1",
                    "createdAt": "2024-01-01T00:00:00Z",
                    "updatedAt": "2024-01-01T00:00:00Z"
                }
                """.trimIndent()
            val result = json.decodeFromString<RecipeView>(input)
            assertNull(result.imageUrl)
            assertNull(result.notes)
        }
    }
}
