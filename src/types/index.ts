/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PassStatus = 'ACTIVE' | 'UPCOMING' | 'EXPIRED' | 'REVOKED' | 'active' | 'scheduled' | 'expired' | 'revoked' | 'consumed';

export interface Pass {
  id: string; // e.g. PK-8041
  passNumber: string; // alias for id
  visitorId: string;
  visitorName: string;
  visitorPhone: string;
  phoneNumber: string; // alias for visitorPhone
  visitorEmail?: string;
  company?: string;
  hostName?: string;
  hostDepartment?: string;
  purpose: string;
  allowedZones: string[];
  validFrom: string; // ISO 8601 (can be past, present, or future)
  expiresAt: string; // ISO 8601 (alias for validUntil)
  validUntil: string; // alias for expiresAt
  status: PassStatus;
  isRevoked: boolean;
  revokedAt?: string;
  revokedReason?: string;
  notes?: string;
  escortRequired?: boolean;
  singleEntryOnly?: boolean;
  digitalSignature?: string; // Real ECDSA P-256 digital signature
  createdAt: string;
}

export interface VisitorAccount {
  id: string;
  name: string;
  visitorName: string; // alias
  phone: string;
  phoneNumber: string; // alias
  phoneNormalized: string;
  email?: string;
  requiresPasswordChange: boolean;
  mustChangePassword?: boolean; // alias
  hasRegisteredBiometric: boolean;
  hasRegisteredPin: boolean;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  email: string;
}

export type AuditEventType =
  | 'ACCESS_GRANTED'
  | 'ACCESS_DENIED'
  | 'PASS_ISSUED'
  | 'PASS_REVOKED'
  | 'GATE_AUTH_CHALLENGE'
  | 'BIOMETRIC_REGISTERED';

export interface AuditEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType | string;
  visitorName?: string;
  passId?: string;
  passNumber?: string;
  zone: string;
  result: 'GRANTED' | 'DENIED' | 'INFO';
  outcome: 'GRANTED' | 'DENIED' | 'INFO' | string;
  reason: string;
  verificationMethod?: 'biometric' | 'pin' | 'qr_instant';
}

export interface QrPresentationToken {
  tokenId: string;
  passId: string;
  visitorName: string;
  visitorPhone?: string;
  issuedAt: number;
  expiresAt: number | string;
  refreshInterval: number; // 60s
  signature: string;
  algorithm?: string;
  tokenString?: string;
}

export interface SystemSettings {
  accessZones: string[];
  zones: string[]; // alias
  defaultValidityHours: number;
  defaultDurationHours?: number; // alias
  qrRefreshIntervalSeconds: number;
  defaultZones?: string[];
  requireBiometricOrPinOnScan?: boolean;
}

export type GateRequestStatus = 'PENDING_VISITOR_AUTH' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface GateAccessRequest {
  id: string; // req_...
  passId: string;
  passNumber: string;
  visitorId: string;
  visitorName: string;
  visitorPhone: string;
  zone: string;
  status: GateRequestStatus;
  createdAt: number;
  expiresAt: number; // 45s window
  confirmedMethod?: 'biometric' | 'pin';
  confirmedAt?: number;
  rejectionReason?: string;
}

export interface GateVerificationRequest {
  tokenString?: string;
  passReference?: string;
  zone: string;
}

export interface GateVerificationResponse {
  result: 'GRANTED' | 'DENIED' | 'PENDING';
  outcome: 'GRANTED' | 'DENIED' | 'PENDING'; // alias
  success: boolean;
  reason: string;
  requestId?: string; // If biometric/PIN challenge initiated
  requiresVisitorConfirmation?: boolean;
  visitorName?: string;
  passId?: string;
  passNumber?: string;
  pass?: Pass;
  zone: string;
  validUntil?: string;
  timestamp: string;
}

export type VerificationResponse = GateVerificationResponse;

export interface CreatePassPayload {
  visitorName: string;
  phoneNumber: string;
  company?: string;
  purpose: string;
  hostName?: string;
  hostDepartment?: string;
  allowedZones: string[];
  validFrom: string; // ISO 8601
  validUntil: string; // ISO 8601
  escortRequired?: boolean;
  singleEntryOnly?: boolean;
  notes?: string;
}
