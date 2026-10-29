# PASSKEY — Native Android Visitor Application

This folder contains the complete, production-structured Kotlin + Jetpack Compose Android client for **PASSKEY — Temporary Identity & Access**.

## Architectural Highlights

- **Jetpack Compose + Material 3 UI**: Clean white-theme design system conforming to Android Modern Architecture.
- **Hardware-Backed Biometrics**: Uses AndroidX `BiometricPrompt` (`BIOMETRIC_STRONG or DEVICE_CREDENTIAL`) to gate pass QR presentation behind native biometric authentication (fingerprint/face) or device passcode.
- **Zero Raw Biometric Leakage**: No biometric images, templates, or hashes ever leave the Android secure enclave or touch network requests. Only an authentic API call is made after Android OS reports successful authentication.
- **60-Second Rotating Token Presentation**: Generates local dynamic QR bitmaps via ZXing using fresh server-issued, time-bounded presentation tokens that rotate every 60 seconds with an instant manual refresh option.
- **First-Login Security**: Automatically detects if the visitor is logging in for the first time with an admin-assigned temporary password and forces an immediate password change before granting pass access.

## Project Structure

```
android/
├── build.gradle.kts                 # Project-level Gradle configuration
├── settings.gradle.kts              # Module and repository declaration
├── README.md                        # Documentation and build guide
└── app/
    ├── build.gradle.kts             # App-level Gradle dependencies (Compose, Biometrics, ZXing, OkHttp)
    └── src/main/
        ├── AndroidManifest.xml      # Camera/Internet/Biometric permissions
        └── java/com/passkey/visitor/
            ├── MainActivity.kt      # Main Activity, lifecycle and navigation host
            ├── biometrics/
            │   └── BiometricHelper.kt   # BiometricPrompt wrapper with device fallback
            ├── data/
            │   ├── Models.kt        # Pass, VisitorAccount, PresentationToken models
            │   └── ApiClient.kt     # OkHttp client for shared REST API
            └── ui/screens/
                ├── SignInScreen.kt                  # Phone + password sign in
                ├── FirstLoginChangePasswordScreen.kt# Enforced initial password change
                ├── VisitorHomeScreen.kt             # Active & scheduled passes list
                ├── DigitalPassScreen.kt             # Biometric gate & 60s rotating QR
                ├── PassDetailsScreen.kt             # Full pass specs & zone authorizations
                └── AccountScreen.kt                 # Visitor security & passcode management
```

## How to Build and Run in Android Studio

1. **Prerequisites**:
   - Android Studio Ladybug (2024.2+) or newer.
   - Android SDK 34 / Java 17+.
   - An Android device or emulator with Android 8.0 (API level 26) or higher.

2. **Open Project**:
   - Open Android Studio.
   - Select **File > Open** and choose the `/android` directory.
   - Allow Gradle to sync dependencies (`androidx.biometric:biometric`, `com.google.zxing:core`, `com.squareup.okhttp3:okhttp`, Compose BOM).

3. **Configure API Host**:
   - In `android/app/src/main/java/com/passkey/visitor/data/ApiClient.kt`, set `BASE_URL`:
     - Android Emulator: `http://10.0.2.2:3000` (maps automatically to host machine's `localhost:3000`).
     - Physical Device on local Wi-Fi: `http://<YOUR_LOCAL_IP>:3000` (e.g. `http://192.168.1.105:3000`).

4. **Run**:
   - Click **Run 'app'** (`Shift + F10`) to deploy to your emulator or connected device.
   - Sign in with default test credentials:
     - Phone: `+1 (555) 234-5678`
     - Password: `visitor123`
     - Or sign in with a newly issued pass from the Web Admin Portal (`/create-pass`).
