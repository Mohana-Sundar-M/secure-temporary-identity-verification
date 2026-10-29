# Production-Grade PASSKEY Firebase Integration & Multi-Pass Account Linkage

Upgrade PASSKEY gate access management system from in-memory/prototype state to a production-grade architecture powered by Firebase Firestore persistence, real-time gate challenge synchronization, Web Crypto API (NIST P-256 ECDSA + PBKDF2), and multi-pass account linkage for returning visitors.

---

> [!IMPORTANT] User Review & Critical Decisions
>
> - **Confirmed Decision 1 (Database Backend)**: Firebase Firestore persistent database with real-time synchronization (`onSnapshot`) between the Gate Console and Visitor Mobile Web App.
> - **Confirmed Decision 2 (Multi-Pass Account Linking)**: When issuing a pass to an existing visitor phone number, their password and biometric/PIN credentials remain **unchanged**, and the new pass is linked directly to their existing visitor account so they can view and manage all active and historical passes in a single session.

---

## 1. Overview & Core Concept

PASSKEY is an enterprise physical gate access control platform with two synchronized views:
1. **Admin & Gate Console (`/`)**: Issues passes with start/expiry dates, scans visitor QR codes via device camera, verifies NIST P-256 digital signatures, and triggers real-time turnstile verification requests.
2. **Visitor Mobile App View (`/visitor`)**: Allows visitors to log in with their phone number, set up biometric or 4-digit PIN authentication, present active QR passes, and respond in real-time to gate challenge prompts.

---

## 2. User Experience & Visual Design

- **Visual Posture**: Clean white-theme UI matching modern enterprise SaaS design systems (crisp slate borders, pure white surface cards, zero dark-mode clutter, zero mechanical code comments).
- **Typography**: Plus Jakarta Sans for UI body and headlines; JetBrains Mono for cryptographic signatures, pass IDs, and tabular timestamps.
- **Zero-Pill Metadata**: Metadata (dates, validity windows, phone numbers) rendered as unboxed quiet typography separated by subtle dots (`·`).
- **Real-Time Turnstile Flow**:
  1. Gate Scanner reads visitor QR code -> validates P-256 ECDSA digital signature.
  2. Gate issues pending challenge event to Firestore (`/challenges`).
  3. Visitor handset (`/visitor`) detects pending challenge instantly via Firestore `onSnapshot`.
  4. Handset presents Biometric (Touch ID / Face ID simulation) or 4-Digit PIN modal.
  5. Upon visitor confirmation, handset updates challenge state to `GRANTED`.
  6. Gate console receives `GRANTED` event in real-time and opens turnstile barrier.

---

## 3. Key Product Decisions & Trade-Offs

- **Firestore vs Local Storage**: Migrating from transient local state to Firebase Firestore (`passes`, `visitors`, `challenges`, `auditLogs`) guarantees persistence across devices, tabs, and sessions.
- **Multi-Pass Linkage Logic**:
  - `visitors` collection indexes profiles by `phoneNormalized` (e.g. `+919876543210`).
  - When issuing a pass, `api.ts` checks if `visitors` document exists for that phone.
  - If existing: standard credentials remain untouched; new pass document is saved with `visitorPhone` and `visitorId` pointing to that existing profile.
  - If new: a visitor profile record is initialized, and an initial setup key is assigned.
- **Cryptographic Rigor**:
  - Digital signatures produced and verified using native Web Crypto API (`ECDSA` with P-256 curve and SHA-256 digest).
  - PIN codes hashed using PBKDF2 (100,000 iterations, 16-byte random salt).

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Firebase Firestore                            │
│                                                                        │
│   ┌────────────────┐   ┌────────────────┐   ┌─────────────────────┐   │
│   │    visitors    │   │     passes     │   │     challenges      │   │
│   │ (Phone Index)  │   │  (Multi-pass)  │   │   (Realtime Sync)   │   │
│   └───────┬────────┘   └───────┬────────┘   └──────────┬──────────┘   │
└───────────┼────────────────────┼───────────────────────┼──────────────┘
            │                    │                       │
            ▼                    ▼                       ▼
┌─────────────────────────────────────────┐   ┌──────────────────────────┐
│          Visitor Mobile View            │   │   Admin & Gate Console   │
│              (`/visitor`)               │   │           (`/`)          │
│                                         │   │                          │
│  - Single Login for all Passes          │   │  - Issue New Pass        │
│  - Biometric / PIN Authentication       │   │  - Camera QR Scanner     │
│  - Realtime Challenge Prompt Modal      │   │  - P-256 Sig Verification│
└─────────────────────────────────────────┘   └──────────────────────────┘
```

### Entities & Firestore Collection Schema (`firebase-blueprint.json`)
1. **`visitors`** (`/visitors/{visitorId}`): `phone`, `phoneNormalized`, `name`, `authMethod` (`'biometric' | 'pin'`), `pinHash`, `salt`, `createdAt`.
2. **`passes`** (`/passes/{passId}`): `visitorId`, `visitorPhone`, `visitorName`, `purpose`, `validFrom`, `validUntil`, `status` (`'ACTIVE' | 'EXPIRED' | 'REVOKED'`), `signature`, `publicKeyPem`, `createdAt`.
3. **`challenges`** (`/challenges/{challengeId}`): `passId`, `visitorPhone`, `gateId`, `status` (`'PENDING' | 'GRANTED' | 'REJECTED' | 'TIMEOUT'`), `createdAt`, `updatedAt`.
4. **`auditLogs`** (`/auditLogs/{logId}`): `event`, `passId`, `visitorName`, `gateId`, `status`, `timestamp`.

---

## 5. Sequential Implementation Plan

1. **Step 1: Firebase Blueprint & Rules Architecture**
   - Create `firebase-blueprint.json` adhering strictly to schema.
   - Generate `firestore.rules` with strict validation helpers, `isValidId()`, `isSignedIn()`, and type/length constraints for all collections.
2. **Step 2: Trigger Firebase UI Provisioning Flow**
   - Call `show_aistudio_ui` with `ui_type: "firebase_setup"`.
   - Verify `GetFirebaseTos` acceptance and execute `ProvisionFirebase` RPC.
   - Initialize `src/services/firebase.ts` with `firebase-applet-config.json`.
3. **Step 3: Refactor Service Layer (`src/services/api.ts`)**
   - Replace in-memory mock functions with Firestore operations (`addDoc`, `getDocs`, `onSnapshot`, `query`, `where`).
   - Implement multi-pass profile lookup logic to link new passes to existing visitor phone numbers.
4. **Step 4: Update UI Views (`App.tsx`, `GateConsoleView.tsx`, `VisitorMobileWebView.tsx`)**
   - Connect real-time Firestore `onSnapshot` listeners to the turnstile challenge modal on `/visitor` and status indicators on `/`.
   - Ensure clean white-theme styling across all views matching domain guidelines.
5. **Step 5: Deployment & Verification**
   - Deploy security rules via `DeployRules` RPC.
   - Run `compile_applet` and `lint_applet` to ensure zero compilation or type errors.
