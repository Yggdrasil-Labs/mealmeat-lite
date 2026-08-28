package io.yggdrasil.labs.mealmate.lite.ui.auth

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import org.junit.Rule
import org.junit.Test

class JoinRecoveryScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun recoveryModeOnlyOffersFamilyCodeJoin() {
        var submitted = false
        composeRule.setContent {
            JoinRecoveryScreen(
                state = AuthUiState.Join(JoinMode.Recovery),
                onBootstrap = { _, _ -> error("bootstrap must not be shown") },
                onRegister = { _, _ -> submitted = true },
            )
        }

        val joinButton = composeRule.onNode(hasText("加入家庭") and hasClickAction())
        joinButton.assertIsDisplayed()
        composeRule.onNodeWithText("家庭码").assertIsDisplayed().performTextInput("ABCD-EFGH")
        composeRule.onNodeWithText("设备名称").performTextInput("Pixel")
        joinButton.performClick()
        composeRule.runOnIdle { check(submitted) }
    }
}
