/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  Shield,
  Clock,
  Building,
  RefreshCw,
  Search,
  Smartphone,
  Radio,
} from 'lucide-react';
import { VerificationResponse } from '../types';
import { api } from '../services/api';

interface GateConsoleViewProps {
  onNavigate: (path: string) => void;
}

export const GateConsoleView: React.FC<GateConsoleViewProps> = () => {
  const [selectedZone, setSelectedZone] = useState<string>('Main Reception');
  const [availableZones, setAvailableZones] = useState<string[]>([
    'Main Reception',
    'Office Floor',
    'Engineering Laboratory',
    'Meeting Room',
    'Restricted Area',
  ]);
  const [manualInput, setManualInput] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResponse | null>(null);

  // Real-Time Visitor Mobile Authorization Challenge State
  const [activeChallengeRequestId, setActiveChallengeRequestId] = useState<string | null>(null);
  const [challengeVisitorName, setChallengeVisitorName] = useState<string>('');
  const [challengePassId, setChallengePassId] = useState<string>('');
  const [challengeSecondsLeft, setChallengeSecondsLeft] = useState<number>(45);

  // Camera state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const pollingIntervalRef = useRef<any>(null);

  useEffect(() => {
    api.getSettings().then((s) => {
      if (s?.zones?.length) {
        setAvailableZones(s.zones);
        setSelectedZone(s.zones[0]);
      }
    });
  }, []);

  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        scanFrame();
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setCameraError(err.message || 'Camera is not available or permission was denied.');
      setCameraActive(false);
    }
  };

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameId.current = requestAnimationFrame(scanFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        handleInitiateGateVerification(code.data);
        stopCamera();
        return;
      }
    }

    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  // Poll for Challenge Status when active
  useEffect(() => {
    if (!activeChallengeRequestId) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    setChallengeSecondsLeft(45);
    const countdownTimer = setInterval(() => {
      setChallengeSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    const checkStatus = async () => {
      const res = await api.checkGateRequestStatus(activeChallengeRequestId);
      if (res) {
        if (res.status === 'APPROVED') {
          clearInterval(countdownTimer);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setVerificationResult({
            result: 'GRANTED',
            outcome: 'GRANTED',
            success: true,
            reason: `Access Granted: Authenticated via visitor mobile ${res.confirmedMethod === 'biometric' ? 'Biometrics' : '4-Digit PIN'}`,
            visitorName: res.visitorName,
            passId: res.passId,
            passNumber: res.passId,
            pass: res.pass,
            zone: res.zone,
            timestamp: new Date().toISOString(),
          });
          setActiveChallengeRequestId(null);
        } else if (res.status === 'REJECTED') {
          clearInterval(countdownTimer);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setVerificationResult({
            result: 'DENIED',
            outcome: 'DENIED',
            success: false,
            reason: 'Access Denied: Visitor cancelled entry request on mobile handset',
            visitorName: res.visitorName,
            passId: res.passId,
            zone: res.zone,
            timestamp: new Date().toISOString(),
          });
          setActiveChallengeRequestId(null);
        } else if (res.status === 'EXPIRED') {
          clearInterval(countdownTimer);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setVerificationResult({
            result: 'DENIED',
            outcome: 'DENIED',
            success: false,
            reason: 'Access Denied: Mobile authorization request timed out (45s window)',
            zone: selectedZone,
            timestamp: new Date().toISOString(),
          });
          setActiveChallengeRequestId(null);
        }
      }
    };

    pollingIntervalRef.current = setInterval(checkStatus, 800);
    checkStatus();

    return () => {
      clearInterval(countdownTimer);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [activeChallengeRequestId, selectedZone]);

  // Main Gate Scan / Verification Handler
  const handleInitiateGateVerification = async (raw: string) => {
    setIsVerifying(true);
    setVerificationResult(null);
    setActiveChallengeRequestId(null);

    try {
      const trimmed = raw.trim();
      let payload: any = trimmed;
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          payload = JSON.parse(trimmed);
        } catch {
          payload = trimmed;
        }
      }

      const res = await api.initiateGateScan(payload, selectedZone);

      if (res.result === 'DENIED') {
        setVerificationResult(res);
      } else if (res.requiresVisitorConfirmation && res.requestId) {
        // Triggered Challenge
        setActiveChallengeRequestId(res.requestId);
        setChallengeVisitorName(res.visitorName || 'Registered Visitor');
        setChallengePassId(res.passId || res.passNumber || '');
      } else {
        // Direct GRANTED
        setVerificationResult(res);
      }
    } catch (err: any) {
      setVerificationResult({
        success: false,
        result: 'DENIED',
        outcome: 'DENIED',
        reason: err.message || 'Turnstile verification failure',
        zone: selectedZone,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Turnstile Access Scanner</h1>
          <p className="text-sm text-slate-600 mt-1">
            Turnstile controller with ECDSA cryptographic token validation & real-time visitor mobile biometric approval.
          </p>
        </div>

        {/* Selected Gate / Zone Selector */}
        <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-300 rounded-xl shadow-xs">
          <Building className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Turnstile:</span>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="text-sm font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
          >
            {availableZones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Scanner & Manual Entry */}
        <div className="lg:col-span-5 space-y-5">
          {/* Camera Viewport Card */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Optical Turnstile Camera
                </span>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                cameraActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {cameraActive ? 'Scanning Live' : 'Camera Idle'}
              </span>
            </div>

            <div className="relative aspect-4/3 bg-slate-900 flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viewfinder Target Graphic */}
              {cameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-56 border-2 border-indigo-400/80 rounded-2xl relative">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-indigo-400" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-indigo-400" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-indigo-400" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-indigo-400" />
                    <div className="absolute inset-x-0 top-1/2 h-0.5 bg-indigo-400/30 animate-pulse" />
                  </div>
                </div>
              )}

              {/* Inactive Placeholder */}
              {!cameraActive && (
                <div className="text-center p-6 space-y-3">
                  <div className="w-12 h-12 bg-slate-800 text-slate-400 rounded-xl flex items-center justify-center mx-auto border border-slate-700">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-300">
                      Camera Scanner Standby
                    </p>
                    <p className="text-xs text-slate-500 max-w-xs mt-1">
                      Activate webcam scanner to read rotating QR codes presented by visitors.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {cameraError && (
              <div className="p-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              {cameraActive ? (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-full py-2 px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CameraOff className="w-3.5 h-3.5" />
                  <span>Deactivate Camera</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Activate Camera Scanner</span>
                </button>
              )}
            </div>
          </div>

          {/* Manual Input / QR Paste Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>Manual Entry & Payload Verification</span>
            </span>
            <p className="text-xs text-slate-500">
              Input Pass Reference (e.g. <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">PK-8041</code>) or paste raw 60s rotating QR token JSON.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualInput.trim()) {
                  handleInitiateGateVerification(manualInput.trim());
                }
              }}
              className="space-y-2.5"
            >
              <textarea
                rows={2}
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder='PK-8041 or {"tokenId":"tok_...","signature":"..."}'
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              />

              <button
                type="submit"
                disabled={isVerifying || !manualInput.trim()}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                <span>Process Turnstile Scan</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Clean White Decision Screen */}
        <div className="lg:col-span-7 space-y-5">
          {/* Waiting for Visitor Mobile Authorization Challenge */}
          {activeChallengeRequestId ? (
            <div className="bg-white border-2 border-indigo-500 rounded-3xl p-8 text-slate-900 shadow-sm space-y-6 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                  <Radio className="w-4 h-4 animate-pulse text-indigo-600" />
                  <span>Awaiting Visitor Mobile Authorization</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full text-xs font-mono">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-amber-700 font-bold">{challengeSecondsLeft}s</span>
                </div>
              </div>

              <div className="text-center space-y-3 py-4">
                <div className="w-20 h-20 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center mx-auto animate-pulse">
                  <Smartphone className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                  Authorization Request Dispatched
                </h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Turnstile scanned pass <strong className="font-mono text-slate-900">{challengePassId}</strong>. A verification prompt has popped up on <strong className="text-slate-900">{challengeVisitorName}'s</strong> handset requesting Biometric or PIN approval.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px] font-semibold uppercase">Requested Turnstile</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{selectedZone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-semibold uppercase">Visitor Identity</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{challengeVisitorName}</span>
                </div>
              </div>
            </div>
          ) : verificationResult ? (
            /* Result Card: White Theme with Emerald/Rose Accents */
            <div className={`bg-white rounded-3xl p-8 border-2 shadow-sm space-y-6 ${
              verificationResult.result === 'GRANTED' ? 'border-emerald-500' : 'border-rose-500'
            }`}>
              {/* Header Badge */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  verificationResult.result === 'GRANTED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {verificationResult.result === 'GRANTED' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Access Authorized</span>
                    </>
                  ) : (
                    <>
                      <X className="w-3.5 h-3.5" />
                      <span>Access Prohibited</span>
                    </>
                  )}
                </span>

                <span className="text-xs text-slate-500 font-mono">
                  {new Date(verificationResult.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Status Graphic & Headline */}
              <div className="text-center space-y-3 py-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 ${
                  verificationResult.result === 'GRANTED'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-300'
                    : 'bg-rose-50 text-rose-600 border-rose-300'
                }`}>
                  {verificationResult.result === 'GRANTED' ? (
                    <CheckCircle2 className="w-12 h-12" />
                  ) : (
                    <XCircle className="w-12 h-12" />
                  )}
                </div>

                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {verificationResult.result === 'GRANTED' ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                </h2>

                <p className={`text-sm max-w-md mx-auto font-medium ${
                  verificationResult.result === 'GRANTED' ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {verificationResult.reason}
                </p>
              </div>

              {/* Pass & Visitor Identity Card */}
              {verificationResult.visitorName && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block uppercase tracking-wider text-[10px] font-semibold">
                        Visitor Identity
                      </span>
                      <span className="text-base font-bold text-slate-900 block mt-0.5">
                        {verificationResult.visitorName}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block uppercase tracking-wider text-[10px] font-semibold">
                        Pass Reference
                      </span>
                      <span className="text-base font-mono font-bold text-slate-900 block mt-0.5">
                        {verificationResult.passNumber || verificationResult.passId}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block uppercase tracking-wider text-[10px] font-semibold">
                        Turnstile Zone
                      </span>
                      <span className="text-sm font-semibold text-slate-800 block mt-0.5">
                        {verificationResult.zone}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block uppercase tracking-wider text-[10px] font-semibold">
                        Turnstile Lock State
                      </span>
                      <span className={`text-sm font-bold block mt-0.5 ${
                        verificationResult.result === 'GRANTED' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {verificationResult.result === 'GRANTED' ? 'UNLOCKED (Open 10s)' : 'LOCKED'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Reset Scanner Button */}
              <button
                onClick={() => {
                  setVerificationResult(null);
                  setManualInput('');
                }}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ready for Next Visitor</span>
              </button>
            </div>
          ) : (
            /* Standby Card */
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto">
                <Shield className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Turnstile Ready & Standing By
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Turnstile <strong>{selectedZone}</strong> is online. Present QR code or enter pass reference to initiate verification.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Local Controller Online
                </span>
                <span>·</span>
                <span>ECDSA P-256 Validation</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
