/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Lock, User, ArrowRight, AlertCircle, Building2 } from 'lucide-react';
import { api } from '../services/api';
import { AdminUser } from '../types';

interface AdminLoginViewProps {
  onLoginSuccess: (user: AdminUser) => void;
  onSwitchToVisitorView: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  onLoginSuccess,
  onSwitchToVisitorView,
}) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.adminLogin(username, password);
      if (response.success && response.user) {
        onLoginSuccess(response.user);
      } else {
        setError(response.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error occurred connecting to local access service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl border border-slate-200 shadow-xs">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Passkey Admin Portal
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Sign in to issue, manage, and monitor facility access passes
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Admin Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors shadow-xs"
          >
            {loading ? 'Authenticating...' : 'Sign In as Administrator'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
          <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-700">Prototype Demo Credentials:</span>
            <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-slate-600">
              <span>Username: <strong>admin</strong></span>
              <span>Password: <strong>admin123</strong></span>
            </div>
          </div>

          <button
            type="button"
            onClick={onSwitchToVisitorView}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium py-1 text-center transition-colors"
          >
            Looking for visitor mobile pass? Switch to Visitor App &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
