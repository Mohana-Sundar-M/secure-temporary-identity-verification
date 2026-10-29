/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Ban,
  Copy,
  Check,
  Eye,
  AlertTriangle,
  X,
  Phone,
  RefreshCw,
  Building,
} from 'lucide-react';
import { Pass } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

interface PassListViewProps {
  onNavigate: (path: string) => void;
}

export const PassListView: React.FC<PassListViewProps> = ({ onNavigate }) => {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Revocation modal state
  const [revokingPass, setRevokingPass] = useState<Pass | null>(null);
  const [revocationReason, setRevocationReason] = useState('Security precaution - visitor departure');
  const [isRevoking, setIsRevoking] = useState(false);

  const loadPasses = async () => {
    try {
      setLoading(true);
      const data = await api.getPasses();
      setPasses(data);
    } catch (err) {
      console.warn('Failed to fetch passes:', err);
      setPasses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPasses();
  }, []);

  // Unique zones
  const allZones = Array.from(new Set(passes.flatMap((p) => p.allowedZones))).sort();

  // Filtered passes
  const filteredPasses = passes.filter((p) => {
    const matchesStatus = statusFilter === 'ALL' || p.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesZone = zoneFilter === 'ALL' || p.allowedZones.includes(zoneFilter);
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      p.passNumber.toLowerCase().includes(query) ||
      p.visitorName.toLowerCase().includes(query) ||
      p.phoneNumber.toLowerCase().includes(query) ||
      (p.company && p.company.toLowerCase().includes(query)) ||
      p.purpose.toLowerCase().includes(query);

    return matchesStatus && matchesZone && matchesQuery;
  });

  const handleCopyPass = (passNum: string) => {
    navigator.clipboard.writeText(passNum);
    setCopiedId(passNum);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConfirmRevoke = async () => {
    if (!revokingPass) return;
    setIsRevoking(true);
    try {
      const res = await api.revokePass(revokingPass.id, revocationReason);
      if (res.success) {
        setRevokingPass(null);
        await loadPasses();
      } else {
        alert(res.error || 'Failed to revoke pass');
      }
    } catch (err: any) {
      alert(err.message || 'Error communicating with access server');
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Visitor Pass Directory</h1>
          <p className="text-sm text-slate-600 mt-1">
            Real-time management of active, scheduled, and revoked facility access credentials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPasses}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => onNavigate('/create-pass')}
            className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Issue New Pass</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by pass #, visitor, phone, company..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="ALL">All ({passes.length})</option>
              <option value="ACTIVE">Active</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="EXPIRED">Expired</option>
              <option value="REVOKED">Revoked</option>
              <option value="CONSUMED">Used (Single-Use)</option>
            </select>
          </div>

          {/* Zone filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium">Zone:</span>
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="ALL">All Zones</option>
              {allZones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th scope="col" className="px-4 py-3">Pass Ref</th>
                <th scope="col" className="px-4 py-3">Visitor Name & Phone</th>
                <th scope="col" className="px-4 py-3">Purpose & Organization</th>
                <th scope="col" className="px-4 py-3">Authorized Zones</th>
                <th scope="col" className="px-4 py-3">Validity Window</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredPasses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-slate-500 font-medium">No visitor passes found matching current criteria.</p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('ALL');
                        setZoneFilter('ALL');
                      }}
                      className="mt-2 text-xs text-slate-900 font-semibold hover:underline"
                    >
                      Reset filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredPasses.map((pass) => {
                  const isRevocable = pass.status === 'active' || pass.status === 'scheduled';

                  return (
                    <tr key={pass.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{pass.passNumber}</span>
                          <button
                            onClick={() => handleCopyPass(pass.passNumber)}
                            title="Copy pass reference"
                            className="text-slate-400 hover:text-slate-700"
                          >
                            {copiedId === pass.passNumber ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {pass.singleEntryOnly && (
                          <span className="mt-0.5 inline-block px-1.5 py-0.2 bg-blue-50 text-blue-700 text-[10px] rounded border border-blue-200 font-sans">
                            Single Entry
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{pass.visitorName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{pass.phoneNumber}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-medium text-slate-900 truncate">{pass.purpose}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {pass.company || 'Standard Visitor'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {pass.allowedZones.map((z) => (
                            <span
                              key={z}
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] border border-slate-200"
                            >
                              {z}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap text-[11px]">
                        <div>{new Date(pass.validFrom).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(pass.validUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="text-slate-400">{new Date(pass.validUntil).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge status={pass.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onNavigate(`/passes/${pass.id}`)}
                            title="Inspect pass details"
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                          >
                            Details
                          </button>
                          {isRevocable && (
                            <button
                              onClick={() => setRevokingPass(pass)}
                              title="Revoke pass immediately"
                              className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revocation Confirmation Modal */}
      {revokingPass && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">Revoke Access Pass</h3>
              </div>
              <button
                onClick={() => setRevokingPass(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600">
              <p>
                Are you sure you want to revoke pass <span className="font-mono font-bold text-slate-900">{revokingPass.passNumber}</span> issued to <span className="font-semibold text-slate-900">{revokingPass.visitorName}</span>?
              </p>
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-800 text-[11px] leading-relaxed">
                <strong>Immediate Security Effect:</strong> The pass will immediately be marked as revoked. Any attempt by this visitor to enter or scan at a gate console will be denied.
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">Reason for Revocation:</label>
                <input
                  type="text"
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-600"
                  placeholder="e.g. Early departure, policy violation, lost phone"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setRevokingPass(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevoke}
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
