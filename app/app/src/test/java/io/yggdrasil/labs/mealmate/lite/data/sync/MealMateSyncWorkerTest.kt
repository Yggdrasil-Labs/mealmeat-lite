package io.yggdrasil.labs.mealmate.lite.data.sync

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class MealMateSyncWorkerTest {
    @Test
    fun `periodic work uses a stable unique name`() {
        assertEquals("mealmate-sync-periodic", MealMateSyncWorker.PERIODIC_WORK_NAME)
    }
}
