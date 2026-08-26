package io.yggdrasil.labs.mealmate.lite.data.recipes

import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class OfflineRecipeRepositoryTest {
    @Test
    fun `recipe patch command rejects an empty frozen patch`() {
        assertThrows(IllegalArgumentException::class.java) {
            RecipePatchCommand(name = null, tags = null)
        }
    }
}
