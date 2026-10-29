/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building,
  User,
  Phone,
  Clock,
  ShieldAlert,
  Ban,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertTriangle,
  X,
  History,
  QrCode,
} from 'lucide-react';
import { Pass, AuditEntry } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

interface PassDetailViewProps {
  passId: string;
  onNavigate: (path: string) => void;
}

export const PassDetailView: React.FC<PassDetailViewProps> = ({ passId, onNavigate }) => {
  const [pass, setPass] = useState<Pass | null>(null);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState('Administrative access cancellation');
  const [isRevoking, setIsRevoking] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const passData = await api.getPassById(passId);
      setPass(passData || null);

      const logs = await api.getAuditLog();
      setActivity(logs.filter((l) => l.passId === passId || l.passNumber === passData?.passNumber));
    } catch (err) {
      console.error('Failed to load pass details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [passId]);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
        Loading pass records...
      </div>
    );
  }

  if (!pass) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Pass Not Found</h2>
        <p className="text-xs text-slate-500">
          The requested pass reference <span className="font-mono font-bold">{passId}</span> does not exist in the access directory.
        </p>
        <button
          onClick={() => onNavigate('/passes')}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
        >
          Return to Pass Directory
        </button>
      </div>
    );
  }

  const isRevocable = !pass.isRevoked && pass.status?.toUpperCase() !== 'REVOKED';
  const now = new Date();
  const until = new Date(pass.validUntil);
  const remainingMinutes = Math.round((until.getTime() - now.getTime()) / 60000);

  const handleCopyPass = () => {
    navigator.clipboard.writeText(pass.passNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmRevocation = async () => {
    setIsRevoking(true);
    try {
      const res = await api.revokePass(pass.id, revokeReason);
      if (res.success) {
        setShowRevokeModal(false);
        await loadData();
      } else {
        alert(res.error || 'Failed to revoke pass');
      }
    } catch (err: any) {
      alert(err.message || 'Error revoking pass');
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('/passes')}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Passes</span>
        </button>

        <div className="flex items-center gap-2">
          {isRevocable && (
            <button
              onClick={() => setShowRevokeModal(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Revoke Pass</span>
            </button>
          )}
          <button
            onClick={() => onNavigate('/gate')}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Open Gate Console</span>
          </button>
        </div>
      </div>

      {/* Main Pass Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-2xl font-bold text-slate-900">{pass.passNumber}</span>
              <StatusBadge status={pass.status} />
              {pass.singleEntryOnly && (
                <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-medium">
                  Single-Entry
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-2">{pass.visitorName}</h1>
            <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {pass.phoneNumber}
              </span>
              {pass.company && <span>· {pass.company}</span>}
            </div>
          </div>

          <button
            onClick={handleCopyPass}
            className="self-start px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copied ? 'Pass Copied' : 'Copy Pass Ref'}</span>
          </button>
        </div>

        {/* Core Attributes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-slate-500 block text-[11px] font-semibold uppercase tracking-wider">Visit Purpose</span>
            <span className="font-medium text-slate-900 mt-1 block">{pass.purpose}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-slate-500 block text-[11px] font-semibold uppercase tracking-wider">Organization & Cryptography</span>
            <span className="font-medium text-slate-900 mt-1 block">
              {pass.company || 'Standard Visitor'}
            </span>
            <span className="text-[10px] text-emerald-600 font-mono mt-0.5 block flex items-center gap-1">
              <Check className="w-3 h-3 inline" />
              <span>ECDSA P-256 Digitally Signed</span>
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-slate-500 block text-[11px] font-semibold uppercase tracking-wider">Validity Window</span>
            <div className="mt-1 font-mono text-[11px] text-slate-800">
              <div>From: {new Date(pass.validFrom).toLocaleString()}</div>
              <div>Until: {new Date(pass.validUntil).toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-slate-500 block text-[11px] font-semibold uppercase tracking-wider">Remaining Access</span>
            <div className="mt-1 font-semibold text-slate-900">
              {pass.status === 'active' ? (
                remainingMinutes > 60 ? (
                  `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m remaining`
                ) : (
                  `${Math.max(0, remainingMinutes)} minutes remaining`
                )
              ) : pass.status === 'revoked' ? (
                <span className="text-rose-600">Revoked</span>
              ) : pass.status === 'expired' ? (
                <span className="text-slate-500">Expired</span>
              ) : (
                <span className="text-blue-600">Scheduled</span>
              )}
            </div>
          </div>
        </div>

        {/* Authorized Access Zones */}
        <div>
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
            Authorized Facility Access Zones
          </span>
          <div className="flex flex-wrap gap-2">
            {pass.allowedZones.map((z) => (
              <span
                key={z}
                className="px-3 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-medium border border-slate-200"
              >
                {z}
              </span>
            ))}
          </div>
        </div>

        {/* Warnings / Policy notice */}
        {pass.escortRequired && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            <strong>Escort Required:</strong> This visitor must be escorted by authorized facility staff at all times when inside facility zones.
          </div>
        )}

        {/* Administrator Manual Revocation Section */}
        {isRevocable ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-slate-900 block">Administrator Manual Revocation</span>
              <span className="text-slate-500">Need to cancel access prematurely? You can manually revoke this pass anytime.</span>
            </div>
            <button
              onClick={() => setShowRevokeModal(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Revoke Pass Manually</span>
            </button>
          </div>
        ) : (pass.isRevoked || pass.status?.toUpperCase() === 'REVOKED') && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-rose-700">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Pass Revoked by Administrator</span>
            </div>
            <div>Revocation Timestamp: {pass.revokedAt ? new Date(pass.revokedAt).toLocaleString() : 'N/A'}</div>
            <div>Reason on Record: {pass.revokedReason || 'Administrative revocation'}</div>
          </div>
        )}
      </div>

      {/* Access History */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <History className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-900">Pass Gate Access Activity</h2>
        </div>

        {activity.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No gate scan activity on record for this pass yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Zone</th>
                  <th className="px-3 py-2">Outcome</th>
                  <th className="px-3 py-2">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activity.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 font-mono text-slate-600">
                      {new Date(a.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2 text-slate-800 font-medium">{a.zone}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={a.outcome} />
                    </td>
                    <td className="px-3 py-2 text-slate-600">{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revoke Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">Revoke Access Pass</h3>
              </div>
              <button
                onClick={() => setShowRevokeModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600">
              <p>
                Confirm revocation of pass <span className="font-mono font-bold text-slate-900">{pass.passNumber}</span> for <span className="font-semibold text-slate-900">{pass.visitorName}</span>.
              </p>
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-800 text-[11px]">
                Revocation takes immediate effect. The gate controller will reject this pass instantly upon scanning.
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">Revocation Reason:</label>
                <input
                  type="text"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-600"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowRevokeModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevocation}
                disabled={isRevoking}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{isRevoking ? 'Revoking...' : 'Confirm Revocation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
