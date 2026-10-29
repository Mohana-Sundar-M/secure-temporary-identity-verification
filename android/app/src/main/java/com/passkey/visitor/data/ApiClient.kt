package com.passkey.visitor.data

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

object ApiClient {
    // Default URL for Android Emulator pointing to host machine (port 3000)
    // Physical devices on the same Wi-Fi should configure their host IP (e.g., http://192.168.1.100:3000)
    var baseUrl: String = "http://10.0.2.2:3000"
    var authToken: String? = null
    var currentUser: VisitorUser? = null

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun login(phone: String, password: String): Result<LoginResponse> = withContext(Dispatchers.IO) {
        try {
            val jsonBody = gson.toJson(mapOf("phone" to phone, "password" to password))
            val request = Request.Builder()
                .url("$baseUrl/api/auth/visitor/login")
                .post(jsonBody.toRequestBody(jsonMediaType))
                .build()

            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val errMsg = try {
                        gson.fromJson(body, Map::class.java)["error"] as? String
                    } catch (e: Exception) { null } ?: "Sign in failed (${response.code})"
                    return@withContext Result.failure(IOException(errMsg))
                }
                val loginData = gson.fromJson(body, LoginResponse::class.java)
                authToken = loginData.token
                currentUser = loginData.user
                Result.success(loginData)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun changePassword(currentPassword: String, newPassword: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val jsonBody = gson.toJson(mapOf("currentPassword" to currentPassword, "newPassword" to newPassword))
            val request = Request.Builder()
                .url("$baseUrl/api/auth/visitor/change-password")
                .header("Authorization", "Bearer $authToken")
                .post(jsonBody.toRequestBody(jsonMediaType))
                .build()

            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val errMsg = try {
                        gson.fromJson(body, Map::class.java)["error"] as? String
                    } catch (e: Exception) { null } ?: "Password change failed"
                    return@withContext Result.failure(IOException(errMsg))
                }
                currentUser = currentUser?.copy(requiresPasswordChange = false)
                Result.success(true)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getVisitorPasses(): Result<List<VisitorPass>> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/api/visitor/passes")
                .header("Authorization", "Bearer $authToken")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@withContext Result.failure(IOException("Failed to fetch passes"))
                }
                val type = object : TypeToken<Map<String, List<VisitorPass>>>() {}.type
                val map: Map<String, List<VisitorPass>> = gson.fromJson(body, type)
                Result.success(map["passes"] ?: emptyList())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getQrToken(passId: String): Result<QrTokenResponse> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/api/visitor/passes/$passId/token")
                .header("Authorization", "Bearer $authToken")
                .post("{}".toRequestBody(jsonMediaType))
                .build()

            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val errMsg = try {
                        gson.fromJson(body, Map::class.java)["error"] as? String
                    } catch (e: Exception) { null } ?: "Failed to generate QR token"
                    return@withContext Result.failure(IOException(errMsg))
                }
                val tokenData = gson.fromJson(body, QrTokenResponse::class.java)
                Result.success(tokenData)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun logout() {
        authToken = null
        currentUser = null
    }
}
