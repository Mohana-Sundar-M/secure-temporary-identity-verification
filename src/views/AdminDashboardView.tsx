/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Clock,
  Ban,
  CheckCircle2,
  Plus,
  QrCode,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Activity,
  Users,
  RefreshCw,
  Building,
} from 'lucide-react';
import { Pass, AuditEntry } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

interface AdminDashboardViewProps {
  onNavigate: (path: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onNavigate }) => {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [passesData, auditData] = await Promise.all([
        api.getPasses().catch((err) => {
          console.warn('Unable to load passes:', err);
          return [] as Pass[];
        }),
        api.getAuditLog().catch((err) => {
          console.warn('Unable to load audit log:', err);
          return [] as AuditEntry[];
        }),
      ]);
      setPasses(passesData);
      setAuditEvents(auditData);
    } catch (err) {
      console.warn('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalPasses = passes.length;
  const activePasses = passes.filter((p) => p.status === 'active').length;
  const scheduledPasses = passes.filter((p) => p.status === 'scheduled').length;
  const revokedPasses = passes.filter((p) => p.status === 'revoked').length;

  const recentPasses = [...passes].slice(0, 5);
  const recentEvents = [...auditEvents].slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Access Operations Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">
            Real-time facility access management, temporary identity issuance, and gate monitoring.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => onNavigate('/gate')}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <QrCode className="w-4 h-4 text-slate-500" />
            <span>Open Gate Console</span>
          </button>
          <button
            onClick={() => onNavigate('/create-pass')}
            className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Issue Access Pass</span>
          </button>
        </div>
      </div>

      {/* Real Calculated Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Passes Issued</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">{totalPasses}</span>
            <span className="text-xs text-slate-500">records</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>Authoritative DB</span>
            <span className="text-emerald-600 font-medium">Synchronized</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Currently Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-700 font-mono tabular-nums">{activePasses}</span>
            <span className="text-xs text-emerald-700 font-medium">valid passes</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>Turnstile Ready</span>
            <span className="text-slate-600">60s dynamic QR</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upcoming Scheduled</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-700 font-mono tabular-nums">{scheduledPasses}</span>
            <span className="text-xs text-blue-700 font-medium">scheduled</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>Future Appointments</span>
            <span className="text-slate-600">Auto-activates</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Revoked Passes</span>
            <Ban className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-rose-700 font-mono tabular-nums">{revokedPasses}</span>
            <span className="text-xs text-slate-500">revoked</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>Access Blocked</span>
            <span className="text-rose-600 font-medium">Denied instantly</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Pass Directory & Recent Access Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pass Directory (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Visitor Passes</h2>
              <p className="text-xs text-slate-500 mt-0.5">Authoritative visitor passes recorded in access directory</p>
            </div>
            <button
              onClick={() => onNavigate('/passes')}
              className="text-xs font-semibold text-slate-900 hover:text-slate-700 flex items-center gap-1"
            >
              <span>View all passes</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px]">
                <tr>
                  <th scope="col" className="px-5 py-3">Pass Ref</th>
                  <th scope="col" className="px-5 py-3">Visitor Name & Phone</th>
                  <th scope="col" className="px-5 py-3">Permitted Zones</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentPasses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      No passes found. Click "Issue Access Pass" to create the first one.
                    </td>
                  </tr>
                ) : (
                  recentPasses.map((pass) => (
                    <tr key={pass.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {pass.passNumber}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{pass.visitorName}</div>
                        <div className="text-[11px] text-slate-500 font-normal">
                          {pass.phoneNumber}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        <div className="flex flex-wrap gap-1">
                          {pass.allowedZones.slice(0, 2).map((z) => (
                            <span key={z} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                              {z}
                            </span>
                          ))}
                          {pass.allowedZones.length > 2 && (
                            <span className="text-[10px] text-slate-400">+{pass.allowedZones.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <StatusBadge status={pass.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => onNavigate(`/passes/${pass.id}`)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          Details &rarr;
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Feed (1 Col) */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-600" />
                <h2 className="text-sm font-bold text-slate-900">Recent Gate Scans</h2>
              </div>
              <button
                onClick={() => onNavigate('/audit')}
                className="text-xs text-slate-600 hover:text-slate-900 font-semibold"
              >
                Full Trail
              </button>
            </div>

            <div className="mt-3 divide-y divide-slate-100 text-xs">
              {recentEvents.length === 0 ? (
                <div className="py-6 text-center text-slate-400">No gate activity recorded yet.</div>
              ) : (
                recentEvents.map((evt) => (
                  <div key={evt.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{evt.visitorName || evt.passNumber}</span>
                      <StatusBadge status={evt.outcome} />
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">{evt.reason}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Gate: {evt.zone}</span>
                      <span className="font-mono">{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
