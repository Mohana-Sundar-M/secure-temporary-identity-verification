/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  Fingerprint,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Lock,
  Copy,
  Check,
  KeyRound,
  Info,
  Clock,
  Ban,
  ArrowLeft,
  LogOut,
  User,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  Building,
  Phone,
  ShieldAlert,
  X,
  ExternalLink,
} from 'lucide-react';
import { Pass, VisitorAccount, QrPresentationToken, GateAccessRequest } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

interface VisitorMobileWebViewProps {
  initialPhone?: string;
  initialPassword?: string;
  onNavigateAdmin: () => void;
}

export const VisitorMobileWebView: React.FC<VisitorMobileWebViewProps> = ({
  initialPhone = '',
  initialPassword = '',
  onNavigateAdmin,
}) => {
  // Authentication state
  const [visitorSession, setVisitorSession] = useState<{
    token: string;
    account: VisitorAccount;
  } | null>(null);

  // Login inputs with fixed +91 prefix
  const [phoneDigits, setPhoneDigits] = useState(() => {
    if (initialPhone) {
      const digits = initialPhone.replace(/^\+91\s*/, '').replace(/\D/g, '');
      if (digits.length >= 10) return digits.slice(-10);
      if (digits) return digits;
    }
    return '9876543210';
  });
  const [password, setPassword] = useState(initialPassword || 'visitor123');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // First-time Security Setup Wizard
  const [showSecuritySetup, setShowSecuritySetup] = useState(false);
  const [setupStep, setSetupStep] = useState<'password' | 'pin' | 'biometric'>('password');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [confirmPinCode, setConfirmPinCode] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  // Passes & Active Selection
  const [passes, setPasses] = useState<Pass[]>([]);
  const [selectedPass, setSelectedPass] = useState<Pass | null>(null);
  const [loadingPasses, setLoadingPasses] = useState(false);

  // Rotating Token State
  const [presentationToken, setPresentationToken] = useState<QrPresentationToken | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Active Pending Gate Access Challenge (Real-time Turnstile Camera Trigger)
  const [pendingGateRequest, setPendingGateRequest] = useState<GateAccessRequest | null>(null);
  const [challengeMode, setChallengeMode] = useState<'prompt' | 'pin_input' | 'biometric_scanning' | 'approved'>('prompt');
  const [authPinInput, setAuthPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pollingTimerRef = useRef<any>(null);

  // Restore stored session if exists
  useEffect(() => {
    const session = api.getVisitorSession();
    if (session) {
      setVisitorSession(session);
      if (session.account.mustChangePassword) {
        setShowSecuritySetup(true);
        setSetupStep('password');
      } else if (!session.account.hasRegisteredBiometric && !session.account.hasRegisteredPin) {
        setShowSecuritySetup(true);
        setSetupStep('pin');
      }
    }
  }, []);

  // Update inputs if initial props change
  useEffect(() => {
    if (initialPhone) {
      const digits = initialPhone.replace(/^\+91\s*/, '').replace(/\D/g, '');
      if (digits) setPhoneDigits(digits.slice(-10));
    }
    if (initialPassword) setPassword(initialPassword);
  }, [initialPhone, initialPassword]);

  // Load visitor passes
  const loadVisitorPasses = async (phoneNum: string) => {
    setLoadingPasses(true);
    try {
      const list = await api.getVisitorPasses(phoneNum);
      setPasses(list);
      if (list.length > 0) {
        setSelectedPass(list[0]);
      }
    } catch (err) {
      console.error('Failed to load passes:', err);
    } finally {
      setLoadingPasses(false);
    }
  };

  useEffect(() => {
    if (visitorSession && !showSecuritySetup) {
      loadVisitorPasses(visitorSession.account.phoneNumber);
    }
  }, [visitorSession, showSecuritySetup]);

  // Real-Time Background Listener & Polling for Gate Challenges
  useEffect(() => {
    if (!visitorSession || showSecuritySetup) return;

    const phone = visitorSession.account.phoneNumber;

    // 1. Real-time Firestore onSnapshot listener
    const unsubscribe = api.listenVisitorChallenges(phone, (req) => {
      if (req && req.status === 'PENDING_VISITOR_AUTH') {
        if (!pendingGateRequest || pendingGateRequest.id !== req.id) {
          setPendingGateRequest(req);
          setChallengeMode('prompt');
          setAuthPinInput('');
          setAuthError(null);
        }
      } else if (pendingGateRequest && (!req || req.status !== 'PENDING_VISITOR_AUTH')) {
        if (challengeMode !== 'approved') {
          setPendingGateRequest(null);
        }
      }
    });

    // 2. Fallback Polling Loop
    const checkPendingGateChallenge = async () => {
      try {
        const req = await api.getVisitorPendingRequest(phone);
        if (req && req.status === 'PENDING_VISITOR_AUTH') {
          if (!pendingGateRequest || pendingGateRequest.id !== req.id) {
            setPendingGateRequest(req);
            setChallengeMode('prompt');
            setAuthPinInput('');
            setAuthError(null);
          }
        } else if (pendingGateRequest && (!req || req.status !== 'PENDING_VISITOR_AUTH')) {
          if (challengeMode !== 'approved') {
            setPendingGateRequest(null);
          }
        }
      } catch {
        // silent polling catch
      }
    };

    pollingTimerRef.current = setInterval(checkPendingGateChallenge, 1200);

    return () => {
      if (unsubscribe) unsubscribe();
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [visitorSession, showSecuritySetup, pendingGateRequest, challengeMode]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    const fullPhone = `+91 ${phoneDigits.trim()}`;

    try {
      const res = await api.visitorLogin(fullPhone, password);
      if (res.success && res.account && res.sessionToken) {
        const sess = { token: res.sessionToken, account: res.account };
        setVisitorSession(sess);

        if (res.mustChangePassword) {
          setShowSecuritySetup(true);
          setSetupStep('password');
        } else if (!res.account.hasRegisteredBiometric && !res.account.hasRegisteredPin) {
          setShowSecuritySetup(true);
          setSetupStep('pin');
        } else {
          setShowSecuritySetup(false);
          await loadVisitorPasses(res.account.phoneNumber);
        }
      } else {
        setLoginError(res.error || 'Invalid credentials. Check mobile number and password.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Complete Security Setup Wizard
  const handleSaveSecuritySetup = async () => {
    setSetupError(null);
    setSetupLoading(true);

    try {
      if (setupStep === 'password') {
        if (newPassword.length < 6) {
          throw new Error('New password must be at least 6 characters');
        }
        if (newPassword !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const currentPhone = visitorSession?.account.phoneNumber || `+91 ${phoneDigits.trim()}`;
        await api.visitorChangePassword(currentPhone, password, newPassword);
        setSetupStep('pin');
        setSetupLoading(false);
        return;
      }

      if (setupStep === 'pin') {
        if (!/^\d{4}$/.test(pinCode)) {
          throw new Error('Please enter a 4-digit numeric PIN (e.g. 1234)');
        }
        if (pinCode !== confirmPinCode) {
          throw new Error('PIN confirmation does not match');
        }
        setSetupStep('biometric');
        setSetupLoading(false);
        return;
      }

      await api.registerVisitorSecurity({
        pin: pinCode,
        enableBiometric: true,
      });

      setShowSecuritySetup(false);
      if (visitorSession) {
        await loadVisitorPasses(visitorSession.account.phoneNumber);
      }
    } catch (err: any) {
      setSetupError(err.message || 'Failed to complete security setup');
    } finally {
      setSetupLoading(false);
    }
  };

  // Helper: check if pass is active
  const isPassActive = (p: Pass | null) => {
    if (!p) return false;
    const st = (p.status || '').toUpperCase();
    if (st === 'ACTIVE') return true;
    if (p.isRevoked) return false;
    const now = Date.now();
    const from = new Date(p.validFrom).getTime();
    const until = new Date(p.validUntil).getTime();
    return now >= from && now <= until;
  };

  // Handle Refreshing Rotating QR Token
  const fetchToken = async (passId: string) => {
    if (!visitorSession) return;
    setRefreshingToken(true);
    try {
      const res = await api.generateVisitorToken(visitorSession.account.phoneNumber, passId);
      if (res.success && res.token) {
        setPresentationToken(res.token);
        setSecondsRemaining(res.token.refreshInterval || 60);
      }
    } catch (err) {
      console.warn('Failed to generate rotating token:', err);
    } finally {
      setRefreshingToken(false);
    }
  };

  useEffect(() => {
    if (selectedPass && isPassActive(selectedPass) && visitorSession && !showSecuritySetup) {
      fetchToken(selectedPass.id);
    } else {
      setPresentationToken(null);
    }
  }, [selectedPass?.id, visitorSession, showSecuritySetup]);

  // 60-Second Countdown Timer
  useEffect(() => {
    if (!presentationToken) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (selectedPass && isPassActive(selectedPass)) {
            fetchToken(selectedPass.id);
          }
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [presentationToken?.tokenId, selectedPass]);

  // Render QR Canvas
  useEffect(() => {
    if (qrCanvasRef.current && presentationToken?.tokenString) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        presentationToken.tokenString,
        {
          width: 220,
          margin: 2,
          color: {
            dark: '#0F172A',
            light: '#FFFFFF',
          },
        },
        (error) => {
          if (error) console.error('QR Render Error:', error);
        }
      );
    }
  }, [presentationToken?.tokenString, selectedPass]);

  const handleCopyToken = () => {
    if (!presentationToken?.tokenString) return;
    navigator.clipboard.writeText(presentationToken.tokenString);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleLogout = () => {
    api.clearVisitorSession();
    setVisitorSession(null);
    setPasses([]);
    setSelectedPass(null);
    setPresentationToken(null);
    setPendingGateRequest(null);
  };

  // Biometric Confirmation
  const handleConfirmBiometric = async () => {
    if (!pendingGateRequest) return;
    setChallengeMode('biometric_scanning');
    setAuthError(null);

    setTimeout(async () => {
      try {
        const res = await api.respondGateRequest({
          requestId: pendingGateRequest.id,
          action: 'APPROVE',
          method: 'biometric',
        });

        if (res.success) {
          setChallengeMode('approved');
          setTimeout(() => {
            setPendingGateRequest(null);
            setChallengeMode('prompt');
          }, 2400);
        } else {
          setAuthError(res.error || 'Biometric verification failed');
          setChallengeMode('prompt');
        }
      } catch (err: any) {
        setAuthError(err.message || 'Network error confirming biometric');
        setChallengeMode('prompt');
      }
    }, 900);
  };

  // PIN Confirmation
  const handleConfirmPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGateRequest) return;
    setAuthSubmitting(true);
    setAuthError(null);

    try {
      const res = await api.respondGateRequest({
        requestId: pendingGateRequest.id,
        action: 'APPROVE',
        method: 'pin',
        pin: authPinInput.trim(),
      });

      if (res.success) {
        setChallengeMode('approved');
        setTimeout(() => {
          setPendingGateRequest(null);
          setChallengeMode('prompt');
          setAuthPinInput('');
        }, 2400);
      } else {
        setAuthError(res.error || 'Invalid 4-digit PIN');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Incorrect PIN');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleRejectChallenge = async () => {
    if (!pendingGateRequest) return;
    try {
      await api.respondGateRequest({
        requestId: pendingGateRequest.id,
        action: 'REJECT',
        rejectionReason: 'Visitor tapped Deny on handset',
      });
      setPendingGateRequest(null);
    } catch {
      setPendingGateRequest(null);
    }
  };

  const passActive = isPassActive(selectedPass);

  return (
    <div className="w-full flex items-center justify-center p-2 sm:p-4 min-h-[85vh]">
      {/* Phone Mockup Frame - CLEAN WHITE THEME */}
      <div className="w-full max-w-[400px] bg-slate-100 rounded-[44px] p-3.5 shadow-2xl border border-slate-300 relative">
        {/* Notch */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-200 rounded-full flex items-center justify-center gap-2 z-30">
          <div className="w-2 h-2 rounded-full bg-slate-300" />
          <div className="w-8 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Inner Screen */}
        <div className="bg-white text-slate-900 rounded-[36px] overflow-hidden min-h-[620px] flex flex-col relative font-sans border border-slate-200 shadow-inner">
          {/* Status Bar */}
          <div className="pt-3 px-6 pb-2 flex items-center justify-between text-[11px] font-semibold text-slate-500 select-none bg-slate-50 border-b border-slate-100">
            <span>09:41</span>
            <div className="flex items-center gap-1.5">
              <span>5G</span>
              <span>100%</span>
            </div>
          </div>

          {/* ==================== LOGIN SCREEN ==================== */}
          {!visitorSession ? (
            <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
              <div className="space-y-3 pt-6 text-center">
                <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    PASSKEY Mobile
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Temporary Digital Access Credential Verification
                  </p>
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Mobile Number
                  </label>
                  <div className="flex rounded-xl border border-slate-300 overflow-hidden bg-slate-50 focus-within:ring-2 focus-within:ring-slate-900 focus-within:bg-white transition-all">
                    <span className="bg-slate-100 text-slate-700 font-mono font-bold text-xs px-3.5 py-2.5 flex items-center border-r border-slate-300 select-none shrink-0">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={phoneDigits}
                      onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, ''))}
                      placeholder="98765 43210"
                      className="w-full bg-transparent px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  {loginLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Fingerprint className="w-4 h-4" />
                      <span>Sign In & Verify Pass</span>
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Admin Link */}
              <div className="pt-4 border-t border-slate-100 text-center">
                <button
                  onClick={onNavigateAdmin}
                  className="text-xs text-slate-600 hover:text-slate-900 transition-colors cursor-pointer font-medium"
                >
                  Switch to Security Admin Console
                </button>
              </div>
            </div>
          ) : showSecuritySetup ? (
            /* ==================== SECURITY WIZARD ==================== */
            <div className="p-6 flex-1 flex flex-col justify-between bg-white">
              <div className="space-y-4 pt-2">
                <div className="w-12 h-12 bg-slate-100 text-slate-900 rounded-2xl flex items-center justify-center mx-auto border border-slate-200">
                  {setupStep === 'password' ? <KeyRound className="w-6 h-6" /> : setupStep === 'pin' ? <Lock className="w-6 h-6" /> : <Fingerprint className="w-6 h-6 text-emerald-600" />}
                </div>

                <div className="text-center">
                  <h2 className="text-base font-bold text-slate-900">
                    {setupStep === 'password' ? 'Update Password' : setupStep === 'pin' ? 'Set Turnstile PIN' : 'Enroll Biometrics'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {setupStep === 'password'
                      ? 'Change temporary password to proceed'
                      : setupStep === 'pin'
                      ? 'Create a 4-digit PIN for turnstile gate authentication'
                      : 'Enable Touch ID / Face ID for instant gate access'}
                  </p>
                </div>

                {setupError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-lg">
                    {setupError}
                  </div>
                )}

                {setupStep === 'password' && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        New Password (min 6 chars)
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                )}

                {setupStep === 'pin' && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Create 4-Digit PIN
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="1234"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-center text-xl tracking-[0.5em] font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Confirm 4-Digit PIN
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        value={confirmPinCode}
                        onChange={(e) => setConfirmPinCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="1234"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-center text-xl tracking-[0.5em] font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                )}

                {setupStep === 'biometric' && (
                  <div className="pt-4 text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-300 flex items-center justify-center mx-auto animate-pulse">
                      <Fingerprint className="w-10 h-10 text-emerald-600" />
                    </div>
                    <p className="text-xs text-slate-600 max-w-[260px] mx-auto">
                      Touch sensor to enroll your device's biometric key.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  onClick={handleSaveSecuritySetup}
                  disabled={setupLoading}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  {setupLoading ? 'Saving...' : setupStep === 'biometric' ? 'Complete Enrollment' : 'Continue'}
                </button>
              </div>
            </div>
          ) : (
            /* ==================== ACTIVE VISITOR DASHBOARD ==================== */
            <div className="flex-1 flex flex-col justify-between overflow-y-auto bg-slate-50/50">
              {/* Header */}
              <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                    {visitorSession.account.name.charAt(0)}
                  </div>
                  <div className="leading-tight">
                    <span className="text-xs font-bold text-slate-900 block">
                      {visitorSession.account.name}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      {visitorSession.account.phoneNumber}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Log Out"
                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Main Body */}
              <div className="p-4 flex-1 flex flex-col items-center justify-center space-y-4">
                {loadingPasses ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-700" />
                    <span>Loading digital passes...</span>
                  </div>
                ) : passes.length === 0 ? (
                  <div className="text-center py-12 px-4 space-y-2">
                    <Ban className="w-10 h-10 text-slate-400 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-700">No Passes Assigned</h3>
                    <p className="text-xs text-slate-500">
                      There are currently no access passes issued to this mobile number.
                    </p>
                  </div>
                ) : selectedPass ? (
                  <div className="w-full space-y-3">
                    {/* Multi-Pass Bar */}
                    {passes.length > 1 && (
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {passes.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedPass(p)}
                            className={`px-3 py-1 text-xs rounded-lg font-mono font-bold transition-colors cursor-pointer ${
                              selectedPass.id === p.id
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {p.id}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Pass Card - Clean White */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold">
                            Digital Access Pass
                          </span>
                          <span className="font-mono text-base font-extrabold text-slate-900">
                            {selectedPass.id}
                          </span>
                        </div>
                        <StatusBadge status={selectedPass.status} />
                      </div>

                      {/* QR Canvas / Active State */}
                      {passActive ? (
                        <div className="flex flex-col items-center py-2 space-y-2">
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                            <canvas ref={qrCanvasRef} className="rounded-lg" />
                          </div>

                          {/* Countdown */}
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>Code refreshes in:</span>
                            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                              {secondsRemaining}s
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={handleCopyToken}
                              className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              {copiedToken ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedToken ? 'Copied QR Payload' : 'Copy Raw Token'}</span>
                            </button>

                            <button
                              onClick={() => fetchToken(selectedPass.id)}
                              disabled={refreshingToken}
                              className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              <RefreshCw className={`w-3 h-3 ${refreshingToken ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center space-y-2 bg-slate-50 rounded-xl p-4 border border-slate-200">
                          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                          <h4 className="text-sm font-bold text-slate-800">
                            {selectedPass.status?.toUpperCase() === 'EXPIRED' ? 'Pass Has Expired' : selectedPass.status?.toUpperCase() === 'REVOKED' ? 'Pass Has Been Revoked' : 'Pass Scheduled For Future'}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Turnstiles will deny entry presentation for this pass.
                          </p>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5 text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Authorized Zones:</span>
                          <span className="font-semibold text-slate-900 text-right truncate max-w-[180px]">
                            {selectedPass.allowedZones.join(', ')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Valid Until:</span>
                          <span className="font-mono font-medium text-slate-900">
                            {new Date(selectedPass.validUntil).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Purpose:</span>
                          <span className="text-slate-800 truncate max-w-[180px]">
                            {selectedPass.purpose}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Footer */}
              <div className="p-3 bg-white border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between px-4">
                <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Turnstile Listener Active</span>
                </div>
                <button
                  onClick={onNavigateAdmin}
                  className="text-slate-700 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Admin Desk
                </button>
              </div>
            </div>
          )}

          {/* ==================== REAL-TIME TURNSTILE CHALLENGE MODAL (WHITE THEME) ==================== */}
          {pendingGateRequest && (
            <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex flex-col justify-end p-4 animate-in fade-in duration-200">
              <div className="bg-white border-2 border-emerald-500 rounded-3xl p-5 shadow-2xl space-y-4 relative text-slate-900">
                <button
                  onClick={handleRejectChallenge}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-full bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                      Turnstile Entry Request
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      {pendingGateRequest.zone}
                    </h3>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pass Reference:</span>
                    <span className="font-mono font-bold text-slate-900">{pendingGateRequest.passNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Visitor Name:</span>
                    <span className="font-medium text-slate-900">{pendingGateRequest.visitorName}</span>
                  </div>
                </div>

                {authError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                    {authError}
                  </div>
                )}

                {/* Prompt State */}
                {challengeMode === 'prompt' && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs text-slate-600 text-center font-medium">
                      Confirm identity to unlock the turnstile gate:
                    </p>

                    <button
                      type="button"
                      onClick={handleConfirmBiometric}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Fingerprint className="w-5 h-5 text-emerald-100" />
                      <span>Confirm with Biometric</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChallengeMode('pin_input')}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Lock className="w-4 h-4 text-slate-600" />
                      <span>Confirm with 4-Digit PIN</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRejectChallenge}
                      className="w-full py-2 text-rose-600 hover:text-rose-800 text-xs text-center cursor-pointer font-semibold"
                    >
                      Deny Entry
                    </button>
                  </div>
                )}

                {/* Biometric Scanning State */}
                {challengeMode === 'biometric_scanning' && (
                  <div className="py-6 text-center space-y-3">
                    <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-400 flex items-center justify-center mx-auto animate-pulse">
                      <Fingerprint className="w-12 h-12 text-emerald-600" />
                    </div>
                    <p className="text-sm font-semibold text-emerald-800">
                      Verifying Touch ID / Face ID...
                    </p>
                  </div>
                )}

                {/* PIN State */}
                {challengeMode === 'pin_input' && (
                  <form onSubmit={handleConfirmPin} className="space-y-3 pt-1">
                    <div className="text-center">
                      <label className="block text-xs font-semibold text-slate-700 mb-2">
                        Enter 4-Digit Security PIN
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        autoFocus
                        value={authPinInput}
                        onChange={(e) => setAuthPinInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-44 mx-auto bg-slate-50 border-2 border-slate-900 rounded-xl px-4 py-2 text-center text-2xl tracking-[0.5em] font-mono text-slate-900 focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setChallengeMode('prompt')}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={authSubmitting || authPinInput.length !== 4}
                        className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        {authSubmitting ? 'Verifying...' : 'Unlock Gate'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Approved State */}
                {challengeMode === 'approved' && (
                  <div className="py-6 text-center space-y-2">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 border-2 border-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900">
                      Access Authorized!
                    </h4>
                    <p className="text-xs text-emerald-700 font-medium">
                      Turnstile gate has been unlocked.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
