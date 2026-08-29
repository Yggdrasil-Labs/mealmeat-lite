package io.yggdrasil.labs.mealmate.lite.data.chat

import io.yggdrasil.labs.mealmate.lite.data.local.MealMateDatabase
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ChatDraftEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ConversationMessageEntity
import kotlinx.coroutines.flow.Flow

class RoomChatLocalStore(
    private val database: MealMateDatabase,
) : ChatLocalStore {
    private val dao = database.contractCacheDao()

    override fun observeMessages(): Flow<List<ConversationMessageEntity>> = dao.observeConversationMessages()

    override fun observeDraft(): Flow<ChatDraftEntity?> = dao.observeChatDraft()

    override suspend fun saveDraft(text: String) {
        dao.upsertChatDraft(ChatDraftEntity(text = text))
    }

    override suspend fun appendTurnAndClearDraft(
        user: ConversationMessageEntity,
        assistant: ConversationMessageEntity,
    ) {
        dao.appendConversationTurnAndClearDraft(user, assistant)
    }
}
