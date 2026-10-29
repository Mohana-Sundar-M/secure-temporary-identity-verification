package com.passkey.visitor

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.passkey.visitor.data.ApiClient
import com.passkey.visitor.ui.screens.*

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()

                    NavHost(navController = navController, startDestination = "signin") {
                        composable("signin") {
                            SignInScreen(
                                onSignInSuccess = { user ->
                                    if (user.requiresPasswordChange) {
                                        navController.navigate("first_login_change_password") {
                                            popUpTo("signin") { inclusive = true }
                                        }
                                    } else {
                                        navController.navigate("home") {
                                            popUpTo("signin") { inclusive = true }
                                        }
                                    }
                                }
                            )
                        }

                        composable("first_login_change_password") {
                            FirstLoginChangePasswordScreen(
                                onSuccess = {
                                    navController.navigate("home") {
                                        popUpTo("first_login_change_password") { inclusive = true }
                                    }
                                }
                            )
                        }

                        composable("home") {
                            VisitorHomeScreen(
                                onNavigateToPass = { passId ->
                                    navController.navigate("digital_pass/$passId")
                                },
                                onNavigateToDetails = { passId ->
                                    navController.navigate("pass_details/$passId")
                                },
                                onNavigateToAccount = {
                                    navController.navigate("account")
                                }
                            )
                        }

                        composable("digital_pass/{passId}") { backStackEntry ->
                            val passId = backStackEntry.arguments?.getString("passId").orEmpty()
                            DigitalPassScreen(
                                activity = this@MainActivity,
                                passId = passId,
                                onBack = { navController.popBackStack() },
                                onNavigateToDetails = {
                                    navController.navigate("pass_details/$passId")
                                }
                            )
                        }

                        composable("pass_details/{passId}") { backStackEntry ->
                            val passId = backStackEntry.arguments?.getString("passId").orEmpty()
                            PassDetailsScreen(
                                passId = passId,
                                onBack = { navController.popBackStack() },
                                onRevealQr = {
                                    navController.navigate("digital_pass/$passId") {
                                        popUpTo("home")
                                    }
                                }
                            )
                        }

                        composable("account") {
                            AccountScreen(
                                onBack = { navController.popBackStack() },
                                onSignOut = {
                                    ApiClient.logout()
                                    navController.navigate("signin") {
                                        popUpTo("home") { inclusive = true }
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
