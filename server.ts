/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { db, verifyPassword, normalizePhone } from './server/db';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'passkey-session-secret-2026';

app.use(express.json());

// Simple HMAC session tokens for local MVP
function createSessionToken(payload: { id: string; role: 'admin' | 'visitor' }): string {
  const data = JSON.stringify({ ...payload, exp: Date.now() + 24 * 3600 * 1000 });
  const b64Data = Buffer.from(data).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(b64Data).digest('base64url');
  return `${b64Data}.${sig}`;
}

function verifySessionToken(tokenStr?: string): { id: string; role: 'admin' | 'visitor' } | null {
  if (!tokenStr) return null;
  const parts = tokenStr.replace('Bearer ', '').trim().split('.');
  if (parts.length !== 2) return null;
  const [b64Data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(b64Data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const data = JSON.parse(Buffer.from(b64Data, 'base64url').toString('utf-8'));
    if (Date.now() > data.exp) return null;
    return { id: data.id, role: data.role };
  } catch {
    return null;
  }
}

// Middleware: Require Admin
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session || session.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized: Administrator session required' });
  }
  (req as any).user = session;
  next();
}

// Middleware: Require Visitor
function requireVisitor(req: Request, res: Response, next: NextFunction) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session || session.role !== 'visitor') {
    return res.status(401).json({ error: 'Unauthorized: Visitor session required' });
  }
  (req as any).user = session;
  next();
}

// ==================== AUTH ROUTES ====================

// Admin Login
app.post('/api/auth/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const admin = db.getAdminByUsername(username);
  if (!admin || !verifyPassword(password, admin.passwordHash, admin.salt)) {
    return res.status(401).json({ error: 'Invalid administrator credentials' });
  }
  const token = createSessionToken({ id: admin.id, role: 'admin' });
  res.json({
    token,
    role: 'admin',
    user: {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      email: admin.email,
    },
  });
});

// Visitor Login
app.post('/api/auth/visitor/login', (req: Request, res: Response) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'Mobile number and password are required' });
  }
  const visitor = db.getVisitorByPhone(phone);
  if (!visitor || !verifyPassword(password, visitor.passwordHash, visitor.salt)) {
    return res.status(401).json({ error: 'Invalid mobile number or password' });
  }
  const token = createSessionToken({ id: visitor.id, role: 'visitor' });
  res.json({
    token,
    role: 'visitor',
    user: {
      id: visitor.id,
      name: visitor.name,
      visitorName: visitor.name,
      phone: visitor.phone,
      phoneNumber: visitor.phone,
      email: visitor.email,
      requiresPasswordChange: visitor.requiresPasswordChange,
      mustChangePassword: visitor.requiresPasswordChange,
      hasRegisteredBiometric: !!visitor.hasRegisteredBiometric,
      hasRegisteredPin: !!visitor.hasRegisteredPin,
    },
  });
});

