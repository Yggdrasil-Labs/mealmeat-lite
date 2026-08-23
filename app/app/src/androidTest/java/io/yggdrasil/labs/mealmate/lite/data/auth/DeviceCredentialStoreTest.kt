package io.yggdrasil.labs.mealmate.lite.data.auth

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DeviceCredentialStoreTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val suffix =
        java.util.UUID
            .randomUUID()
            .toString()
    private val alias = "mealmate_device_token_test_$suffix"
    private val fileName = "device-credential-test-$suffix.bin"
    private val store = AndroidDeviceCredentialStore(context, alias = alias, fileName = fileName)

    @After
    fun tearDown() =
        runBlocking {
            store.clear()
            store.deleteKeyForTest()
        }

    @Test
    fun encryptedCredentialRoundTripsWithoutPlaintextAtRest() =
        runBlocking {
            val credential =
                DeviceCredential(
                    deviceId = "11111111-1111-4111-8111-111111111111",
                    token = "secret-device-token",
                    sessionId = "22222222-2222-4222-8222-222222222222",
                    sessionGeneration = 42,
                )

            store.save(credential)

            assertEquals(credential, store.read())
            val bytes = context.noBackupFilesDir.resolve(fileName).readBytes()
            assertFalse(bytes.decodeToString().contains(credential.token))
            assertFalse(bytes.decodeToString().contains(credential.sessionId))

            store.clear()
            assertNull(store.read())
        }
}
