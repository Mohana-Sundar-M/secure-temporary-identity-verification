package com.passkey.visitor.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.passkey.visitor.data.ApiClient
import com.passkey.visitor.data.VisitorUser
import kotlinx.coroutines.launch

@Composable
fun SignInScreen(
    onSignInSuccess: (VisitorUser) -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var phone by remember { mutableStateOf("+1 (555) 234-5678") }
    var password by remember { mutableStateOf("visitor123") }
    var showPassword by remember { mutableStateOf(false) }
    var serverUrl by remember { mutableStateOf(ApiClient.baseUrl) }
    var showServerConfig by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Brand Wordmark
        Surface(
            color = MaterialTheme.colorScheme.primary,
            shape = MaterialTheme.shapes.small,
            modifier = Modifier.size(56.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = "PK",
                    color = MaterialTheme.colorScheme.onPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "PASSKEY Visitor",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = "Temporary Digital Identity & Access",
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(32.dp))

        OutlinedTextField(
            value = phone,
            onValueChange = { phone = it },
            label = { Text("Mobile Phone Number") },
            placeholder = { Text("+1 (555) 000-0000") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            trailingIcon = {
                TextButton(onClick = { showPassword = !showPassword }) {
                    Text(if (showPassword) "Hide" else "Show", fontSize = 12.sp)
                }
            },
            modifier = Modifier.fillMaxWidth()
        )

        if (errorMessage != null) {
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = errorMessage.orEmpty(),
                color = MaterialTheme.colorScheme.error,
                fontSize = 13.sp
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                errorMessage = null
                isLoading = true
                coroutineScope.launch {
                    val result = ApiClient.login(phone, password)
                    isLoading = false
                    result.onSuccess { res ->
                        onSignInSuccess(res.user)
                    }.onFailure { err ->
                        errorMessage = err.message ?: "Sign in failed"
                    }
                }
            },
            enabled = !isLoading && phone.isNotBlank() && password.isNotBlank(),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
            } else {
                Text("Sign In", fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Backend URL configuration toggle for physical device vs emulator
        TextButton(onClick = { showServerConfig = !showServerConfig }) {
            Text("API Server: ${ApiClient.baseUrl}", fontSize = 11.sp, color = MaterialTheme.colorScheme.outline)
        }

        if (showServerConfig) {
            OutlinedTextField(
                value = serverUrl,
                onValueChange = {
                    serverUrl = it
                    ApiClient.baseUrl = it
                },
                label = { Text("API Base URL") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Text(
                text = "Use http://10.0.2.2:3000 for emulator, or your PC IP for physical phone",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.outline,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}