// Visitor Change Password (e.g. required on first login)
app.post('/api/auth/visitor/change-password', requireVisitor, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const visitorId = (req as any).user.id;
  const visitor = db.getVisitorById(visitorId);
  if (!visitor) {
    return res.status(404).json({ error: 'Visitor account not found' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  if (currentPassword && !verifyPassword(currentPassword, visitor.passwordHash, visitor.salt)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  db.updateVisitorPassword(visitorId, newPassword);
  res.json({ success: true, message: 'Password updated successfully' });
});

// Visitor Register Security (Biometric & PIN)
app.post('/api/auth/visitor/register-security', requireVisitor, (req: Request, res: Response) => {
  const { pin, enableBiometric } = req.body;
  const visitorId = (req as any).user.id;

  const visitor = db.registerVisitorSecurity(visitorId, {
    pin,
    enableBiometric: enableBiometric !== undefined ? !!enableBiometric : true,
  });

  if (!visitor) {
    return res.status(404).json({ error: 'Visitor account not found' });
  }

  res.json({
    success: true,
    message: 'Security credentials enrolled successfully',
    visitor: {
      id: visitor.id,
      name: visitor.name,
      hasRegisteredBiometric: !!visitor.hasRegisteredBiometric,
      hasRegisteredPin: !!visitor.hasRegisteredPin,
    },
  });
});

// ==================== ADMIN PASS MANAGEMENT ====================

// List Passes
app.get('/api/passes', requireAdmin, (req: Request, res: Response) => {
  const { search, status, zone } = req.query as { search?: string; status?: string; zone?: string };
  let passes = db.getPasses();

  if (status && status !== 'ALL') {
    passes = passes.filter((p) => p.status.toUpperCase() === status.toUpperCase());
  }
  if (zone && zone !== 'ALL') {
    passes = passes.filter((p) => p.allowedZones.includes(zone));
  }
  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    passes = passes.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.visitorName.toLowerCase().includes(q) ||
        p.visitorPhone.includes(q) ||
        p.purpose.toLowerCase().includes(q)
    );
  }

  res.json({ passes });
});

// Get Single Pass
app.get('/api/passes/:id', (req: Request, res: Response) => {
  const pass = db.getPassById(req.params.id);
  if (!pass) {
    return res.status(404).json({ error: 'Pass not found' });
  }
  res.json({ pass });
});

// Create Pass (Host Employee REMOVED, allows past and future dates)
app.post('/api/passes', requireAdmin, (req: Request, res: Response) => {
  const {
    visitorName,
    visitorPhone,
    phoneNumber,
    visitorEmail,
    company,
    purpose,
    allowedZones,
    validFrom,
    validUntil,
    expiresAt,
    notes,
    escortRequired,
    singleEntryOnly,
  } = req.body;

  const resolvedPhone = (visitorPhone || phoneNumber || '').trim();
  const resolvedName = (visitorName || '').trim();
  const resolvedPurpose = (purpose || '').trim();

  if (!resolvedName || !resolvedPhone || !resolvedPurpose) {
    return res.status(400).json({ error: 'Visitor name, phone number, and purpose are required' });
  }
  if (!allowedZones || !Array.isArray(allowedZones) || allowedZones.length === 0) {
    return res.status(400).json({ error: 'At least one allowed zone must be selected' });
  }

  // Allow flexible start and end dates (can be past for expired records/tests, or future for scheduled passes)
  const resolvedValidFrom = validFrom || new Date().toISOString();
  const resolvedValidUntil = validUntil || expiresAt;

  if (!resolvedValidUntil) {
    return res.status(400).json({ error: 'Pass expiration date (validUntil) is required' });
  }

  const startMs = new Date(resolvedValidFrom).getTime();
  const endMs = new Date(resolvedValidUntil).getTime();

  if (isNaN(startMs) || isNaN(endMs)) {
    return res.status(400).json({ error: 'Invalid date/time format for validity range' });
  }

  if (endMs <= startMs) {
    return res.status(400).json({ error: 'Pass expiration date must be strictly after the start date' });
  }

  // Generate a temporary initial password for new visitors
  const initialPassword = `Passkey-${Math.floor(1000 + Math.random() * 9000)}`;

  // Create or retrieve visitor account
  const { visitor, isExisting } = db.createVisitor({
    name: resolvedName,
    phone: resolvedPhone,
    email: visitorEmail?.trim() || undefined,
    password: initialPassword,
  });

  // Create pass with real ECDSA digital signature
  const pass = db.createPass({
    visitorId: visitor.id,
    visitorName: visitor.name,
    visitorPhone: visitor.phone,
    visitorEmail: visitor.email,
    company: company?.trim() || undefined,
    purpose: resolvedPurpose,
    allowedZones,
    validFrom: new Date(startMs).toISOString(),
    validUntil: new Date(endMs).toISOString(),
    notes: notes?.trim() || undefined,
    escortRequired: !!escortRequired,
    singleEntryOnly: !!singleEntryOnly,
  });

  res.json({
    pass,
    temporaryPassword: isExisting ? undefined : initialPassword,
    initialPassword: isExisting ? undefined : initialPassword,
    visitorPhone: visitor.phone,
    isExistingAccount: isExisting,
  });
});

// Revoke Pass
app.post('/api/passes/:id/revoke', requireAdmin, (req: Request, res: Response) => {
  const { reason } = req.body;
  if (!reason?.trim()) {
    return res.status(400).json({ error: 'Revocation reason is required' });
  }
  const pass = db.revokePass(req.params.id, reason.trim());
  if (!pass) {
    return res.status(404).json({ error: 'Pass not found' });
  }
  res.json({ pass, message: 'Pass revoked successfully' });
});

// ==================== VISITOR PASS API ====================

// Get Visitor's Passes (Supports session token or phone param)
app.get('/api/visitor/passes', (req: Request, res: Response) => {
  const session = verifySessionToken(req.headers.authorization);
  const phoneParam = req.query.phone as string;

  let visitorId: string | null = null;
  if (session?.role === 'visitor') {
    visitorId = session.id;
  } else if (phoneParam) {
    const v = db.getVisitorByPhone(phoneParam);
    if (v) visitorId = v.id;
  }

  if (!visitorId) {
    return res.status(401).json({ error: 'Unauthorized: Visitor session or phone required' });
  }

  const passes = db.getPassesByVisitorId(visitorId);
  res.json({ passes });
});

// Request Rotating 60-Second QR Presentation Token with Real ECDSA P-256 Signature
app.post('/api/visitor/passes/:id/token', (req: Request, res: Response) => {
  const session = verifySessionToken(req.headers.authorization);
  const phoneParam = (req.body.phone || req.query.phone) as string;

  const pass = db.getPassById(req.params.id);
  if (!pass) {
    return res.status(404).json({ error: 'Pass not found' });
  }

  // Allow if admin, visitor session owns pass, or phone matches
  const isAuthorized =
    session?.role === 'admin' ||
    (session?.role === 'visitor' && pass.visitorId === session.id) ||
    (phoneParam && normalizePhone(phoneParam) === normalizePhone(pass.visitorPhone));

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized: Valid visitor session required' });
  }

  try {
    const token = db.generateQrToken(pass.id);
    return res.json(token);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

// Real-Time Visitor Pending Gate Challenge (Handset polls this to show biometric prompt)
app.get('/api/visitor/pending-request', (req: Request, res: Response) => {
  const session = verifySessionToken(req.headers.authorization);
  const phoneParam = req.query.phone as string;

  let visitorIdentifier = session?.id;
  if (!visitorIdentifier && phoneParam) {
    visitorIdentifier = phoneParam;
  }

  if (!visitorIdentifier) {
    return res.json({ request: null });
  }

  const pending = db.getPendingRequestForVisitor(visitorIdentifier);
  res.json({ request: pending });
});

// Visitor responds to Gate Challenge (confirms with Biometric or PIN, or rejects)
app.post('/api/visitor/respond-request', (req: Request, res: Response) => {
  const { requestId, action, method, pin, rejectionReason } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: 'requestId is required' });
  }

  if (action === 'REJECT') {
    db.rejectGateAccessRequest(requestId, rejectionReason || 'Visitor rejected access request on handset');
    return res.json({ success: true, status: 'REJECTED' });
  }

  // Confirmation with Biometric or PIN
  const result = db.confirmGateAccessRequest({
    requestId,
    method: method === 'pin' ? 'pin' : 'biometric',
    pin,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, status: 'APPROVED', request: result.request });
});

