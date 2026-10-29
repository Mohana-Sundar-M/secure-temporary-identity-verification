package com.passkey.visitor.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.passkey.visitor.data.ApiClient
import com.passkey.visitor.data.VisitorPass
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisitorHomeScreen(
    onNavigateToPass: (String) -> Unit,
    onNavigateToDetails: (String) -> Unit,
    onNavigateToAccount: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var passes by remember { mutableStateOf<List<VisitorPass>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun refresh() {
        isLoading = true
        errorMessage = null
        coroutineScope.launch {
            val res = ApiClient.getVisitorPasses()
            isLoading = false
            res.onSuccess { list ->
                passes = list
            }.onFailure { err ->
                errorMessage = err.message ?: "Could not load access passes"
            }
        }
    }

    LaunchedEffect(Unit) {
        refresh()
    }

    val activePass = passes.firstOrNull { it.status == "ACTIVE" }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("PASSKEY", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text(
                            "Welcome, ${ApiClient.currentUser?.name ?: "Visitor"}",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = {
                    TextButton(onClick = onNavigateToAccount) {
                        Text("Account")
                    }
                }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (errorMessage != null) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(text = errorMessage.orEmpty(), color = MaterialTheme.colorScheme.error)
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { refresh() }) {
                        Text("Retry")
                    }
                }
            } else if (passes.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "No Passes Issued",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Your host administrator has not issued an active pass for your phone number.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedButton(onClick = { refresh() }) {
                        Text("Check for Updates")
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Hero Card: Primary Active Pass
                    if (activePass != null) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                                )
                            ) {
                                Column(modifier = Modifier.padding(20.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = activePass.id,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp
                                        )
                                        Surface(
                                            color = Color(0xFFDCFCE7),
                                            shape = MaterialTheme.shapes.extraSmall
                                        ) {
                                            Text(
                                                text = "ACTIVE",
                                                color = Color(0xFF166534),
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 11.sp,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(12.dp))
                                    Text(
                                        text = activePass.purpose,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 16.sp
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "Authorized Zones: ${activePass.allowedZones.joinToString(", ")}",
                                        fontSize = 13.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )

                                    Spacer(modifier = Modifier.height(20.dp))

                                    Button(
                                        onClick = { onNavigateToPass(activePass.id) },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text("View Digital Pass (QR)")
                                    }
                                }
                            }
                        }
                    }

                    // All Passes List
                    item {
                        Text(
                            text = "Your Passes",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }

                    items(passes) { pass ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onNavigateToDetails(pass.id) },
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface
                            )
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = pass.id,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp
                                    )
                                    Text(
                                        text = pass.purpose,
                                        fontSize = 13.sp,
                                        maxLines = 1,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    Text(
                                        text = "Zones: ${pass.allowedZones.joinToString(", ")}",
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }

                                Surface(
                                    color = when (pass.status) {
                                        "ACTIVE" -> Color(0xFFDCFCE7)
                                        "UPCOMING" -> Color(0xFFFEF3C7)
                                        "REVOKED" -> Color(0xFFFEE2E2)
                                        else -> Color(0xFFF1F5F9)
                                    },
                                    shape = MaterialTheme.shapes.extraSmall
                                ) {
                                    Text(
                                        text = pass.status,
                                        color = when (pass.status) {
                                            "ACTIVE" -> Color(0xFF166534)
                                            "UPCOMING" -> Color(0xFF92400E)
                                            "REVOKED" -> Color(0xFF991B1B)
                                            else -> Color(0xFF475569)
                                        },
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 11.sp,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
