# PASSKEY — Secure Temporary Identity & Short-Term Access Management

> **University Design Project 1 — Connected Full-Stack Access Management MVP**

PASSKEY is a production-grade, end-to-end working system demonstrating how security administrators issue temporary digital credentials using mobile phone numbers, how visitors authenticate and present 60-second rotating passes on mobile devices protected by on-device biometrics, and how turnstile gates authoritatively verify credentials with immediate replay rejection and revocation enforcement.

The system consists of:
1. **Administrator Web Portal**: Issue passes, inspect visitor records, manage facility access zones, monitor live turnstile check-ins, and revoke credentials instantly.
2. **Native Android Visitor Application** (`android/`): Modern Kotlin + Jetpack Compose app featuring AndroidX `BiometricPrompt`, local QR generation with ZXing, and REST client.
3. **Browser Mobile Experience** (`/visitor`): Full browser-based visitor client mirroring the native mobile app experience with phone sign-in, forced initial password change, on-device biometric simulation, and 60-second rotating QR code.
4. **Authoritative Access Controller & Turnstile Scanner** (`/gate`): Optical camera barcode scanning, manual reference fallback, 60s HMAC token verification, zone authorization, and replay attack prevention.
5. **Shared Local Backend** (`server.ts` + `data/db.json`): Self-contained Express REST API with PBKDF2 password hashing, salt generation, time-bounded HMAC tokens, and tamper-evident audit logging. No external cloud databases or paid APIs required.

---

## 1. System Architecture & Security Invariants

### A. Zero Biometric Data Transmission
- Visitor biometric fingerprints and facial templates are **never collected as images, never transmitted across network requests, and never stored in the database**.
- Hardware authenticators (Android `BiometricPrompt` or device secure elements) perform user verification locally on the visitor's handset.
- The server only validates time-bound, cryptographically signed presentation tokens issued after local authentication completes.

### B. 60-Second Dynamic Rotating QR Presentation
- When a visitor presents their pass at a turnstile, the client generates a fresh HMAC presentation token valid for strictly 60 seconds (configurable in settings).
- Each token contains a unique `tokenId`, issuance timestamp, and expiration time.
- Turnstiles record consumed `tokenId`s to immediately reject replay attacks (e.g. screenshot sharing or intercepted tokens).
- Visitors can manually refresh their pass QR code at any time with a single tap.

### C. First-Login Passcode Lifecycle
- When an administrator creates a visitor pass, the server generates a temporary initial passcode (displayed once on the admin confirmation screen).
- On first login to the visitor app, the visitor is required to establish a personal passcode before being granted access to their digital pass.

### D. Authoritative Instant Revocation
- When an administrator revokes a pass from the dashboard or pass list, the revocation takes immediate effect in the access controller.
- Any subsequent turnstile scan of that pass is denied instantly with a human-readable security explanation recorded in the audit log.

---

## 2. Default Demonstration Credentials

The database automatically initializes with realistic sample accounts for live demonstration:

| Portal / Role | Identifier (Username or Phone) | Password | Notes |
|---|---|---|---|
| **Administrator** | `admin` | `admin123` | Full access to portal, settings, pass issuance, and audit trail |
| **Active Visitor** | `+1 (555) 234-5678` | `visitor123` | Prof. Elena Rostova — Active pass (`PK-8041`) with 3 permitted zones |
| **New Visitor** | `+1 (555) 567-8901` | `Passkey-Demo-9821` | Sarah Jenkins — Tests the mandatory first-login passcode change |
| **Expired Visitor** | `+1 (555) 345-6789` | `visitor123` | Marcus Vance — Expired pass (`PK-8042`) |
| **Revoked Visitor** | `+1 (555) 456-7890` | `visitor123` | David Chen — Revoked pass (`PK-8043`) |

---

## 3. Project Structure