// ==================== GATE VERIFICATION API ====================

// Gate Initiates Scan (Checks pass, ECDSA sig, triggers live Biometric/PIN prompt on visitor mobile)
app.post('/api/gate/initiate-scan', (req: Request, res: Response) => {
  const { tokenString, passReference, zone } = req.body;
  if (!zone) {
    return res.status(400).json({ error: 'Gate zone parameter is required' });
  }

  const scan = db.initiateGateScanChallenge({
    tokenString,
    passReference,
    zone,
  });

  if (scan.status === 'DENIED') {
    return res.json({
      result: 'DENIED',
      outcome: 'DENIED',
      success: false,
      reason: scan.reason,
      visitorName: scan.pass?.visitorName,
      passId: scan.pass?.id,
      passNumber: scan.pass?.id,
      pass: scan.pass,
      zone,
      timestamp: new Date().toISOString(),
    });
  }

  if (scan.status === 'PENDING_VISITOR_AUTH') {
    return res.json({
      result: 'PENDING',
      outcome: 'PENDING',
      success: true,
      requiresVisitorConfirmation: true,
      requestId: scan.requestId,
      reason: scan.reason,
      visitorName: scan.pass?.visitorName,
      passId: scan.pass?.id,
      passNumber: scan.pass?.id,
      pass: scan.pass,
      zone,
      validUntil: scan.pass?.expiresAt,
      timestamp: new Date().toISOString(),
    });
  }

  // GRANTED directly (if biometric challenge disabled in settings)
  return res.json({
    result: 'GRANTED',
    outcome: 'GRANTED',
    success: true,
    reason: scan.reason,
    visitorName: scan.pass?.visitorName,
    passId: scan.pass?.id,
    passNumber: scan.pass?.id,
    pass: scan.pass,
    zone,
    validUntil: scan.pass?.expiresAt,
    timestamp: new Date().toISOString(),
  });
});

