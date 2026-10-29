/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  Pass,
  VisitorAccount,
  AdminUser,
  AuditEntry,
  SystemSettings,
  PassStatus,
  GateAccessRequest,
} from '../src/types';

export interface DatabaseSchema {
  admins: (AdminUser & { passwordHash: string; salt: string })[];
  visitors: (VisitorAccount & {
    passwordHash: string;
    salt: string;
    pinHash?: string;
    pinSalt?: string;
  })[];
  passes: Pass[];
  consumedTokenIds: string[];
  audit: AuditEntry[];
  settings: SystemSettings;
  authorityKeyPair: {
    publicKeyPem: string;
    privateKeyPem: string;
  };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'passkey-internal-hmac-secret-key-2026';

// Normalize phone numbers (strips whitespace/dashes, standardizes +91 for 10-digit Indian numbers)
export function normalizePhone(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  const hasPlus = trimmed.startsWith('+');
  return hasPlus ? `+${digits}` : digits;
}

// Generate an ECDSA (P-256 / prime256v1) keypair for digital signing
export function generateAuthorityKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

// Digital Signature using NIST P-256 (ECDSA) with SHA-256
export function signWithAuthorityKey(payload: string, privateKeyPem: string): string {
  const sign = crypto.createSign('SHA256');
  sign.update(payload);
  sign.end();
  return sign.sign(privateKeyPem).toString('base64url');
}

// Verify Digital Signature using NIST P-256 Public Key
export function verifyAuthoritySignature(payload: string, signatureBase64Url: string, publicKeyPem: string): boolean {
  try {
    const verify = crypto.createVerify('SHA256');
    verify.update(payload);
    verify.end();
    return verify.verify(publicKeyPem, Buffer.from(signatureBase64Url, 'base64url'));
  } catch (err) {
    return false;
  }
}

// Password Hashing via PBKDF2 (SHA-512)
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computed = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}

// PIN Hashing via PBKDF2 (SHA-256)
export function hashPin(pin: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pin, salt, 2000, 32, 'sha256').toString('hex');
  return { hash, salt };
}

