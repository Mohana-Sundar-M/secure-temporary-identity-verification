/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  Shield,
  User,
  Phone,
  Briefcase,
  Calendar,
  Clock,
  ExternalLink,
  PlusCircle,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { Pass, CreatePassPayload } from '../types';

interface CreatePassWizardProps {
  onNavigate: (path: string) => void;
  onOpenVisitorWithPhone?: (phone: string, tempPass: string) => void;
}

export const CreatePassWizard: React.FC<CreatePassWizardProps> = ({
  onNavigate,
  onOpenVisitorWithPhone,
}) => {
  // Form fields
  const [visitorName, setVisitorName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('9876543210');
  const [company, setCompany] = useState('');
  const [purpose, setPurpose] = useState('');
  const [allowedZones, setAllowedZones] = useState<string[]>(['Main Reception', 'Office Floor']);

  // Date & Time inputs (ISO local strings for datetime-local)
  const formatDateTimeLocal = (date: Date) => {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [validFrom, setValidFrom] = useState(() => formatDateTimeLocal(new Date()));
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 8);
    return formatDateTimeLocal(d);
  });

  const [escortRequired, setEscortRequired] = useState(false);
  const [singleEntryOnly, setSingleEntryOnly] = useState(false);

  // Available zones from system settings
  const [availableZones, setAvailableZones] = useState<string[]>([
    'Main Reception',
    'Office Floor',
    'Engineering Laboratory',
    'Meeting Room',
    'Restricted Area',
  ]);

  // Loading & Error states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success result from backend
  const [createdResult, setCreatedResult] = useState<{
    pass: Pass;
    temporaryPassword?: string;
    isExistingAccount?: boolean;
  } | null>(null);

  const [copiedPass, setCopiedPass] = useState(false);

  useEffect(() => {
    // Load zones from settings
    api.getSettings().then((settings) => {
      if (settings?.zones?.length) {
        setAvailableZones(settings.zones);
        setAllowedZones(settings.defaultZones || [settings.zones[0]]);
      }
    });
  }, []);

  const toggleZone = (zone: string) => {
    if (allowedZones.includes(zone)) {
      if (allowedZones.length > 1) {
        setAllowedZones(allowedZones.filter((z) => z !== zone));
      }
    } else {
      setAllowedZones([...allowedZones, zone]);
    }
  };

  // Date Preset Handlers
  const applyDatePreset = (preset: 'now_4h' | 'today_full' | 'tomorrow' | 'next_week' | 'yesterday_expired') => {
    const now = new Date();
    if (preset === 'now_4h') {
      const from = new Date();
      const until = new Date(from.getTime() + 4 * 3600 * 1000);
      setValidFrom(formatDateTimeLocal(from));
      setValidUntil(formatDateTimeLocal(until));
    } else if (preset === 'today_full') {
      const from = new Date();
      from.setHours(9, 0, 0, 0);
      const until = new Date();
      until.setHours(18, 0, 0, 0);
      setValidFrom(formatDateTimeLocal(from));
      setValidUntil(formatDateTimeLocal(until));
    } else if (preset === 'tomorrow') {
      const tomorrowFrom = new Date();
      tomorrowFrom.setDate(tomorrowFrom.getDate() + 1);
      tomorrowFrom.setHours(9, 0, 0, 0);
      const tomorrowUntil = new Date(tomorrowFrom);
      tomorrowUntil.setHours(18, 0, 0, 0);
      setValidFrom(formatDateTimeLocal(tomorrowFrom));
      setValidUntil(formatDateTimeLocal(tomorrowUntil));
    } else if (preset === 'next_week') {
      const nextWeekFrom = new Date();
      nextWeekFrom.setDate(nextWeekFrom.getDate() + 7);
      nextWeekFrom.setHours(9, 0, 0, 0);
      const nextWeekUntil = new Date(nextWeekFrom);
      nextWeekUntil.setDate(nextWeekUntil.getDate() + 5);
      nextWeekUntil.setHours(18, 0, 0, 0);
      setValidFrom(formatDateTimeLocal(nextWeekFrom));
      setValidUntil(formatDateTimeLocal(nextWeekUntil));
    } else if (preset === 'yesterday_expired') {
      const yestFrom = new Date();
      yestFrom.setDate(yestFrom.getDate() - 1);
      yestFrom.setHours(9, 0, 0, 0);
      const yestUntil = new Date(yestFrom);
      yestUntil.setHours(17, 0, 0, 0);
      setValidFrom(formatDateTimeLocal(yestFrom));
      setValidUntil(formatDateTimeLocal(yestUntil));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!visitorName.trim()) {
      setError('Visitor full name is required');
      return;
    }
    if (phoneDigits.trim().length < 10) {
      setError('Please enter a valid 10-digit Indian mobile number');
      return;
    }
    if (!purpose.trim()) {
      setError('Visit purpose is required');
      return;
    }

    const fullPhone = `+91 ${phoneDigits.trim()}`;
    const fromDate = new Date(validFrom);
    const untilDate = new Date(validUntil);

    if (isNaN(fromDate.getTime()) || isNaN(untilDate.getTime())) {
      setError('Please select valid start and expiry dates/times');
      return;
    }

    if (untilDate.getTime() <= fromDate.getTime()) {
      setError('Pass expiry date/time must be after the start date/time');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreatePassPayload = {
        visitorName: visitorName.trim(),
        phoneNumber: fullPhone,
        company: company.trim() || undefined,
        purpose: purpose.trim(),
        allowedZones,
        validFrom: fromDate.toISOString(),
        validUntil: untilDate.toISOString(),
        escortRequired,
        singleEntryOnly,
      };

      const result = await api.createPass(payload);
      if (result.success && result.pass) {
        setCreatedResult({
          pass: result.pass,
          temporaryPassword: result.temporaryPassword,
          isExistingAccount: result.isExistingAccount,
        });
      } else {
        setError(result.error || 'Failed to issue pass. Please check inputs.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while issuing the pass.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdResult) return;
    const text = `PASSKEY Temporary Digital Pass:
Pass ID: ${createdResult.pass.passNumber}
Visitor: ${createdResult.pass.visitorName}
Phone: ${createdResult.pass.phoneNumber}
${createdResult.temporaryPassword ? `Temporary Password: ${createdResult.temporaryPassword}` : 'Use your existing account password & PIN'}
Valid From: ${new Date(createdResult.pass.validFrom).toLocaleString()}
Valid Until: ${new Date(createdResult.pass.validUntil).toLocaleString()}
Status: ${createdResult.pass.status}`;

    navigator.clipboard.writeText(text);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  // If pass was created, show Confirmation & Credentials Screen
  if (createdResult) {
    const { pass, temporaryPassword, isExistingAccount } = createdResult;
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Visitor Access Pass Issued
            </h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              The digital access credential is cryptographic signed with ECDSA P-256 and ready for mobile presentation.
            </p>
          </div>

          {/* Key Reference Callout */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
                Pass Reference
              </span>
              <span className="text-lg font-bold font-mono text-slate-900">
                {pass.passNumber}
              </span>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
                Pass Status
              </span>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                pass.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                pass.status === 'UPCOMING' ? 'bg-blue-100 text-blue-800' :
                'bg-slate-200 text-slate-800'
              }`}>
                {pass.status}
              </span>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
                Visitor Name
              </span>
              <span className="font-semibold text-slate-900">
                {pass.visitorName}
              </span>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
                Mobile Number
              </span>
              <span className="font-mono text-sm font-semibold text-slate-900">
                {pass.phoneNumber}
              </span>
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-200">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
                Validity Window
              </span>
              <span className="text-xs font-medium text-slate-800">
                {new Date(pass.validFrom).toLocaleString()} to {new Date(pass.validUntil).toLocaleString()}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
                Authorized Facility Zones
              </span>
              <span className="text-xs font-medium text-slate-800">
                {pass.allowedZones.join(', ')}
              </span>
            </div>
          </div>

          {/* Security & One-Time Password Section */}
          <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
              <KeyRound className="w-4 h-4 text-amber-700" />
              <span>
                {isExistingAccount
                  ? 'Existing Visitor Account Recognized'
                  : 'Initial Visitor Temporary Password (Displaying Once)'}
              </span>
            </div>

            {temporaryPassword ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-800 leading-relaxed">
                  Provide this password to the visitor. Upon their first login, they will be prompted to register their <strong>Biometric (Touch ID / Face ID)</strong> and set their <strong>4-digit PIN</strong> for turnstile gate access.
                </p>
                <div className="flex items-center justify-between p-3 bg-white border border-amber-300 rounded-lg">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                      Initial Login Password
                    </span>
                    <span className="font-mono text-lg font-bold text-slate-900 tracking-wider">
                      {temporaryPassword}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyCredentials}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    {copiedPass ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedPass ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-800 leading-relaxed">
                This visitor phone number already has a verified account. The new pass has been linked directly to their profile and will appear immediately in their visitor app.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={() => {
                setCreatedResult(null);
                setVisitorName('');
                setPhoneDigits('9876543210');
                setCompany('');
                setPurpose('');
              }}
              className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Issue Another Pass</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => onNavigate('/passes')}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                View Pass List
              </button>

              <button
                onClick={() => {
                  if (onOpenVisitorWithPhone) {
                    onOpenVisitorWithPhone(pass.phoneNumber, temporaryPassword || '');
                  } else {
                    onNavigate('/visitor');
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <span>Launch Visitor App</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Issue Visitor Access Pass
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Create a cryptographic temporary pass for visitors, contractors, or guest speakers with flexible validity dates.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-sm text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        {/* Section 1: Visitor Identity */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-500" />
            <span>Visitor Identification</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Mobile Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white focus-within:ring-2 focus-within:ring-slate-900 transition-all">
                <span className="bg-slate-100 text-slate-700 font-mono font-bold text-xs px-3 py-2 flex items-center border-r border-slate-300 select-none shrink-0">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, ''))}
                  placeholder="98765 43210"
                  className="block w-full px-3 py-2 text-sm text-slate-900 focus:outline-none bg-transparent font-mono"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Standard Indian country code (+91). Enter 10-digit mobile number.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Organization / Company
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Tata Consultancy Services / IIT Bombay"
                className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Visit Purpose <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Datacenter Technical Review"
                className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Date & Validity Selection (Past, Present, or Future Dates) */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2 mb-4 gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>Pass Validity Dates (Future, Present, or Past)</span>
            </h2>
            <span className="text-[11px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
              Full Date Freedom
            </span>
          </div>

          {/* Date Range Inputs */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Valid From (Start Date & Time) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  required
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Can be set to past, current time, or future dates.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Valid Until (Expiry Date & Time) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  required
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Turnstiles will reject presentation after this timestamp.
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Facility Zones */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <span>Authorized Facility Zones</span>
          </h2>

          <div className="space-y-4">
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {availableZones.map((zone) => {
                  const selected = allowedZones.includes(zone);
                  return (
                    <button
                      type="button"
                      key={zone}
                      onClick={() => toggleZone(zone)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                        selected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{zone}</span>
                      {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={escortRequired}
                  onChange={(e) => setEscortRequired(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Escort required while on premises</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={singleEntryOnly}
                  onChange={(e) => setSingleEntryOnly(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Single entry only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('/passes')}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            {submitting ? 'Cryptographically Signing Pass...' : 'Issue Access Pass'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
