package io.yggdrasil.labs.mealmate.lite.data.sync

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class SyncCoordinatorTest {
    @Test
    fun `action drain rejects a response whose ids do not match the claimed batch`() {
        assertEquals(
            false,
            SyncActionAcknowledgements.hasExactlyClaimedIds(setOf("first"), setOf("second")),
        )
    }
}
