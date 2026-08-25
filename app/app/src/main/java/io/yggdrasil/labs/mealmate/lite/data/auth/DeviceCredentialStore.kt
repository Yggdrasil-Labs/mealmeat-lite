package io.yggdrasil.labs.mealmate.lite.data.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.annotation.VisibleForTesting
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.GeneralSecurityException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@Serializable
data class DeviceCredential(
    val deviceId: String,
    val token: String,
    val sessionId: String,
    val sessionGeneration: Long,
    val state: CredentialState = CredentialState.ACTIVE,
)

@Serializable
enum class CredentialState {
    SWITCHING,
    ACTIVE,
}

interface DeviceCredentialStore {
    suspend fun read(): DeviceCredential?

    suspend fun save(credential: DeviceCredential)

    suspend fun clear()
}

class AndroidDeviceCredentialStore(
    context: Context,
    private val alias: String = DEFAULT_KEY_ALIAS,
    fileName: String = DEFAULT_FILE_NAME,
) : DeviceCredentialStore {
    private val credentialFile = File(context.noBackupFilesDir, fileName)
    private val json = Json { encodeDefaults = true }

    override suspend fun read(): DeviceCredential? =
        withContext(Dispatchers.IO) {
            if (!credentialFile.exists()) return@withContext null

            try {
                val encrypted = readEncryptedPayload()
                val cipher = Cipher.getInstance(TRANSFORMATION)
                cipher.init(Cipher.DECRYPT_MODE, readKey(), GCMParameterSpec(TAG_LENGTH_BITS, encrypted.iv))
                json.decodeFromString<DeviceCredential>(cipher.doFinal(encrypted.ciphertext).decodeToString())
            } catch (_: GeneralSecurityException) {
                credentialFile.delete()
                null
            } catch (_: SerializationException) {
                credentialFile.delete()
                null
            } catch (_: IOException) {
                credentialFile.delete()
                null
            } catch (_: IllegalArgumentException) {
                credentialFile.delete()
                null
            }
        }

    override suspend fun save(credential: DeviceCredential) =
        withContext(Dispatchers.IO) {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
            val ciphertext = cipher.doFinal(json.encodeToString(credential).encodeToByteArray())
            val tempFile = File.createTempFile("device-credential-", ".tmp", credentialFile.parentFile)

            try {
                FileOutputStream(tempFile).use { output ->
                    DataOutputStream(output).use { data ->
                        data.writeInt(FILE_MAGIC)
                        data.writeInt(cipher.iv.size)
                        data.write(cipher.iv)
                        data.writeInt(ciphertext.size)
                        data.write(ciphertext)
                        data.flush()
                        output.fd.sync()
                    }
                }
                replaceAtomically(tempFile, credentialFile)
            } finally {
                tempFile.delete()
            }
        }

    override suspend fun clear() =
        withContext(Dispatchers.IO) {
            if (credentialFile.exists() && !credentialFile.delete()) {
                throw IOException("Unable to clear device credential")
            }
        }

    @VisibleForTesting
    suspend fun deleteKeyForTest() =
        withContext(Dispatchers.IO) {
            keyStore().deleteEntry(alias)
        }

    @Suppress("ThrowsCount")
    private fun readEncryptedPayload(): EncryptedPayload {
        if (credentialFile.length() !in 1..MAX_FILE_SIZE_BYTES) {
            throw IOException("Invalid credential file size")
        }

        return DataInputStream(FileInputStream(credentialFile)).use { data ->
            if (data.readInt() != FILE_MAGIC) throw IOException("Invalid credential file")
            val ivSize = data.readInt()
            if (ivSize !in MIN_IV_SIZE_BYTES..MAX_IV_SIZE_BYTES) throw IOException("Invalid IV size")
            val iv = ByteArray(ivSize).also(data::readFully)
            val ciphertextSize = data.readInt()
            if (ciphertextSize !in 1..MAX_FILE_SIZE_BYTES) throw IOException("Invalid ciphertext size")
            val ciphertext = ByteArray(ciphertextSize).also(data::readFully)
            if (data.read() != -1) throw IOException("Unexpected credential data")
            EncryptedPayload(iv, ciphertext)
        }
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = keyStore()
        (keyStore.getKey(alias, null) as? SecretKey)?.let { return it }

        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE).run {
            init(
                KeyGenParameterSpec
                    .Builder(
                        alias,
                        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                    ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(KEY_SIZE_BITS)
                    .setRandomizedEncryptionRequired(true)
                    .build(),
            )
            generateKey()
        }
    }

    private fun readKey(): SecretKey =
        keyStore().getKey(alias, null) as? SecretKey
            ?: throw GeneralSecurityException("Device credential key is unavailable")

    private fun keyStore(): KeyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }

    private fun replaceAtomically(
        source: File,
        target: File,
    ) {
        try {
            Files.move(
                source.toPath(),
                target.toPath(),
                StandardCopyOption.ATOMIC_MOVE,
                StandardCopyOption.REPLACE_EXISTING,
            )
        } catch (_: AtomicMoveNotSupportedException) {
            Files.move(source.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING)
        }
    }

    private data class EncryptedPayload(
        val iv: ByteArray,
        val ciphertext: ByteArray,
    )

    private companion object {
        const val DEFAULT_KEY_ALIAS = "mealmate_device_token_v1"
        const val DEFAULT_FILE_NAME = "device-credential-v1.bin"
        const val ANDROID_KEY_STORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val TAG_LENGTH_BITS = 128
        const val KEY_SIZE_BITS = 256
        const val FILE_MAGIC = 0x4D4D4331
        const val MIN_IV_SIZE_BYTES = 12
        const val MAX_IV_SIZE_BYTES = 32
        const val MAX_FILE_SIZE_BYTES = 16 * 1024
    }
}
