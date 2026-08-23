package io.yggdrasil.labs.mealmate.lite.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun JoinRecoveryScreen(
    state: AuthUiState.Join,
    onBootstrap: (String, String) -> Unit,
    onRegister: (String, String) -> Unit,
) {
    var deviceName by rememberSaveable { mutableStateOf("") }
    var bootstrapSecret by rememberSaveable { mutableStateOf("") }
    var familyCode by rememberSaveable { mutableStateOf("") }

    val isBootstrap = state.mode == JoinMode.Bootstrap
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = if (isBootstrap) "创建家庭" else "加入家庭",
            style = MaterialTheme.typography.headlineMedium,
        )
        Text(
            text = if (isBootstrap) "使用一次性初始化密钥创建家庭" else "输入家庭码，将此设备加入已有家庭",
            style = MaterialTheme.typography.bodyMedium,
        )
        OutlinedTextField(
            value = deviceName,
            onValueChange = { deviceName = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("设备名称") },
            singleLine = true,
        )
        if (isBootstrap) {
            OutlinedTextField(
                value = bootstrapSecret,
                onValueChange = { bootstrapSecret = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("初始化密钥") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
            )
            Button(
                onClick = { onBootstrap(bootstrapSecret, deviceName) },
                enabled = bootstrapSecret.isNotBlank() && deviceName.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("创建并继续")
            }
        } else {
            OutlinedTextField(
                value = familyCode,
                onValueChange = { familyCode = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("家庭码") },
                singleLine = true,
            )
            Button(
                onClick = { onRegister(familyCode, deviceName) },
                enabled = familyCode.isNotBlank() && deviceName.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("加入家庭")
            }
        }
        state.errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
fun ProvisioningScreen(
    state: AuthUiState.Provisioning,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        CircularProgressIndicator()
        Text("正在准备设备", style = MaterialTheme.typography.headlineSmall)
        state.errorMessage?.let {
            Text(it, color = MaterialTheme.colorScheme.error)
            Button(onClick = onRetry) { Text("重试") }
        }
    }
}

@Composable
fun FamilyCodeScreen(
    familyCode: String,
    onConfirm: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("家庭已创建", style = MaterialTheme.typography.headlineMedium)
        Text("请安全保存这个家庭码，之后用于加入其他设备。")
        Text(familyCode, style = MaterialTheme.typography.headlineLarge)
        Button(onClick = onConfirm, modifier = Modifier.fillMaxWidth()) { Text("我已保存，进入应用") }
    }
}