// Gate checks status of ongoing challenge
app.get('/api/gate/request-status/:requestId', (req: Request, res: Response) => {
  const status = db.getGateAccessRequestStatus(req.params.requestId);
  if (!status) {
    return res.status(404).json({ error: 'Request not found or expired' });
  }

  const pass = db.getPassById(status.passId);

  res.json({
    requestId: status.id,
    status: status.status,
    confirmedMethod: status.confirmedMethod,
    confirmedAt: status.confirmedAt,
    zone: status.zone,
    visitorName: status.visitorName,
    passId: status.passId,
    pass,
    expiresAt: status.expiresAt,
  });
});

// Legacy / Instant Verification Endpoint
app.post('/api/gate/verify', (req: Request, res: Response) => {
  const { tokenString, passReference, zone } = req.body;
  if (!zone) {
    return res.status(400).json({ error: 'Gate zone parameter is required' });
  }
  const verification = db.verifyGatePresentation({
    tokenString,
    passReference,
    zone,
  });

  res.json({
    result: verification.result,
    outcome: verification.result,
    success: verification.result === 'GRANTED',
    reason: verification.reason,
    visitorName: verification.pass?.visitorName,
    passId: verification.pass?.id,
    passNumber: verification.pass?.id,
    pass: verification.pass,
    zone,
    validUntil: verification.pass?.expiresAt,
    timestamp: new Date().toISOString(),
  });
});

// Authority Public Key (ECDSA P-256) for Cryptographic Audit
app.get('/api/authority/public-key', (_req: Request, res: Response) => {
  res.json({
    algorithm: 'ECDSA-P256-SHA256',
    publicKeyPem: db.getAuthorityPublicKey(),
  });
});

// ==================== AUDIT & SETTINGS API ====================

// Get Audit Trail
app.get('/api/audit', requireAdmin, (_req: Request, res: Response) => {
  const audit = db.getAudit();
  res.json({ audit });
});

// Get Settings
app.get('/api/settings', requireAdmin, (_req: Request, res: Response) => {
  const settings = db.getSettings();
  res.json({ settings });
});

// Update Settings
app.put('/api/settings', requireAdmin, (req: Request, res: Response) => {
  const { accessZones, zones, defaultValidityHours, qrRefreshIntervalSeconds, requireBiometricOrPinOnScan } = req.body;
  const updated = db.updateSettings({
    ...(accessZones && { accessZones }),
    ...(zones && { zones }),
    ...(defaultValidityHours && { defaultValidityHours: Number(defaultValidityHours) }),
    ...(qrRefreshIntervalSeconds && { qrRefreshIntervalSeconds: Number(qrRefreshIntervalSeconds) }),
    ...(requireBiometricOrPinOnScan !== undefined && { requireBiometricOrPinOnScan: !!requireBiometricOrPinOnScan }),
  });
  res.json({ settings: updated });
});

// Admin Change Password
app.post('/api/settings/change-password', requireAdmin, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const adminId = (req as any).user.id;
  const admin = db.getAdminById(adminId);
  if (!admin || !verifyPassword(currentPassword, admin.passwordHash, admin.salt)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  db.updateAdminPassword(adminId, newPassword);
  res.json({ success: true, message: 'Administrator password updated successfully' });
});

// Reset Sample Data
app.post('/api/settings/reset', requireAdmin, (_req: Request, res: Response) => {
  db.reset();
  res.json({ success: true, message: 'Sample data reset to default successfully' });
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'PASSKEY Access Management API', timestamp: new Date().toISOString() });
});

// ==================== FRONTEND SERVING ====================

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PASSKEY full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
