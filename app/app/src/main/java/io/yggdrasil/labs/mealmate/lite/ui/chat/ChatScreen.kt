package io.yggdrasil.labs.mealmate.lite.ui.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ConversationMessageEntity

/**
 * 对话主页 — MVP 主入口
 */
@Composable
fun ChatScreen(viewModel: ChatViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("对话", style = MaterialTheme.typography.headlineSmall)
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(state.messages, key = { it.localSequence }) { message ->
                MessageBubble(message)
            }
            if (state.streamingText.isNotEmpty()) {
                item {
                    MessageBubble(
                        ConversationMessageEntity(
                            role = "assistant",
                            content = state.streamingText,
                            createdAt = "",
                        ),
                    )
                }
            }
        }
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (state.sending) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        OutlinedTextField(
            value = state.draft,
            onValueChange = viewModel::updateDraft,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("消息") },
            enabled = !state.sending,
        )
        Button(
            onClick = viewModel::send,
            enabled =
                !state.sending &&
                    state.draft.isNotBlank() &&
                    (state.error == null || state.retryable),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (state.error == null) "发送" else "重试")
        }
    }
}

@Composable
private fun MessageBubble(message: ConversationMessageEntity) {
    Text(
        text = if (message.role == "user") "我：${message.content}" else "AI：${message.content}",
        modifier = Modifier.fillMaxWidth(),
    )
}
