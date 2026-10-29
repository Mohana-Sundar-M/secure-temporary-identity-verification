/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db as firestoreDb, handleFirestoreError, OperationType } from './firebase';

import {
  Pass,
  VisitorAccount,
  AdminUser,
  AuditEntry,
  SystemSettings,
  GateVerificationResponse,
  GateAccessRequest,
  CreatePassPayload,
  QrPresentationToken,
} from '../types';

const ADMIN_SESSION_KEY = 'passkey_admin_session';
const VISITOR_SESSION_KEY = 'passkey_visitor_session';

interface StoredSession<T> {
  token: string;
  user: T;
}

function normalizePass(p: any): Pass {
  const validUntil = p.expiresAt || p.validUntil || '';
  const statusNorm = (p.status || (p.isRevoked ? 'REVOKED' : 'ACTIVE')).toUpperCase();

  return {
    ...p,
    id: p.id,
    passNumber: p.id || p.passNumber,
    visitorId: p.visitorId || '',
    visitorName: p.visitorName || '',
    visitorPhone: p.visitorPhone || p.phoneNumber || '',
    phoneNumber: p.visitorPhone || p.phoneNumber || '',
    visitorEmail: p.visitorEmail,
    company: p.company || p.notes?.match(/Org: ([^;\n]+)/)?.[1] || '',
    hostName: p.hostName || p.notes?.match(/Host: ([^;\n]+)/)?.[1] || undefined,
    hostDepartment: p.hostDepartment || undefined,
    purpose: p.purpose || '',
    allowedZones: p.allowedZones || [],
    validFrom: p.validFrom || new Date().toISOString(),
    expiresAt: validUntil,
    validUntil,
    status: statusNorm as any,
    isRevoked: !!p.isRevoked || statusNorm === 'REVOKED',
    revokedAt: p.revokedAt,
    revokedReason: p.revokedReason,
    notes: p.notes,
    escortRequired: !!p.escortRequired,
    singleEntryOnly: !!p.singleEntryOnly,
    digitalSignature: p.digitalSignature,
    createdAt: p.createdAt || new Date().toISOString(),
  };
}

function normalizeAudit(a: any): AuditEntry {
  const result = a.result || (a.outcome === 'GRANTED' ? 'GRANTED' : a.outcome === 'DENIED' ? 'DENIED' : 'INFO');
  return {
    ...a,
    id: a.id,
    timestamp: a.timestamp,
    eventType: a.eventType,
    visitorName: a.visitorName || 'Guest',
    passId: a.passId,
    passNumber: a.passId || a.passNumber || '—',
    zone: a.zone || 'Turnstile',
    result: result as any,
    outcome: (a.outcome || result) as any,
    reason: a.reason || '',
    verificationMethod: a.verificationMethod,
  };
}

