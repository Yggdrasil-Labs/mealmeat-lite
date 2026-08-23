package io.yggdrasil.labs.mealmate.lite.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.DeviceView

@Composable
fun SettingsScreen(viewModel: SettingsViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.refresh() }
    SettingsScreenContent(
        state = state,
        onRefresh = viewModel::refresh,
        onRotateFamilyCode = viewModel::rotateFamilyCode,
        onDismissFamilyCode = viewModel::dismissRotatedFamilyCode,
        onRevokeDevice = viewModel::revokeDevice,
        onLogout = viewModel::logout,
    )
}

@Composable
@Suppress("LongParameterList")
fun SettingsScreenContent(
    state: SettingsUiState,
    onRefresh: () -> Unit,
    onRotateFamilyCode: () -> Unit,
    onDismissFamilyCode: () -> Unit,
    onRevokeDevice: (String) -> Unit,
    onLogout: () -> Unit,
) {
    var pendingRevoke by remember { mutableStateOf<DeviceView?>(null) }
    var showLogoutConfirmation by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text("设置", style = MaterialTheme.typography.headlineMedium)
            Text("家庭与设备", style = MaterialTheme.typography.titleMedium)
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onRefresh, enabled = !state.isLoading) { Text("刷新设备") }
                OutlinedButton(onClick = onRotateFamilyCode, enabled = !state.isLoading) { Text("轮换家庭码") }
            }
        }
        item { HorizontalDivider() }
        items(state.devices, key = { it.id.toString() }) { device ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(device.deviceName, style = MaterialTheme.typography.titleMedium)
                        if (device.isCurrent) Text("当前设备", color = MaterialTheme.colorScheme.primary)
                    }
                    Text("最近使用：${device.lastUsedAt}", style = MaterialTheme.typography.bodySmall)
                    if (!device.isCurrent) {
                        TextButton(onClick = { pendingRevoke = device }) { Text("撤销设备") }
                    }
                }
            }
        }
        item {
            Button(onClick = { showLogoutConfirmation = true }, modifier = Modifier.fillMaxWidth()) {
                Text("退出当前设备")
            }
        }
        state.errorMessage?.let { message ->
            item { Text(message, color = MaterialTheme.colorScheme.error) }
        }
    }

    pendingRevoke?.let { device ->
        AlertDialog(
            onDismissRequest = { pendingRevoke = null },
            title = { Text("撤销设备") },
            text = { Text("撤销 ${device.deviceName} 后，该设备将无法继续访问家庭数据。") },
            confirmButton = {
                TextButton(onClick = {
                    onRevokeDevice(device.id.toString())
                    pendingRevoke = null
                }) { Text("确认撤销") }
            },
            dismissButton = { TextButton(onClick = { pendingRevoke = null }) { Text("取消") } },
        )
    }
    if (showLogoutConfirmation) {
        AlertDialog(
            onDismissRequest = { showLogoutConfirmation = false },
            title = { Text("退出当前设备") },
            text = { Text("退出后需要重新加入家庭才能使用此设备。") },
            confirmButton = {
                TextButton(onClick = {
                    showLogoutConfirmation = false
                    onLogout()
                }) { Text("确认退出") }
            },
            dismissButton = { TextButton(onClick = { showLogoutConfirmation = false }) { Text("取消") } },
        )
    }
    state.rotatedFamilyCode?.let { code ->
        AlertDialog(
            onDismissRequest = onDismissFamilyCode,
            title = { Text("新的家庭码") },
            text = { Text(code, style = MaterialTheme.typography.headlineSmall) },
            confirmButton = { TextButton(onClick = onDismissFamilyCode) { Text("已保存") } },
        )
    }
}
