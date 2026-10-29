/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { AuditEntry } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

interface AuditTrailViewProps {
  onNavigate: (path: string) => void;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ onNavigate }) => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('ALL');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLog();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit trail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesOutcome =
      outcomeFilter === 'ALL' ||
      (outcomeFilter === 'GRANTED' && log.outcome === 'GRANTED') ||
      (outcomeFilter === 'DENIED' && log.outcome !== 'GRANTED');

    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      (log.passNumber && log.passNumber.toLowerCase().includes(q)) ||
      (log.passId && log.passId.toLowerCase().includes(q)) ||
      (log.visitorName && log.visitorName.toLowerCase().includes(q)) ||
      log.zone.toLowerCase().includes(q) ||
      log.reason.toLowerCase().includes(q) ||
      log.eventType.toLowerCase().includes(q);

    return matchesOutcome && matchesQuery;
  });

  const total = logs.length;
  const granted = logs.filter((l) => l.outcome === 'GRANTED').length;
  const denied = logs.filter((l) => l.outcome !== 'GRANTED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Access Activity & Audit Log</h1>
          <p className="text-sm text-slate-600 mt-1">
            Authoritative, tamper-evident log of all gate check-in attempts, access grants, and security denials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Logged Events</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums block">{total}</span>
          <span className="text-xs text-slate-400 mt-1 block">Full activity journal</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Granted Entries</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 font-mono tabular-nums block">{granted}</span>
          <span className="text-xs text-slate-400 mt-1 block">Successful turnstile authentications</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Denied Scans</span>
          <span className="text-2xl font-bold text-rose-700 mt-1 font-mono tabular-nums block">{denied}</span>
          <span className="text-xs text-slate-400 mt-1 block">Expired, revoked, unauthorized, or replayed</span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by pass #, visitor, zone, or reason..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Outcome:</span>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
          >
            <option value="ALL">All Outcomes ({total})</option>
            <option value="GRANTED">Granted Only ({granted})</option>
            <option value="DENIED">Denied / Blocked ({denied})</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px]">
              <tr>
                <th scope="col" className="px-4 py-3">Timestamp</th>
                <th scope="col" className="px-4 py-3">Pass Ref</th>
                <th scope="col" className="px-4 py-3">Visitor Name</th>
                <th scope="col" className="px-4 py-3">Gate / Zone</th>
                <th scope="col" className="px-4 py-3">Decision</th>
                <th scope="col" className="px-4 py-3">Reason / Human Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No activity entries match your query.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-slate-600 whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      <div className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {log.passId ? (
                        <button
                          onClick={() => onNavigate(`/passes/${log.passId}`)}
                          className="hover:underline text-slate-900 font-bold"
                        >
                          {log.passNumber}
                        </button>
                      ) : (
                        log.passNumber
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                      {log.visitorName || 'Guest'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium border border-slate-200">
                        {log.zone}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StatusBadge status={log.outcome} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 max-w-md">
                      {log.reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
