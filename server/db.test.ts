/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhone,
  hashPassword,
  verifyPassword,
  hashPin,
  verifyPin,
  computePassStatus,
  signWithAuthorityKey,
  verifyAuthoritySignature,
  db,
} from './db.ts';

test('normalizePhone cleans Indian and international formatted numbers to standard format', () => {
  assert.equal(normalizePhone('+91 98765 43210'), '+919876543210');
  assert.equal(normalizePhone('+91 (98201) 12345'), '+919820112345');
  assert.equal(normalizePhone('9876543210'), '+919876543210');
});

test('Password and PIN hashing produces salted timing-safe verification', () => {
  const { hash, salt } = hashPassword('MySecurePass123');
  assert.ok(hash.length > 32);
  assert.ok(salt.length > 16);
  assert.equal(verifyPassword('MySecurePass123', hash, salt), true);
  assert.equal(verifyPassword('WrongPassword', hash, salt), false);

  const pinRes = hashPin('4829');
  assert.ok(pinRes.hash.length > 16);
  assert.equal(verifyPin('4829', pinRes.hash, pinRes.salt), true);
  assert.equal(verifyPin('0000', pinRes.hash, pinRes.salt), false);
});

test('Real ECDSA P-256 digital signature creates and verifies valid cryptographic proof', () => {
  db.reset();
  const pubKey = db.getAuthorityPublicKey();
  const testData = 'PK-TEST:vis-1:Aarav Sharma:Main Reception';
  const token = db.generateQrToken('PK-8041');

  assert.ok(token.tokenString.length > 50);
  assert.ok(token.tokenObj.signature.length > 40);
  assert.equal(token.tokenObj.algorithm, 'ECDSA-P256-SHA256');

  // Verify the signature on the token payload
  const payload = `${token.tokenObj.tokenId}:${token.tokenObj.passId}:${token.tokenObj.issuedAt}:${token.tokenObj.expiresAt}`;
  const isValid = verifyAuthoritySignature(payload, token.tokenObj.signature, pubKey);
  assert.equal(isValid, true);

  // Tampered payload must fail
  const isTamperedValid = verifyAuthoritySignature(payload + '-tampered', token.tokenObj.signature, pubKey);
  assert.equal(isTamperedValid, false);
});

test('Pass status computation derives strictly from time and revocation flag', () => {
  const now = Date.now();
  const basePass = {
    id: 'PK-TEST',
    visitorId: 'vis-1',
    visitorName: 'Aarav Sharma',
    visitorPhone: '+919876543210',
    purpose: 'Test Purpose',
    allowedZones: ['Main Reception'],
    validFrom: new Date(now - 3600000).toISOString(),
    expiresAt: new Date(now + 3600000).toISOString(),
    status: 'ACTIVE' as const,
    isRevoked: false,
    createdAt: new Date().toISOString(),
  };

  assert.equal(computePassStatus(basePass, now), 'ACTIVE');

  // Expired (e.g. created for past date)
  const expiredPass = {
    ...basePass,
    validFrom: new Date(now - 86400000).toISOString(),
    expiresAt: new Date(now - 1000).toISOString(),
  };
  assert.equal(computePassStatus(expiredPass, now), 'EXPIRED');

  // Upcoming (e.g. created for future date)
  const upcomingPass = {
    ...basePass,
    validFrom: new Date(now + 60000).toISOString(),
    expiresAt: new Date(now + 7200000).toISOString(),
  };
  assert.equal(computePassStatus(upcomingPass, now), 'UPCOMING');

  // Revoked (overrides active window)
  const revokedPass = {
    ...basePass,
    isRevoked: true,
  };
  assert.equal(computePassStatus(revokedPass, now), 'REVOKED');
});

test('Gate scan challenge creates pending mobile authorization and completes on visitor biometric/PIN confirmation', () => {
  db.reset();
  const token = db.generateQrToken('PK-8041');

  // Gate scans QR code
  const scanResult = db.initiateGateScanChallenge({
    tokenString: token.tokenString,
    zone: 'Main Reception',
  });

  assert.equal(scanResult.status, 'PENDING_VISITOR_AUTH');
  assert.ok(scanResult.requestId);
  assert.equal(scanResult.pass?.visitorName, 'Aarav Sharma');

  // Visitor mobile queries for pending request
  const visitorPending = db.getPendingRequestForVisitor('+91 98765 43210');
  assert.ok(visitorPending);
  assert.equal(visitorPending.id, scanResult.requestId);

  // Visitor confirms with biometric on mobile
  const confirmRes = db.confirmGateAccessRequest({
    requestId: scanResult.requestId,
    method: 'biometric',
  });

  assert.equal(confirmRes.success, true);
  assert.equal(confirmRes.request?.status, 'APPROVED');

  // Gate checks request status and sees approval
  const finalStatus = db.getGateAccessRequestStatus(scanResult.requestId);
  assert.equal(finalStatus?.status, 'APPROVED');
  assert.equal(finalStatus?.confirmedMethod, 'biometric');
});

test('Gate verification rejects token replay of previously consumed token', () => {
  const token = db.generateQrToken('PK-8041');
  // First scan
  const res1 = db.initiateGateScanChallenge({
    tokenString: token.tokenString,
    zone: 'Main Reception',
  });
  assert.equal(res1.status, 'PENDING_VISITOR_AUTH');

  // Second scan with same token must be rejected
  const res2 = db.initiateGateScanChallenge({
    tokenString: token.tokenString,
    zone: 'Main Reception',
  });
  assert.equal(res2.status, 'DENIED');
  assert.match(res2.reason, /already used|consumed/i);
});

test('Gate verification rejects zone mismatch', () => {
  const token = db.generateQrToken('PK-8041'); // allowed: Main Reception, Engineering Laboratory, Office Floor
  const res = db.initiateGateScanChallenge({
    tokenString: token.tokenString,
    zone: 'Restricted Area', // not in allowedZones
  });
  assert.equal(res.status, 'DENIED');
  assert.match(res.reason, /Zone not permitted/i);
});

test('Gate verification rejects revoked pass', () => {
  const res = db.initiateGateScanChallenge({
    passReference: 'PK-8043', // revoked pass (Vikram Malhotra)
    zone: 'Main Reception',
  });
  assert.equal(res.status, 'DENIED');
  assert.match(res.reason, /revoked/i);
});

test('Issuing additional pass for existing phone number preserves password and returns isExisting', () => {
  db.reset();
  const res1 = db.createVisitor({
    name: 'Aarav Sharma',
    phone: '+91 98765 43210',
    password: 'InitialPassword123',
  });
  assert.equal(res1.isExisting, true);

  // Update password for Aarav
  db.updateVisitorPassword(res1.visitor.id, 'MyNewCreatedPassword123');

  // Issue another pass for Aarav
  const res2 = db.createVisitor({
    name: 'Aarav Sharma Updated',
    phone: '9876543210', // 10 digit Indian number without +91
    password: 'SomeOtherTempPassword999',
  });

  assert.equal(res2.isExisting, true);
  assert.equal(res2.visitor.id, res1.visitor.id);

  // Verify password remained 'MyNewCreatedPassword123'
  assert.equal(verifyPassword('MyNewCreatedPassword123', res2.visitor.passwordHash, res2.visitor.salt), true);
  assert.equal(verifyPassword('SomeOtherTempPassword999', res2.visitor.passwordHash, res2.visitor.salt), false);
});
