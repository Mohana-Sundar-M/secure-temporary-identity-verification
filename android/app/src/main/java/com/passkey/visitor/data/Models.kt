package com.passkey.visitor.data

data class VisitorUser(
    val id: String,
    val name: String,
    val phone: String,
    val email: String?,
    val requiresPasswordChange: Boolean
)

data class LoginResponse(
    val token: String,
    val role: String,
    val user: VisitorUser
)

data class VisitorPass(
    val id: String,
    val visitorId: String,
    val visitorName: String,
    val visitorPhone: String,
    val visitorEmail: String?,
    val purpose: String,
    val allowedZones: List<String>,
    val validFrom: String,
    val expiresAt: String,
    val status: String,
    val isRevoked: Boolean,
    val notes: String?
)

data class QrTokenResponse(
    val tokenString: String,
    val expiresAt: Long,
    val refreshInterval: Int
)

data class GenericResponse(
    val success: Boolean,
    val message: String?
)