```
├── android/                         # Complete Native Kotlin + Jetpack Compose Android Client
│   ├── app/build.gradle.kts         # Android dependencies (Biometrics, ZXing, OkHttp, Compose)
│   ├── src/main/AndroidManifest.xml # Permissions (Camera, Internet, Biometrics)
│   ├── src/main/java/com/passkey/visitor/
│   │   ├── MainActivity.kt          # Compose navigation and activity host
│   │   ├── biometrics/              # BiometricPrompt integration
│   │   ├── data/                    # Models & ApiClient
│   │   └── ui/screens/              # SignIn, FirstLogin, Home, DigitalPass, Details, Account
│   └── README.md                    # Android Studio build and deployment instructions
├── data/
│   └── db.json                      # Persistent local authoritative database
├── server/
│   ├── db.ts                        # Database service (passwords, tokens, lifecycle, audit)
│   └── db.test.ts                   # Unit tests (node:test test suite)
├── src/
│   ├── components/                  # Navigation bar, Status badges
│   ├── services/api.ts              # REST API client
│   ├── types/index.ts               # Domain data contracts
│   └── views/
│       ├── AdminLoginView.tsx       # Administrator sign-in
│       ├── AdminDashboardView.tsx   # Live operations metrics & recent scans
│       ├── CreatePassWizard.tsx     # Pass issuance & initial password callout
│       ├── PassListView.tsx         # Pass directory, search, filter, and revocation
│       ├── PassDetailView.tsx       # Pass specifications & gate scan history
│       ├── GateConsoleView.tsx      # Turnstile scanner with 1-click test scenarios
│       ├── AuditTrailView.tsx       # Comprehensive access activity log
│       ├── SettingsView.tsx         # Zones management, token interval, admin password
│       └── VisitorMobileWebView.tsx # Web mirror of Android visitor application
├── index.html                       # HTML entry point
├── package.json                     # Scripts & dependencies
├── server.ts                        # Full-stack Express server mounting Vite in dev mode
└── vite.config.ts                   # Vite configuration
```

---

## 4. How to Run and Test

### A. Run the Web Application
```bash
# 1. Install dependencies
npm install

# 2. Run automated backend unit tests
npm test

# 3. Start development server (Node.js/Express backend on port 3000)
npm run dev
```

Open `http://localhost:3000` in your web browser.

### B. Demonstration Walkthrough Steps

1. **Administrator Sign-In**:
   - Navigate to `http://localhost:3000`.
   - Sign in using `admin` / `admin123`.
   - Review live metrics on the Access Operations Dashboard.

2. **Issue a New Visitor Pass**:
   - Click **Issue Pass**.
   - Enter visitor details (e.g., Name: `Dr. Maya Lin`, Phone: `+1 (555) 789-0123`, Purpose: `Research Keynote`).
   - Select authorized access zones and click **Issue Access Pass**.
   - Note the **Initial Visitor Passcode** displayed once on the confirmation card with the Copy button.
   - Click **Launch Visitor App**.

3. **Visitor First Login & Biometric Pass Presentation**:
   - Sign in with the visitor's phone number and initial temporary passcode.
   - The app detects first login and prompts for a new personal passcode.
   - After setting the passcode, view the active digital pass.
   - Tap **Touch to Authenticate** to simulate biometric handset verification.
   - The dynamic 60-second rotating QR code activates with a countdown bar and instant refresh button.

4. **Gate Turnstile Verification**:
   - Open **Gate Console** (`/gate`).
   - Run the 1-click test scenarios or enter a pass reference:
     - **Valid Pass**: Access Granted at authorized zone.
     - **Revoked Pass**: Access Denied with revocation reason.
     - **Expired Pass**: Access Denied due to ended validity window.
     - **Unauthorized Zone**: Access Denied due to zone restriction.
     - **Replay Attack**: Scanned twice — immediately rejected as a consumed token.

5. **Review Access Activity & Audit Trail**:
   - Navigate to **Access Activity** (`/audit`).
   - Review the tamper-evident chronological event log showing timestamps, visitor names, zones, and human-readable reasons.

6. **Native Android App**:
   - Follow instructions in `android/README.md` to open the project in Android Studio and deploy to an Android phone or emulator.

---

## 5. Security Evaluation Invariants

- **Fail-Closed Gate Authorization**: Gate decisions fail closed on malformed payloads, expired timestamps, mismatched signatures, unauthorized zones, or revoked status.
- **Timing-Safe Password Validation**: Passwords are hashed with PBKDF2 (10,000 iterations) and compared using constant-time buffers (`crypto.timingSafeEqual`).
- **No Third-Party Cloud Leaks**: Fully isolated local execution with zero tracking, external CDNs, or third-party credential dependencies.