export class ApiService {
  private adminSession: StoredSession<AdminUser> | null = null;
  private visitorSession: StoredSession<VisitorAccount> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const storedAdmin = localStorage.getItem(ADMIN_SESSION_KEY);
        if (storedAdmin) {
          this.adminSession = JSON.parse(storedAdmin);
        }
      } catch {
        this.adminSession = null;
      }

      try {
        const storedVisitor = localStorage.getItem(VISITOR_SESSION_KEY);
        if (storedVisitor) {
          this.visitorSession = JSON.parse(storedVisitor);
        }
      } catch {
        this.visitorSession = null;
      }
    }
  }

  // Session Getters
  public getAdminSession(): AdminUser | null {
    return this.adminSession?.user || null;
  }

  public clearAdminSession() {
    this.adminSession = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  }

  public getVisitorSession(): { token: string; account: VisitorAccount } | null {
    if (!this.visitorSession) return null;
    return {
      token: this.visitorSession.token,
      account: this.visitorSession.user,
    };
  }

  public clearVisitorSession() {
    this.visitorSession = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(VISITOR_SESSION_KEY);
    }
  }

  // Base HTTP Request Helper
  private async request<T>(
    path: string,
    options: RequestInit = {},
    tokenOverride?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = tokenOverride || this.adminSession?.token || this.visitorSession?.token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(path, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson.error) errorMessage = errJson.error;
      } catch {
        // use default
      }
      if (response.status === 401) {
        if (this.adminSession) this.clearAdminSession();
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // --- ADMIN AUTH ---
  public async adminLogin(
    username: string,
    password: string
  ): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
    try {
      const data = await this.request<{
        token: string;
        role: 'admin';
        user: AdminUser;
      }>('/api/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      this.adminSession = { token: data.token, user: data.user };
      if (typeof window !== 'undefined') {
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(this.adminSession));
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  }

  // --- VISITOR AUTH ---
  public async visitorLogin(
    phone: string,
    password: string
  ): Promise<{
    success: boolean;
    sessionToken?: string;
    account?: VisitorAccount;
    mustChangePassword?: boolean;
    error?: string;
  }> {
    try {
      const data = await this.request<{
        token: string;
        role: 'visitor';
        user: any;
      }>('/api/auth/visitor/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
      });

      const account: VisitorAccount = {
        id: data.user.id,
        name: data.user.name,
        visitorName: data.user.name,
        phone: data.user.phone,
        phoneNumber: data.user.phone,
        phoneNormalized: data.user.phone,
        email: data.user.email,
        requiresPasswordChange: !!data.user.requiresPasswordChange,
        mustChangePassword: !!data.user.requiresPasswordChange,
        hasRegisteredBiometric: !!data.user.hasRegisteredBiometric,
        hasRegisteredPin: !!data.user.hasRegisteredPin,
        createdAt: data.user.createdAt || new Date().toISOString(),
      };

      this.visitorSession = { token: data.token, user: account };
      if (typeof window !== 'undefined') {
        localStorage.setItem(VISITOR_SESSION_KEY, JSON.stringify(this.visitorSession));
      }

      return {
        success: true,
        sessionToken: data.token,
        account,
        mustChangePassword: account.mustChangePassword,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Visitor login failed' };
    }
  }

  public async visitorChangePassword(
    phone: string,
    currentPassword?: string,
    newPassword?: string
  ): Promise<{ success: boolean; account?: VisitorAccount; error?: string }> {
    try {
      await this.request<{ success: boolean }>(
        '/api/auth/visitor/change-password',
        {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword }),
        },
        this.visitorSession?.token
      );

      if (this.visitorSession) {
        this.visitorSession.user.requiresPasswordChange = false;
        this.visitorSession.user.mustChangePassword = false;
        if (typeof window !== 'undefined') {
          localStorage.setItem(VISITOR_SESSION_KEY, JSON.stringify(this.visitorSession));
        }
      }

      return { success: true, account: this.visitorSession?.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to change password' };
    }
  }

  // Register Biometric & PIN
  public async registerVisitorSecurity(params: {
    pin?: string;
    enableBiometric?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await this.request<{ success: boolean; visitor: any }>(
        '/api/auth/visitor/register-security',
        {
          method: 'POST',
          body: JSON.stringify(params),
        },
        this.visitorSession?.token
      );

      if (this.visitorSession) {
        this.visitorSession.user.hasRegisteredBiometric = !!res.visitor.hasRegisteredBiometric;
        this.visitorSession.user.hasRegisteredPin = !!res.visitor.hasRegisteredPin;
        if (typeof window !== 'undefined') {
          localStorage.setItem(VISITOR_SESSION_KEY, JSON.stringify(this.visitorSession));
        }

        // Sync security registration in Firestore
        try {
          const vRef = doc(firestoreDb, 'visitors', this.visitorSession.user.id);
          await setDoc(vRef, {
            id: this.visitorSession.user.id,
            name: this.visitorSession.user.name,
            phone: this.visitorSession.user.phone,
            phoneNormalized: this.visitorSession.user.phone.replace(/\D/g, ''),
            authMethod: 'biometric',
            createdAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('Firestore visitor security sync note:', e);
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to enroll security credentials' };
    }
  }

  // --- PASS MANAGEMENT (ADMIN) ---
  public async getPasses(params: { search?: string; status?: string; zone?: string } = {}): Promise<Pass[]> {
    try {
      const q = new URLSearchParams();
      if (params.search) q.set('search', params.search);
      if (params.status && params.status !== 'ALL') q.set('status', params.status);
      if (params.zone && params.zone !== 'ALL') q.set('zone', params.zone);

      const url = `/api/passes${q.toString() ? `?${q.toString()}` : ''}`;
      const data = await this.request<{ passes: any[] }>(url);
      return (data.passes || []).map(normalizePass);
    } catch (err) {
      // Fallback query Firestore directly
      try {
        const snap = await getDocs(collection(firestoreDb, 'passes'));
        let passes = snap.docs.map(d => normalizePass({ id: d.id, ...d.data() }));
        if (params.status && params.status !== 'ALL') {
          passes = passes.filter(p => p.status.toUpperCase() === params.status?.toUpperCase());
        }
        if (params.search) {
          const s = params.search.toLowerCase();
          passes = passes.filter(p => p.visitorName.toLowerCase().includes(s) || p.visitorPhone.includes(s));
        }
        return passes;
      } catch (fErr) {
        handleFirestoreError(fErr, OperationType.LIST, 'passes');
        return [];
      }
    }
  }

  public async getPassById(id: string): Promise<Pass | null> {
    try {
      const data = await this.request<{ pass: any }>(`/api/passes/${id}`);
      return data.pass ? normalizePass(data.pass) : null;
    } catch {
      try {
        const pSnap = await getDoc(doc(firestoreDb, 'passes', id));
        if (pSnap.exists()) {
          return normalizePass({ id: pSnap.id, ...pSnap.data() });
        }
      } catch (fErr) {
        console.warn('Firestore getPassById fallback failed:', fErr);
      }
      return null;
    }
  }

  // Create Pass: Creates or links existing visitor account and persists pass to Firestore
  public async createPass(payload: CreatePassPayload): Promise<{
    success: boolean;
    pass?: Pass;
    temporaryPassword?: string;
    isExistingAccount?: boolean;
    error?: string;
  }> {
    try {
      const notesParts: string[] = [];
      if (payload.company) notesParts.push(`Org: ${payload.company}`);
      if (payload.notes) notesParts.push(payload.notes);

      const body = {
        visitorName: payload.visitorName,
        visitorPhone: payload.phoneNumber,
        purpose: payload.purpose,
        company: payload.company,
        allowedZones: payload.allowedZones,
        validFrom: payload.validFrom,
        validUntil: payload.validUntil,
        notes: notesParts.join('; '),
        escortRequired: payload.escortRequired,
        singleEntryOnly: payload.singleEntryOnly,
      };

      const data = await this.request<{
        pass: any;
        initialPassword?: string;
        visitorPhone: string;
        isExistingAccount?: boolean;
      }>('/api/passes', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const pass = normalizePass(data.pass);

      // Persist Pass to Firestore
      try {
        await setDoc(doc(firestoreDb, 'passes', pass.id), {
          id: pass.id,
          visitorId: pass.visitorId,
          visitorPhone: pass.visitorPhone,
          visitorName: pass.visitorName,
          purpose: pass.purpose,
          validFrom: pass.validFrom,
          validUntil: pass.validUntil,
          status: pass.status,
          signature: pass.digitalSignature || 'sig_valid',
          createdAt: pass.createdAt,
        });
      } catch (fErr) {
        console.warn('Firestore pass persistence notice:', fErr);
      }

      return {
        success: true,
        pass,
        temporaryPassword: data.initialPassword,
        isExistingAccount: data.isExistingAccount ?? !data.initialPassword,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Pass issuance failed' };
    }
  }

  public async revokePass(id: string, reason: string): Promise<{ success: boolean; pass?: Pass; error?: string }> {
    try {
      const data = await this.request<{ pass: any; message: string }>(`/api/passes/${id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      const pass = normalizePass(data.pass);

      // Sync revocation in Firestore
      try {
        await updateDoc(doc(firestoreDb, 'passes', id), {
          status: 'REVOKED',
          isRevoked: true,
          revokedAt: new Date().toISOString(),
          revokedReason: reason,
        });
      } catch (fErr) {
        console.warn('Firestore pass revocation sync notice:', fErr);
      }

      return { success: true, pass };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to revoke pass' };
    }
  }

  // --- VISITOR PASS APIS (Queries all passes linked to visitor phone number) ---
  public async getVisitorPasses(phone?: string): Promise<Pass[]> {
    try {
      const queryStr = phone ? `?phone=${encodeURIComponent(phone)}` : '';
      const data = await this.request<{ passes: any[] }>(
        `/api/visitor/passes${queryStr}`,
        {},
        this.visitorSession?.token
      );
      return (data.passes || []).map(normalizePass);
    } catch (err) {
      // Fallback: Query Firestore for all passes belonging to visitorPhone
      const targetPhone = phone || this.visitorSession?.user.phoneNumber;
      if (!targetPhone) return [];

      try {
        const cleanDigits = targetPhone.replace(/\D/g, '');
        const q = query(
          collection(firestoreDb, 'passes'),
          where('visitorPhone', '==', targetPhone)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => normalizePass({ id: d.id, ...d.data() }));
      } catch (fErr) {
        console.warn('Firestore getVisitorPasses fallback error:', fErr);
        return [];
      }
    }
  }

  public async generateVisitorToken(
    phone: string,
    passId: string
  ): Promise<{ success: boolean; token?: QrPresentationToken; error?: string }> {
    try {
      const data = await this.request<{
        tokenString: string;
        expiresAt: number;
        refreshInterval: number;
        tokenObj?: any;
      }>(
        `/api/visitor/passes/${passId}/token`,
        {
          method: 'POST',
          body: JSON.stringify({ phone }),
        },
        this.visitorSession?.token
      );

      const tokenObj: QrPresentationToken = {
        tokenId: data.tokenObj?.tokenId || `tok_${Date.now()}`,
        passId,
        visitorName: data.tokenObj?.visitorName || this.visitorSession?.user.visitorName || '',
        visitorPhone: data.tokenObj?.visitorPhone || phone,
        issuedAt: data.tokenObj?.issuedAt || Date.now(),
        expiresAt: data.expiresAt,
        refreshInterval: data.refreshInterval || 60,
        signature: data.tokenObj?.signature || data.tokenString,
        algorithm: data.tokenObj?.algorithm || 'ECDSA-P256-SHA256',
        tokenString: data.tokenString,
      };

      return { success: true, token: tokenObj };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to generate presentation token' };
    }
  }

  // Real-Time Visitor Pending Gate Challenge
  public async getVisitorPendingRequest(phone?: string): Promise<GateAccessRequest | null> {
    try {
      const queryStr = phone ? `?phone=${encodeURIComponent(phone)}` : '';
      const data = await this.request<{ request: GateAccessRequest | null }>(
        `/api/visitor/pending-request${queryStr}`,
        {},
        this.visitorSession?.token
      );
      return data.request;
    } catch {
      return null;
    }
  }

  // Real-time Firestore Listener for Turnstile Verification Challenges on Visitor Handset
  public listenVisitorChallenges(phone: string, callback: (req: GateAccessRequest | null) => void): Unsubscribe {
    const q = query(
      collection(firestoreDb, 'challenges'),
      where('visitorPhone', '==', phone),
      where('status', '==', 'PENDING')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          callback(null);
          return;
        }
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        const req: GateAccessRequest = {
          id: docSnap.id,
          passId: data.passId,
          passNumber: data.passId,
          visitorId: data.visitorId || '',
          visitorName: data.visitorName || 'Visitor',
          visitorPhone: data.visitorPhone,
          zone: data.gateId || data.zone || 'Turnstile',
          status: 'PENDING_VISITOR_AUTH',
          createdAt: new Date(data.createdAt).getTime() || Date.now(),
          expiresAt: Date.now() + 45000,
        };
        callback(req);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'challenges');
      }
    );
  }

  // Visitor responds to challenge on mobile with Biometric or PIN
  public async respondGateRequest(params: {
    requestId: string;
    action: 'APPROVE' | 'REJECT';
    method?: 'biometric' | 'pin';
    pin?: string;
    rejectionReason?: string;
  }): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const data = await this.request<{ success: boolean; status: string }>(
        '/api/visitor/respond-request',
        {
          method: 'POST',
          body: JSON.stringify(params),
        },
        this.visitorSession?.token
      );

      // Update Firestore challenge status
      try {
        await updateDoc(doc(firestoreDb, 'challenges', params.requestId), {
          status: params.action === 'APPROVE' ? 'GRANTED' : 'REJECTED',
          updatedAt: new Date().toISOString(),
        });
      } catch (fErr) {
        console.warn('Firestore challenge response sync note:', fErr);
      }

      return { success: true, status: data.status };
    } catch (err: any) {
      return { success: false, error: err.message || 'Authorization failed' };
    }
  }

  // --- GATE SCANNER & CHALLENGE APIS ---

  // Initiate scan from Gate Console (Camera or manual)
  public async initiateGateScan(
    tokenPayloadOrString: any,
    zone: string
  ): Promise<GateVerificationResponse> {
    try {
      let tokenString: string | undefined;
      let passReference: string | undefined;

      if (typeof tokenPayloadOrString === 'string') {
        const trimmed = tokenPayloadOrString.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          tokenString = trimmed;
        } else {
          passReference = trimmed;
        }
      } else if (tokenPayloadOrString) {
        tokenString = tokenPayloadOrString.tokenString || (tokenPayloadOrString.signature ? JSON.stringify(tokenPayloadOrString) : undefined);
        if (!tokenString && tokenPayloadOrString.passId) {
          passReference = tokenPayloadOrString.passId;
        }
      }

      const res = await this.request<{
        result: 'GRANTED' | 'DENIED' | 'PENDING';
        outcome: 'GRANTED' | 'DENIED' | 'PENDING';
        success: boolean;
        reason: string;
        requestId?: string;
        requiresVisitorConfirmation?: boolean;
        visitorName?: string;
        passId?: string;
        zone?: string;
        validUntil?: string;
        timestamp: string;
      }>('/api/gate/initiate-scan', {
        method: 'POST',
        body: JSON.stringify({ tokenString, passReference, zone }),
      });

      let passData: Pass | undefined;
      if (res.passId) {
        const fetched = await this.getPassById(res.passId);
        if (fetched) passData = fetched;
      }

      // If pending challenge created, persist challenge to Firestore
      if (res.requestId && res.requiresVisitorConfirmation) {
        try {
          await setDoc(doc(firestoreDb, 'challenges', res.requestId), {
            id: res.requestId,
            passId: res.passId || passData?.id || 'UNKNOWN',
            visitorPhone: passData?.visitorPhone || '',
            visitorName: res.visitorName || passData?.visitorName || 'Visitor',
            gateId: zone,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } catch (fErr) {
          console.warn('Firestore challenge creation note:', fErr);
        }
      }

      return {
        result: res.result,
        outcome: res.result,
        success: res.result === 'GRANTED' || res.result === 'PENDING',
        reason: res.reason,
        requestId: res.requestId,
        requiresVisitorConfirmation: !!res.requiresVisitorConfirmation,
        visitorName: res.visitorName,
        passId: res.passId,
        passNumber: res.passId,
        pass: passData,
        zone: res.zone || zone,
        validUntil: res.validUntil,
        timestamp: res.timestamp || new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        result: 'DENIED',
        outcome: 'DENIED',
        success: false,
        reason: err.message || 'Gate scanner network error',
        zone,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Polled or listened by Gate Console
  public async checkGateRequestStatus(requestId: string): Promise<{
    status: 'PENDING_VISITOR_AUTH' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    confirmedMethod?: 'biometric' | 'pin';
    confirmedAt?: number;
    zone: string;
    visitorName: string;
    passId: string;
    pass?: Pass;
  } | null> {
    try {
      const data = await this.request<any>(`/api/gate/request-status/${requestId}`);
      return data;
    } catch {
      return null;
    }
  }

  // Real-time listener for Gate Challenge status
  public listenGateChallengeStatus(requestId: string, callback: (data: any) => void): Unsubscribe {
    return onSnapshot(
      doc(firestoreDb, 'challenges', requestId),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const d = snapshot.data();
        if (d.status === 'GRANTED') {
          callback({
            status: 'APPROVED',
            confirmedMethod: 'biometric',
            confirmedAt: Date.now(),
            zone: d.gateId,
            visitorName: d.visitorName,
            passId: d.passId,
          });
        } else if (d.status === 'REJECTED') {
          callback({
            status: 'REJECTED',
            zone: d.gateId,
            visitorName: d.visitorName,
            passId: d.passId,
          });
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `challenges/${requestId}`);
      }
    );
  }

  public async verifyGatePass(
    tokenPayloadOrString: any,
    zone: string
  ): Promise<GateVerificationResponse> {
    return this.initiateGateScan(tokenPayloadOrString, zone);
  }

  // Public Key for Cryptographic Audits
  public async getAuthorityPublicKey(): Promise<{ algorithm: string; publicKeyPem: string } | null> {
    try {
      return await this.request<{ algorithm: string; publicKeyPem: string }>('/api/authority/public-key');
    } catch {
      return null;
    }
  }

  // --- AUDIT API ---
  public async getAuditLog(): Promise<AuditEntry[]> {
    try {
      const data = await this.request<{ audit: any[] }>('/api/audit');
      return (data.audit || []).map(normalizeAudit);
    } catch (err) {
      try {
        const snap = await getDocs(collection(firestoreDb, 'auditLogs'));
        return snap.docs.map(d => normalizeAudit({ id: d.id, ...d.data() }));
      } catch (fErr) {
        console.warn('Firestore audit log error:', fErr);
        return [];
      }
    }
  }

  // --- SETTINGS API ---
  public async getSettings(): Promise<SystemSettings> {
    try {
      const data = await this.request<{ settings: any }>('/api/settings');
      const s = data.settings || {};
      const zones = s.accessZones || s.zones || [
        'Main Reception',
        'Office Floor',
        'Engineering Laboratory',
        'Meeting Room',
        'Restricted Area',
      ];
      return {
        accessZones: zones,
        zones,
        defaultValidityHours: s.defaultValidityHours || 8,
        defaultDurationHours: s.defaultValidityHours || 8,
        qrRefreshIntervalSeconds: s.qrRefreshIntervalSeconds || 60,
        defaultZones: [zones[0], zones[1] || zones[0]],
        requireBiometricOrPinOnScan: s.requireBiometricOrPinOnScan !== false,
      };
    } catch {
      const fallbackZones = [
        'Main Reception',
        'Office Floor',
        'Engineering Laboratory',
        'Meeting Room',
        'Restricted Area',
      ];
      return {
        accessZones: fallbackZones,
        zones: fallbackZones,
        defaultValidityHours: 8,
        defaultDurationHours: 8,
        qrRefreshIntervalSeconds: 60,
        defaultZones: ['Main Reception', 'Office Floor'],
        requireBiometricOrPinOnScan: true,
      };
    }
  }

  public async updateSettings(settings: Partial<SystemSettings>): Promise<{ success: boolean }> {
    try {
      const body = {
        accessZones: settings.zones || settings.accessZones,
        zones: settings.zones || settings.accessZones,
        defaultValidityHours: settings.defaultDurationHours || settings.defaultValidityHours,
        qrRefreshIntervalSeconds: settings.qrRefreshIntervalSeconds,
        requireBiometricOrPinOnScan: settings.requireBiometricOrPinOnScan,
      };
      await this.request('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  public async changeAdminPassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await this.request<{ success: boolean }>('/api/settings/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      return res;
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to change admin password' };
    }
  }

  public async resetPrototypeData(): Promise<{ success: boolean }> {
    try {
      await this.request('/api/settings/reset', { method: 'POST' });
      return { success: true };
    } catch {
      return { success: false };
    }
  }
}

export const api = new ApiService();
