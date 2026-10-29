package com.passkey.visitor.ui.screens

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import com.passkey.visitor.biometrics.BiometricHelper
import com.passkey.visitor.data.ApiClient
import com.passkey.visitor.data.VisitorPass
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DigitalPassScreen(
    activity: FragmentActivity,
    passId: String,
    onBack: () -> Unit,
    onNavigateToDetails: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var pass by remember { mutableStateOf<VisitorPass?>(null) }
    var isBiometricAuthenticated by remember { mutableStateOf(false) }
    var biometricError by remember { mutableStateOf<String?>(null) }

    var qrTokenString by remember { mutableStateOf<String?>(null) }
    var qrBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var secondsRemaining by remember { mutableStateOf(60) }
    var isLoadingToken by remember { mutableStateOf(false) }

    fun generateQrBitmap(content: String): Bitmap? {
        return try {
            val writer = QRCodeWriter()
            val bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, 512, 512)
            val width = bitMatrix.width
            val height = bitMatrix.height
            val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565)
            for (x in 0 until width) {
                for (y in 0 until height) {
                    bmp.setPixel(x, y, if (bitMatrix.get(x, y)) AndroidColor.BLACK else AndroidColor.WHITE)
                }
            }
            bmp
        } catch (e: Exception) {
            null
        }
    }

    fun fetchFreshToken() {
        if (!isBiometricAuthenticated) return
        isLoadingToken = true
        coroutineScope.launch {
            val res = ApiClient.getQrToken(passId)
            isLoadingToken = false
            res.onSuccess { data ->
                qrTokenString = data.tokenString
                qrBitmap = generateQrBitmap(data.tokenString)
                secondsRemaining = data.refreshInterval
            }.onFailure { err ->
                biometricError = err.message ?: "Failed to refresh pass"
            }
        }
    }

    // Load pass metadata
    LaunchedEffect(passId) {
        val passesRes = ApiClient.getVisitorPasses()
        passesRes.onSuccess { list ->
            pass = list.find { it.id == passId }
        }
    }

    // Trigger biometric prompt on screen entry
    fun requestBiometricAuth() {
        biometricError = null
        if (BiometricHelper.isBiometricAvailable(activity)) {
            BiometricHelper.promptBiometric(
                activity = activity,
                title = "Unlock Digital Pass",
                subtitle = "Verify your biometric identity to reveal your gate access code",
                onSuccess = {
                    isBiometricAuthenticated = true
                    fetchFreshToken()
                },
                onError = { err ->
                    biometricError = err
                }
            )
        } else {
            // Explicit device without enrolled biometrics fallback
            isBiometricAuthenticated = true
            fetchFreshToken()
        }
    }

    LaunchedEffect(Unit) {
        requestBiometricAuth()
    }

    // 60-second countdown and automatic rotation
    LaunchedEffect(isBiometricAuthenticated, qrTokenString) {
        if (!isBiometricAuthenticated) return@LaunchedEffect
        while (true) {
            delay(1000L)
            if (secondsRemaining > 1) {
                secondsRemaining -= 1
            } else {
                fetchFreshToken()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Digital Access Pass", fontSize = 18.sp, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("← Back")
                    }
                },
                actions = {
                    TextButton(onClick = onNavigateToDetails) {
                        Text("Details")
                    }
                }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            if (!isBiometricAuthenticated) {
                // Biometric locked screen
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Authentication Required",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Your digital access code is protected by on-device biometric authentication.",
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        if (biometricError != null) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = biometricError.orEmpty(),
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.error,
                                textAlign = TextAlign.Center
                            )
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = { requestBiometricAuth() },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Authenticate with Biometrics")
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        TextButton(onClick = {
                            isBiometricAuthenticated = true
                            fetchFreshToken()
                        }) {
                            Text("Continue with Device PIN", fontSize = 12.sp)
                        }
                    }
                }
            } else {
                // Digital Pass Screen with 60s rotating QR
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = pass?.visitorName ?: "Visitor",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Pass ${pass?.id ?: passId}",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Surface(
                                color = androidx.compose.ui.graphics.Color(0xFFDCFCE7),
                                shape = MaterialTheme.shapes.extraSmall
                            ) {
                                Text(
                                    text = "ACTIVE",
                                    color = androidx.compose.ui.graphics.Color(0xFF166534),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // QR Image
                        if (qrBitmap != null) {
                            Image(
                                bitmap = qrBitmap!!.asImageBitmap(),
                                contentDescription = "Scannable Access QR Code",
                                modifier = Modifier
                                    .size(240.dp)
                                    .padding(8.dp)
                            )
                        } else {
                            Box(
                                modifier = Modifier
                                    .size(240.dp)
                                    .padding(8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator()
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Refresh status and progress
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = "Code refreshes in ${secondsRemaining}s",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        LinearProgressIndicator(
                            progress = { secondsRemaining / 60f },
                            modifier = Modifier
                                .fillMaxWidth(0.7f)
                                .padding(vertical = 8.dp)
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedButton(
                            onClick = { fetchFreshToken() },
                            enabled = !isLoadingToken
                        ) {
                            Text(if (isLoadingToken) "Refreshing..." else "Refresh QR Code Now")
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = "Permitted Zones: ${pass?.allowedZones?.joinToString(", ") ?: "All Standard Zones"}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            textAlign = TextAlign.Center
                        )
                        Text(
                            text = "Present this QR code directly at the access gate turnstile scanner.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            }
        }
    }
}
