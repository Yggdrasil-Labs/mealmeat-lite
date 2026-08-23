package io.yggdrasil.labs.mealmate.lite.ui.settings

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.DeviceView
import org.junit.Rule
import org.junit.Test
import java.time.OffsetDateTime
import java.util.UUID

class SettingsScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun currentDeviceHasNoRevokeAction() {
        val current = device("Current", isCurrent = true)
        val other = device("Other", isCurrent = false)
        composeRule.setContent {
            SettingsScreenContent(
                state = SettingsUiState(devices = listOf(current, other)),
                onRefresh = {},
                onRotateFamilyCode = {},
                onDismissFamilyCode = {},
                onRevokeDevice = {},
                onLogout = {},
            )
        }

        composeRule.onNodeWithText("当前设备").assertIsDisplayed()
        composeRule.onNodeWithText("Other").assertIsDisplayed()
        check(composeRule.onAllNodesWithText("撤销设备").fetchSemanticsNodes().size == 1)
    }

    private fun device(
        name: String,
        isCurrent: Boolean,
    ) = DeviceView(
        id = UUID.randomUUID(),
        deviceName = name,
        createdAt = OffsetDateTime.parse("2026-01-01T00:00:00Z"),
        lastUsedAt = OffsetDateTime.parse("2026-01-01T00:00:00Z"),
        isCurrent = isCurrent,
    )
}
