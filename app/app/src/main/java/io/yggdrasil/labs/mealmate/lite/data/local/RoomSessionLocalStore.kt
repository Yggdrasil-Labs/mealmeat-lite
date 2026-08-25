package io.yggdrasil.labs.mealmate.lite.data.local

import io.yggdrasil.labs.mealmate.lite.data.auth.DeviceCredential
import io.yggdrasil.labs.mealmate.lite.data.auth.LocalSession
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionLocalStore
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionPhase
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ClientSessionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ClientSessionState

class RoomSessionLocalStore(
    private val database: MealMateDatabase,
) : SessionLocalStore {
    override suspend fun read(): LocalSession? =
        database.contractCacheDao().getClientSession()?.let { entity ->
            LocalSession(
                sessionId = entity.sessionId,
                generation = entity.sessionGeneration,
                phase =
                    when (entity.state) {
                        ClientSessionState.ACTIVE -> SessionPhase.Active
                        ClientSessionState.PROVISIONING -> SessionPhase.Provisioning
                        ClientSessionState.SWITCHING -> SessionPhase.Switching
                    },
                selectedModelId = entity.selectedModelId,
            )
        }

    override suspend fun replaceWithProvisioning(credential: DeviceCredential) {
        database.contractCacheDao().replaceSession(
            ClientSessionEntity(
                sessionId = credential.sessionId,
                sessionGeneration = credential.sessionGeneration,
                state = ClientSessionState.PROVISIONING,
            ),
        )
    }

    override suspend fun selectModel(
        credential: DeviceCredential,
        selectedModelId: String,
    ): Boolean =
        database.contractCacheDao().selectModel(
            sessionId = credential.sessionId,
            generation = credential.sessionGeneration,
            modelId = selectedModelId,
        ) == 1

    override suspend fun promote(credential: DeviceCredential): Boolean {
        val dao = database.contractCacheDao()
        if (dao.promoteClientSession(credential.sessionId, credential.sessionGeneration) == 1) return true
        return dao.getClientSession()?.let { session ->
            session.sessionId == credential.sessionId &&
                session.sessionGeneration == credential.sessionGeneration &&
                session.state == ClientSessionState.ACTIVE &&
                !session.selectedModelId.isNullOrBlank()
        } == true
    }

    override suspend fun markSwitching(credential: DeviceCredential) {
        database.contractCacheDao().replaceSession(
            ClientSessionEntity(
                sessionId = credential.sessionId,
                sessionGeneration = credential.sessionGeneration,
                state = ClientSessionState.SWITCHING,
            ),
        )
    }

    override suspend fun clear() {
        database.contractCacheDao().clearSessionData()
    }
}