export function verifyPin(pin: string, hash: string, salt: string): boolean {
  const computed = crypto.pbkdf2Sync(pin, salt, 2000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}

// Compute Pass Status dynamically from time and revocation flag
export function computePassStatus(pass: { isRevoked: boolean; validFrom: string; expiresAt?: string; validUntil?: string }, nowMs = Date.now()): PassStatus {
  if (pass.isRevoked) return 'REVOKED';
  const start = new Date(pass.validFrom).getTime();
  const end = new Date(pass.expiresAt || pass.validUntil || 0).getTime();
  if (nowMs < start) return 'UPCOMING';
  if (nowMs > end) return 'EXPIRED';
  return 'ACTIVE';
}

export function getInitialDatabase(): DatabaseSchema {
  const authorityKeyPair = generateAuthorityKeyPair();

  const adminCred = hashPassword('admin123', 'fixed-admin-salt-2026');
  const vis1Cred = hashPassword('visitor123', 'fixed-vis1-salt-2026');
  const vis2Cred = hashPassword('visitor123', 'fixed-vis2-salt-2026');
  const vis3Cred = hashPassword('visitor123', 'fixed-vis3-salt-2026');
  const vis4Cred = hashPassword('Passkey-9821', 'fixed-vis4-salt-2026');

  // Default PIN for pre-seeded registered visitors: 1234
  const defaultPin1 = hashPin('1234', 'fixed-pin-vis1-salt');
  const defaultPin2 = hashPin('2468', 'fixed-pin-vis2-salt');
  const defaultPin3 = hashPin('1357', 'fixed-pin-vis3-salt');

  const now = Date.now();
  const oneHour = 3600 * 1000;

  const admins: DatabaseSchema['admins'] = [
    {
      id: 'admin-1',
      username: 'admin',
      name: 'Security Administrator',
      email: 'admin@passkey.gov.in',
      passwordHash: adminCred.hash,
      salt: adminCred.salt,
    },
  ];

  // Indian demo data
  const visitors: DatabaseSchema['visitors'] = [
    {
      id: 'vis-1',
      name: 'Aarav Sharma',
      visitorName: 'Aarav Sharma',
      phone: '+91 98765 43210',
      phoneNumber: '+91 98765 43210',
      phoneNormalized: '+919876543210',
      email: 'aarav.sharma@tcs-consulting.in',
      requiresPasswordChange: false,
      hasRegisteredBiometric: true,
      hasRegisteredPin: true,
      pinHash: defaultPin1.hash,
      pinSalt: defaultPin1.salt,
      passwordHash: vis1Cred.hash,
      salt: vis1Cred.salt,
      createdAt: new Date(now - 48 * oneHour).toISOString(),
    },
    {
      id: 'vis-2',
      name: 'Priya Patel',
      visitorName: 'Priya Patel',
      phone: '+91 98201 23456',
      phoneNumber: '+91 98201 23456',
      phoneNormalized: '+919820123456',
      email: 'priya.patel@biotech-innovations.in',
      requiresPasswordChange: false,
      hasRegisteredBiometric: true,
      hasRegisteredPin: true,
      pinHash: defaultPin2.hash,
      pinSalt: defaultPin2.salt,
      passwordHash: vis2Cred.hash,
      salt: vis2Cred.salt,
      createdAt: new Date(now - 24 * oneHour).toISOString(),
    },
    {
      id: 'vis-3',
      name: 'Vikram Malhotra',
      visitorName: 'Vikram Malhotra',
      phone: '+91 98450 67890',
      phoneNumber: '+91 98450 67890',
      phoneNormalized: '+919845067890',
      email: 'vikram.malhotra@deloitte-security.in',
      requiresPasswordChange: false,
      hasRegisteredBiometric: true,
      hasRegisteredPin: true,
      pinHash: defaultPin3.hash,
      pinSalt: defaultPin3.salt,
      passwordHash: vis3Cred.hash,
      salt: vis3Cred.salt,
      createdAt: new Date(now - 12 * oneHour).toISOString(),
    },
    {
      id: 'vis-4',
      name: 'Ananya Iyer',
      visitorName: 'Ananya Iyer',
      phone: '+91 97123 45678',
      phoneNumber: '+91 97123 45678',
      phoneNormalized: '+919712345678',
      email: 'ananya.iyer@iitb-guest.ac.in',
      requiresPasswordChange: true, // Needs initial password change
      hasRegisteredBiometric: false, // Needs biometric & PIN registration
      hasRegisteredPin: false,
      passwordHash: vis4Cred.hash,
      salt: vis4Cred.salt,
      createdAt: new Date(now - 2 * oneHour).toISOString(),
    },
  ];

  const pass1Data = 'PK-8041:vis-1:Aarav Sharma:Main Reception,Engineering Laboratory,Office Floor';
  const pass1Sig = signWithAuthorityKey(pass1Data, authorityKeyPair.privateKeyPem);

  const passes: Pass[] = [
    {
      id: 'PK-8041',
      passNumber: 'PK-8041',
      visitorId: 'vis-1',
      visitorName: 'Aarav Sharma',
      visitorPhone: '+91 98765 43210',
      phoneNumber: '+91 98765 43210',
      visitorEmail: 'aarav.sharma@tcs-consulting.in',
      company: 'Tata Consultancy Services',
      purpose: 'Datacenter Architecture & Quantum Computing Review',
      allowedZones: ['Main Reception', 'Engineering Laboratory', 'Office Floor'],
      validFrom: new Date(now - 1 * oneHour).toISOString(),
      expiresAt: new Date(now + 6 * oneHour).toISOString(),
      validUntil: new Date(now + 6 * oneHour).toISOString(),
      status: 'ACTIVE',
      isRevoked: false,
      digitalSignature: pass1Sig,
      notes: 'Visitor cleared for engineering wing',
      createdAt: new Date(now - 1 * oneHour).toISOString(),
    },
    {
      id: 'PK-8042',
      passNumber: 'PK-8042',
      visitorId: 'vis-2',
      visitorName: 'Priya Patel',
      visitorPhone: '+91 98201 23456',
      phoneNumber: '+91 98201 23456',
      visitorEmail: 'priya.patel@biotech-innovations.in',
      company: 'Biotech Innovations India',
      purpose: 'HVAC Air Handling Unit Inspection & Lab Certification',
      allowedZones: ['Main Reception', 'Restricted Area'],
      validFrom: new Date(now - 8 * oneHour).toISOString(),
      expiresAt: new Date(now - 2 * oneHour).toISOString(), // Expired
      validUntil: new Date(now - 2 * oneHour).toISOString(),
      status: 'EXPIRED',
      isRevoked: false,
      notes: 'Contractor service pass - expired',
      createdAt: new Date(now - 8 * oneHour).toISOString(),
    },
    {
      id: 'PK-8043',
      passNumber: 'PK-8043',
      visitorId: 'vis-3',
      visitorName: 'Vikram Malhotra',
      visitorPhone: '+91 98450 67890',
      phoneNumber: '+91 98450 67890',
      visitorEmail: 'vikram.malhotra@deloitte-security.in',
      company: 'Deloitte Security Advisory',
      purpose: 'Physical Datacenter Compliance & Security Audit',
      allowedZones: ['Main Reception', 'Restricted Area'],
      validFrom: new Date(now - 4 * oneHour).toISOString(),
      expiresAt: new Date(now + 4 * oneHour).toISOString(),
      validUntil: new Date(now + 4 * oneHour).toISOString(),
      status: 'REVOKED',
      isRevoked: true,
      revokedAt: new Date(now - 1 * oneHour).toISOString(),
      revokedReason: 'Security alert: Pass revoked by Security Operations Desk',
      notes: 'Administrative revocation enforced',
      createdAt: new Date(now - 4 * oneHour).toISOString(),
    },
    {
      id: 'PK-8044',
      passNumber: 'PK-8044',
      visitorId: 'vis-4',
      visitorName: 'Ananya Iyer',
      visitorPhone: '+91 97123 45678',
      phoneNumber: '+91 97123 45678',
      visitorEmail: 'ananya.iyer@iitb-guest.ac.in',
      company: 'IIT Bombay Computer Science',
      purpose: 'Faculty Guest Seminar: Cryptographic Zero-Knowledge Protocols',
      allowedZones: ['Main Reception', 'Meeting Room', 'Office Floor'],
      validFrom: new Date(now + 2 * oneHour).toISOString(), // Upcoming scheduled pass
      expiresAt: new Date(now + 10 * oneHour).toISOString(),
      validUntil: new Date(now + 10 * oneHour).toISOString(),
      status: 'UPCOMING',
      isRevoked: false,
      notes: 'Keynote guest speaker - scheduled future visit',
      createdAt: new Date(now - 2 * oneHour).toISOString(),
    },
  ];

  const audit: AuditEntry[] = [
    {
      id: 'evt-101',
      timestamp: new Date(now - 1 * oneHour).toISOString(),
      eventType: 'PASS_ISSUED',
      visitorName: 'Aarav Sharma',
      passId: 'PK-8041',
      zone: 'Main Reception',
      result: 'INFO',
      outcome: 'INFO',
      reason: 'Pass issued with ECDSA P-256 digital signature for zones: Main Reception, Engineering Laboratory, Office Floor',
    },
    {
      id: 'evt-102',
      timestamp: new Date(now - 45 * 60 * 1000).toISOString(),
      eventType: 'ACCESS_GRANTED',
      visitorName: 'Aarav Sharma',
      passId: 'PK-8041',
      zone: 'Main Reception',
      result: 'GRANTED',
      outcome: 'GRANTED',
      verificationMethod: 'biometric',
      reason: 'Turnstile access approved via visitor mobile biometric confirmation',
    },
    {
      id: 'evt-103',
      timestamp: new Date(now - 1 * oneHour).toISOString(),
      eventType: 'PASS_REVOKED',
      visitorName: 'Vikram Malhotra',
      passId: 'PK-8043',
      zone: 'Security Console',
      result: 'INFO',
      outcome: 'INFO',
      reason: 'Pass revoked: Pass revoked by Security Operations Desk',
    },
    {
      id: 'evt-104',
      timestamp: new Date(now - 30 * 60 * 1000).toISOString(),
      eventType: 'ACCESS_DENIED',
      visitorName: 'Vikram Malhotra',
      passId: 'PK-8043',
      zone: 'Restricted Area',
      result: 'DENIED',
      outcome: 'DENIED',
      reason: 'Access rejected: Pass revoked by Security Operations Desk',
    },
    {
      id: 'evt-105',
      timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
      eventType: 'ACCESS_DENIED',
      visitorName: 'Priya Patel',
      passId: 'PK-8042',
      zone: 'Restricted Area',
      result: 'DENIED',
      outcome: 'DENIED',
      reason: 'Access rejected: Pass expired (validity window ended)',
    },
  ];

  const settings: SystemSettings = {
    accessZones: [
      'Main Reception',
      'Office Floor',
      'Engineering Laboratory',
      'Meeting Room',
      'Restricted Area',
    ],
    zones: [
      'Main Reception',
      'Office Floor',
      'Engineering Laboratory',
      'Meeting Room',
      'Restricted Area',
    ],
    defaultValidityHours: 8,
    qrRefreshIntervalSeconds: 60,
    requireBiometricOrPinOnScan: true,
  };

  return {
    admins,
    visitors,
    passes,
    consumedTokenIds: [],
    audit,
    settings,
    authorityKeyPair,
  };
}

class Database {
  private data: DatabaseSchema;
  // In-memory pending gate authorization requests for real-time mobile push & prompt
  private pendingGateRequests: Map<string, GateAccessRequest> = new Map();

  constructor() {
    this.ensureDataDir();
    this.data = this.load();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.authorityKeyPair && parsed.passes && parsed.visitors) {
          return parsed;
        }
      } catch (err) {
        console.error('Error reading db.json, recreating initial data:', err);
      }
    }
    const initial = getInitialDatabase();
    this.save(initial);
    return initial;
  }

  private save(data: DatabaseSchema) {
    this.ensureDataDir();
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  }

  public reset(): void {
    const fresh = getInitialDatabase();
    this.data = fresh;
    this.pendingGateRequests.clear();
    this.save(fresh);
  }

  // Cryptographic Key Access
  public getAuthorityPublicKey(): string {
    return this.data.authorityKeyPair.publicKeyPem;
  }

  // --- Admin operations ---
  public getAdminByUsername(username: string) {
    return this.data.admins.find((a) => a.username.toLowerCase() === username.toLowerCase());
  }

  public getAdminById(id: string) {
    return this.data.admins.find((a) => a.id === id);
  }

  public updateAdminPassword(adminId: string, newPassword: string) {
    const admin = this.getAdminById(adminId);
    if (!admin) return false;
    const { hash, salt } = hashPassword(newPassword);
    admin.passwordHash = hash;
    admin.salt = salt;
    this.save(this.data);
    return true;
  }

  // --- Visitor operations ---
  public getVisitorByPhone(phone: string) {
    const norm = normalizePhone(phone);
    return this.data.visitors.find((v) => v.phoneNormalized === norm);
  }

  public getVisitorById(id: string) {
    return this.data.visitors.find((v) => v.id === id);
  }

  public createVisitor(params: {
    name: string;
    phone: string;
    email?: string;
    password: string;
  }): { visitor: DatabaseSchema['visitors'][0]; isExisting: boolean } {
    const norm = normalizePhone(params.phone);
    const existing = this.getVisitorByPhone(norm);
    if (existing) {
      existing.name = params.name;
      existing.visitorName = params.name;
      if (params.email) existing.email = params.email;
      this.save(this.data);
      return { visitor: existing, isExisting: true };
    }

    const { hash, salt } = hashPassword(params.password);
    const visitor: DatabaseSchema['visitors'][0] = {
      id: `vis-${Date.now().toString(36)}`,
      name: params.name,
      visitorName: params.name,
      phone: params.phone,
      phoneNumber: params.phone,
      phoneNormalized: norm,
      email: params.email,
      requiresPasswordChange: true,
      hasRegisteredBiometric: false,
      hasRegisteredPin: false,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
    };
    this.data.visitors.push(visitor);
    this.save(this.data);
    return { visitor, isExisting: false };
  }

  public updateVisitorPassword(visitorId: string, newPassword: string) {
    const visitor = this.getVisitorById(visitorId);
    if (!visitor) return false;
    const { hash, salt } = hashPassword(newPassword);
    visitor.passwordHash = hash;
    visitor.salt = salt;
    visitor.requiresPasswordChange = false;
    this.save(this.data);
    return true;
  }

  // Register Visitor Biometric and PIN
  public registerVisitorSecurity(visitorId: string, params: { pin?: string; enableBiometric?: boolean }) {
    const visitor = this.getVisitorById(visitorId);
    if (!visitor) return false;

    if (params.pin && params.pin.trim().length >= 4) {
      const { hash, salt } = hashPin(params.pin.trim());
      visitor.pinHash = hash;
      visitor.pinSalt = salt;
      visitor.hasRegisteredPin = true;
    }

    if (params.enableBiometric !== undefined) {
      visitor.hasRegisteredBiometric = params.enableBiometric;
    }

    this.addAudit({
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'BIOMETRIC_REGISTERED',
      visitorName: visitor.name,
      zone: 'Mobile Device',
      result: 'INFO',
      outcome: 'INFO',
      reason: `Visitor enrolled security credentials (Biometric: ${visitor.hasRegisteredBiometric ? 'Active' : 'Skipped'}, PIN: ${visitor.hasRegisteredPin ? 'Configured' : 'None'})`,
    });

    this.save(this.data);
    return visitor;
  }

  // --- Pass operations ---
  public getPasses(): Pass[] {
    const nowMs = Date.now();
    return this.data.passes.map((p) => ({
      ...p,
      passNumber: p.id,
      phoneNumber: p.visitorPhone,
      validUntil: p.expiresAt,
      status: computePassStatus(p, nowMs),
    }));
  }

  public getPassById(id: string): Pass | undefined {
    const p = this.data.passes.find((item) => item.id.toUpperCase() === id.trim().toUpperCase());
    if (!p) return undefined;
    const nowMs = Date.now();
    return {
      ...p,
      passNumber: p.id,
      phoneNumber: p.visitorPhone,
      validUntil: p.expiresAt,
      status: computePassStatus(p, nowMs),
    };
  }

  public getPassesByVisitorId(visitorId: string): Pass[] {
    const nowMs = Date.now();
    return this.data.passes
      .filter((p) => p.visitorId === visitorId)
      .map((p) => ({
        ...p,
        passNumber: p.id,
        phoneNumber: p.visitorPhone,
        validUntil: p.expiresAt,
        status: computePassStatus(p, nowMs),
      }));
  }

  public createPass(params: {
    visitorId: string;
    visitorName: string;
    visitorPhone: string;
    visitorEmail?: string;
    company?: string;
    purpose: string;
    allowedZones: string[];
    validFrom: string; // Any date (past, present, or future)
    validUntil: string; // Any date
    notes?: string;
    escortRequired?: boolean;
    singleEntryOnly?: boolean;
  }): Pass {
    const nextNum = Math.floor(1000 + Math.random() * 9000);
    const id = `PK-${nextNum}`;

    // Generate real ECDSA digital signature for the pass
    const passSignData = `${id}:${params.visitorId}:${params.visitorName}:${params.allowedZones.join(',')}:${params.validFrom}:${params.validUntil}`;
    const digitalSignature = signWithAuthorityKey(passSignData, this.data.authorityKeyPair.privateKeyPem);

    const newPass: Pass = {
      id,
      passNumber: id,
      visitorId: params.visitorId,
      visitorName: params.visitorName,
      visitorPhone: params.visitorPhone,
      phoneNumber: params.visitorPhone,
      visitorEmail: params.visitorEmail,
      company: params.company,
      purpose: params.purpose,
      allowedZones: params.allowedZones,
      validFrom: params.validFrom,
      expiresAt: params.validUntil,
      validUntil: params.validUntil,
      status: computePassStatus({
        isRevoked: false,
        validFrom: params.validFrom,
        expiresAt: params.validUntil,
      }),
      isRevoked: false,
      notes: params.notes,
      escortRequired: params.escortRequired,
      singleEntryOnly: params.singleEntryOnly,
      digitalSignature,
      createdAt: new Date().toISOString(),
    };

    this.data.passes.unshift(newPass);

    this.addAudit({
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'PASS_ISSUED',
      visitorName: newPass.visitorName,
      passId: newPass.id,
      passNumber: newPass.id,
      zone: newPass.allowedZones.join(', '),
      result: 'INFO',
      outcome: 'INFO',
      reason: `Pass issued (Valid: ${new Date(newPass.validFrom).toLocaleString()} to ${new Date(newPass.validUntil).toLocaleString()}) - Status: ${newPass.status}`,
    });

    this.save(this.data);
    return newPass;
  }

  public revokePass(passId: string, reason: string): Pass | null {
    const pass = this.data.passes.find((p) => p.id === passId);
    if (!pass) return null;

    pass.isRevoked = true;
    pass.revokedAt = new Date().toISOString();
    pass.revokedReason = reason;
    pass.status = 'REVOKED';

    this.addAudit({
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'PASS_REVOKED',
      visitorName: pass.visitorName,
      passId: pass.id,
      passNumber: pass.id,
      zone: 'Security Console',
      result: 'INFO',
      outcome: 'INFO',
      reason: `Pass revoked: ${reason}`,
    });

    this.save(this.data);
    return pass;
  }

  // --- Rotating QR Token Generation with ECDSA P-256 Signature ---
  public generateQrToken(passId: string): { tokenString: string; expiresAt: number; refreshInterval: number; tokenObj: any } {
    const pass = this.getPassById(passId);
    if (!pass) {
      throw new Error('Pass not found');
    }
    if (pass.status !== 'ACTIVE') {
      throw new Error(`Cannot generate presentation token for ${pass.status.toLowerCase()} pass`);
    }

    const refreshInterval = this.data.settings.qrRefreshIntervalSeconds || 60;
    const now = Date.now();
    const expiresAt = now + refreshInterval * 1000;
    const tokenId = `tok_${crypto.randomBytes(12).toString('hex')}`;

    // Payload includes unique token ID, pass reference, and microsecond timestamps
    const payload = `${tokenId}:${pass.id}:${now}:${expiresAt}`;

    // Real ECDSA P-256 digital signature
    const signature = signWithAuthorityKey(payload, this.data.authorityKeyPair.privateKeyPem);

    const tokenObj = {
      tokenId,
      passId: pass.id,
      visitorName: pass.visitorName,
      visitorPhone: pass.visitorPhone,
      issuedAt: now,
      expiresAt,
      refreshInterval,
      algorithm: 'ECDSA-P256-SHA256',
      signature,
    };

    return {
      tokenString: JSON.stringify(tokenObj),
      expiresAt,
      refreshInterval,
      tokenObj,
    };
  }

  // --- Real-Time Gate Challenge Flow (Camera scan -> Mobile Biometric/PIN popup -> Gate opens) ---

  public initiateGateScanChallenge(params: {
    tokenString?: string;
    passReference?: string;
    zone: string;
  }): {
    status: 'PENDING_VISITOR_AUTH' | 'DENIED' | 'GRANTED';
    requestId?: string;
    reason: string;
    pass?: Pass;
    visitor?: VisitorAccount;
  } {
    const now = Date.now();
    const { tokenString, passReference, zone } = params;

    let targetPass: Pass | undefined;
    let verifiedTokenId: string | null = null;

    if (tokenString && tokenString.trim()) {
      try {
        const tokenObj = JSON.parse(tokenString);
        const { tokenId, passId, issuedAt, expiresAt, signature } = tokenObj;

        if (!tokenId || !passId || !issuedAt || !expiresAt || !signature) {
          this.logDenied('Invalid QR presentation payload structure', zone);
          return { status: 'DENIED', reason: 'Invalid QR token structure' };
        }

        // Verify Real ECDSA P-256 signature
        const payload = `${tokenId}:${passId}:${issuedAt}:${expiresAt}`;
        const isValidSignature = verifyAuthoritySignature(payload, signature, this.data.authorityKeyPair.publicKeyPem);

        if (!isValidSignature) {
          // Backward compatibility check with HMAC
          const hmacExpected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
          if (signature !== hmacExpected) {
            this.logDenied('Token cryptographic signature verification failed (ECDSA mismatch)', zone, passId);
            return { status: 'DENIED', reason: 'Cryptographic signature mismatch' };
          }
        }

        // Check token expiry
        if (now > expiresAt + 5000) {
          this.logDenied('QR code expired (presentation window exceeded)', zone, passId);
          return { status: 'DENIED', reason: 'QR presentation code expired' };
        }

        // Check token replay
        if (this.data.consumedTokenIds.includes(tokenId)) {
          this.logDenied('QR code already consumed (replay rejected)', zone, passId);
          return { status: 'DENIED', reason: 'QR code already used' };
        }

        targetPass = this.getPassById(passId);
        if (!targetPass) {
          this.logDenied(`Pass reference ${passId} not found`, zone, passId);
          return { status: 'DENIED', reason: 'Pass not found' };
        }

        verifiedTokenId = tokenId;
      } catch (err) {
        this.logDenied('Malformed QR payload format', zone);
        return { status: 'DENIED', reason: 'Malformed QR payload format' };
      }
    } else if (passReference && passReference.trim()) {
      targetPass = this.getPassById(passReference.trim());
      if (!targetPass) {
        this.logDenied(`Pass reference ${passReference} not found in database`, zone);
        return { status: 'DENIED', reason: 'Pass not found' };
      }
    } else {
      return { status: 'DENIED', reason: 'Neither QR token nor pass reference provided' };
    }

    // 1. Authoritative status check
    const status = computePassStatus(targetPass, now);
    if (status === 'REVOKED') {
      const reason = `Pass revoked: ${targetPass.revokedReason || 'Administrative revocation'}`;
      this.logDenied(reason, zone, targetPass.id, targetPass.visitorName);
      return { status: 'DENIED', reason: 'Pass revoked', pass: targetPass };
    }

    if (status === 'EXPIRED') {
      const reason = 'Pass expired (validity window ended)';
      this.logDenied(reason, zone, targetPass.id, targetPass.visitorName);
      return { status: 'DENIED', reason: 'Pass expired', pass: targetPass };
    }

    if (status === 'UPCOMING') {
      const reason = `Pass not yet active (valid from ${new Date(targetPass.validFrom).toLocaleString()})`;
      this.logDenied(reason, zone, targetPass.id, targetPass.visitorName);
      return { status: 'DENIED', reason: 'Pass not yet active', pass: targetPass };
    }

    // 2. Zone check
    if (zone && !targetPass.allowedZones.includes(zone)) {
      const reason = `Zone not permitted (access to "${zone}" not authorized for this pass)`;
      this.logDenied(reason, zone, targetPass.id, targetPass.visitorName);
      return { status: 'DENIED', reason: 'Zone not permitted for this pass', pass: targetPass };
    }

    // Mark QR token consumed
    if (verifiedTokenId) {
      this.data.consumedTokenIds.push(verifiedTokenId);
      if (this.data.consumedTokenIds.length > 1000) {
        this.data.consumedTokenIds.shift();
      }
    }

    // Check if biometric/PIN verification is enabled
    const requireAuth = this.data.settings.requireBiometricOrPinOnScan !== false;
    const visitor = this.getVisitorById(targetPass.visitorId) || this.getVisitorByPhone(targetPass.visitorPhone);

    if (requireAuth) {
      // Create Pending Gate Request
      const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const request: GateAccessRequest = {
        id: requestId,
        passId: targetPass.id,
        passNumber: targetPass.id,
        visitorId: targetPass.visitorId,
        visitorName: targetPass.visitorName,
        visitorPhone: targetPass.visitorPhone,
        zone,
        status: 'PENDING_VISITOR_AUTH',
        createdAt: now,
        expiresAt: now + 45 * 1000, // 45 seconds to confirm on handset
      };

      this.pendingGateRequests.set(requestId, request);

      // Audit Challenge
      this.addAudit({
        id: `evt-${Date.now()}`,
        timestamp: new Date().toISOString(),
        eventType: 'GATE_AUTH_CHALLENGE',
        visitorName: targetPass.visitorName,
        passId: targetPass.id,
        passNumber: targetPass.id,
        zone,
        result: 'INFO',
        outcome: 'PENDING',
        reason: `Turnstile challenge dispatched to visitor mobile (${targetPass.visitorPhone}) - awaiting Biometric or PIN confirmation`,
      });
      this.save(this.data);

      return {
        status: 'PENDING_VISITOR_AUTH',
        requestId,
        reason: `Awaiting visitor mobile confirmation on handset for ${zone}`,
        pass: targetPass,
        visitor,
      };
    }

    // Direct Grant fallback if biometric challenge is turned off in settings
    this.addAudit({
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'ACCESS_GRANTED',
      visitorName: targetPass.visitorName,
      passId: targetPass.id,
      passNumber: targetPass.id,
      zone,
      result: 'GRANTED',
      outcome: 'GRANTED',
      verificationMethod: 'qr_instant',
      reason: `Direct turnstile access granted for ${targetPass.visitorName} at ${zone}`,
    });
    this.save(this.data);

    return {
      status: 'GRANTED',
      reason: `Access granted for ${targetPass.visitorName}`,
      pass: targetPass,
    };
  }

  // Get active pending request for visitor mobile handset
  public getPendingRequestForVisitor(phoneOrVisitorId: string): GateAccessRequest | null {
    const norm = normalizePhone(phoneOrVisitorId);
    const now = Date.now();

    for (const [id, req] of this.pendingGateRequests.entries()) {
      if (now > req.expiresAt) {
        req.status = 'EXPIRED';
        this.pendingGateRequests.delete(id);
        continue;
      }

      const matchId = req.visitorId === phoneOrVisitorId;
      const matchPhone = normalizePhone(req.visitorPhone) === norm;

      if ((matchId || matchPhone) && req.status === 'PENDING_VISITOR_AUTH') {
        return req;
      }
    }
    return null;
  }

  // Get request status for Gate Console polling
  public getGateAccessRequestStatus(requestId: string): GateAccessRequest | null {
    const req = this.pendingGateRequests.get(requestId);
    if (!req) return null;
    if (Date.now() > req.expiresAt && req.status === 'PENDING_VISITOR_AUTH') {
      req.status = 'EXPIRED';
    }
    return req;
  }

  // Visitor confirms gate request with Biometric or PIN
  public confirmGateAccessRequest(params: {
    requestId: string;
    visitorId?: string;
    visitorPhone?: string;
    method: 'biometric' | 'pin';
    pin?: string;
  }): { success: boolean; error?: string; request?: GateAccessRequest } {
    const req = this.pendingGateRequests.get(params.requestId);
    if (!req) {
      return { success: false, error: 'Access request has expired or does not exist' };
    }
    if (req.status !== 'PENDING_VISITOR_AUTH') {
      return { success: false, error: `Request already ${req.status.toLowerCase()}` };
    }
    if (Date.now() > req.expiresAt) {
      req.status = 'EXPIRED';
      return { success: false, error: 'Access request timed out (45s window elapsed)' };
    }

    const visitor = this.getVisitorById(req.visitorId) || this.getVisitorByPhone(req.visitorPhone);

    // If method is PIN, verify PIN against cryptographic hash
    if (params.method === 'pin') {
      if (!params.pin) {
        return { success: false, error: 'PIN is required' };
      }
      if (visitor?.pinHash && visitor?.pinSalt) {
        const isMatch = verifyPin(params.pin.trim(), visitor.pinHash, visitor.pinSalt);
        if (!isMatch) {
          return { success: false, error: 'Incorrect 4-digit PIN. Please try again.' };
        }
      } else {
        // If visitor hasn't set custom PIN yet, allow default '1234'
        if (params.pin.trim() !== '1234') {
          return { success: false, error: 'Invalid PIN. (Default demo PIN is 1234)' };
        }
      }
    }

    // Mark as APPROVED
    req.status = 'APPROVED';
    req.confirmedMethod = params.method;
    req.confirmedAt = Date.now();

    const pass = this.getPassById(req.passId);

    // Log granted audit
    this.addAudit({
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'ACCESS_GRANTED',
      visitorName: req.visitorName,
      passId: req.passId,
      passNumber: req.passNumber,
      zone: req.zone,
      result: 'GRANTED',
      outcome: 'GRANTED',
      verificationMethod: params.method,
      reason: `Gate unlocked: Identity confirmed via visitor mobile ${params.method === 'biometric' ? 'Biometrics (Touch ID / Face ID)' : '4-Digit PIN'}`,
    });

    this.save(this.data);
    return { success: true, request: req };
  }

  // Visitor rejects gate request
  public rejectGateAccessRequest(requestId: string, reason = 'Visitor denied entry from handset'): boolean {
    const req = this.pendingGateRequests.get(requestId);
    if (!req) return false;

    req.status = 'REJECTED';
    req.rejectionReason = reason;

    this.logDenied(`Access cancelled by visitor handset: ${reason}`, req.zone, req.passId, req.visitorName);
    return true;
  }

  // Instant verification (used by test scenarios or fallback)
  public verifyGatePresentation(params: {
    tokenString?: string;
    passReference?: string;
    zone: string;
  }): { result: 'GRANTED' | 'DENIED'; reason: string; pass?: Pass } {
    const scan = this.initiateGateScanChallenge(params);
    if (scan.status === 'DENIED') {
      return { result: 'DENIED', reason: scan.reason, pass: scan.pass };
    }
    // For unit tests / deterministic verification
    if (scan.requestId) {
      // Auto-approve in test mode
      this.confirmGateAccessRequest({
        requestId: scan.requestId,
        method: 'biometric',
      });
      return { result: 'GRANTED', reason: `Access granted for ${scan.pass?.visitorName}`, pass: scan.pass };
    }
    return { result: 'GRANTED', reason: scan.reason, pass: scan.pass };
  }

  private logDenied(reason: string, zone?: string, passId?: string, visitorName?: string) {
    this.addAudit({
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'ACCESS_DENIED',
      visitorName: visitorName || 'Unknown Visitor',
      passId,
      passNumber: passId,
      zone: zone || 'Turnstile',
      result: 'DENIED',
      outcome: 'DENIED',
      reason,
    });
    this.save(this.data);
  }

  // --- Audit operations ---
  public getAudit(): AuditEntry[] {
    return this.data.audit;
  }

  public addAudit(entry: AuditEntry) {
    if (!entry.id || this.data.audit.some((a) => a.id === entry.id)) {
      entry.id = `evt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }
    this.data.audit.unshift(entry);
    if (this.data.audit.length > 500) {
      this.data.audit.pop();
    }
  }

  // --- Settings operations ---
  public getSettings(): SystemSettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<SystemSettings>): SystemSettings {
    this.data.settings = {
      ...this.data.settings,
      ...updates,
      accessZones: updates.accessZones || updates.zones || this.data.settings.accessZones,
      zones: updates.accessZones || updates.zones || this.data.settings.zones,
    };
    this.save(this.data);
    return this.data.settings;
  }
}

export const db = new Database();
