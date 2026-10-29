/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  RotateCcw,
  Shield,
  Clock,
  Check,
  AlertTriangle,
  Building,
  KeyRound,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import { SystemSettings } from '../types';
import { api } from '../services/api';

interface SettingsViewProps {
  onResetData: () => void;
  onNavigate: (path: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onResetData, onNavigate }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // New zone input
  const [newZoneName, setNewZoneName] = useState('');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [changingPw, setChangingPw] = useState(false);

  // Reset modal
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await api.updateSettings(settings);
      if (res.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddZone = () => {
    if (!newZoneName.trim() || !settings) return;
    if (settings.zones.includes(newZoneName.trim())) return;
    const updated = {
      ...settings,
      zones: [...settings.zones, newZoneName.trim()],
    };
    setSettings(updated);
    setNewZoneName('');
  };

  const handleRemoveZone = (zoneToRemove: string) => {
    if (!settings || settings.zones.length <= 1) return;
    const updated = {
      ...settings,
      zones: settings.zones.filter((z) => z !== zoneToRemove),
      defaultZones: (settings.defaultZones || []).filter((z) => z !== zoneToRemove),
    };
    setSettings(updated);
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match');
      return;
    }

    setChangingPw(true);
    try {
      const res = await api.changeAdminPassword(currentPassword, newPassword);
      if (res.success) {
        setPwSuccess('Administrator password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwError(res.error || 'Failed to update admin password');
      }
    } catch (err: any) {
      setPwError(err.message || 'Error communicating with access server');
    } finally {
      setChangingPw(false);
    }
  };

  const handleExecuteReset = async () => {
    setResetting(true);
    try {
      await api.resetPrototypeData();
      setShowResetConfirm(false);
      onResetData();
      await loadSettings();
    } catch (err: any) {
      alert(err.message || 'Failed to reset prototype data');
    } finally {
      setResetting(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
        Loading system configuration...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings</h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure facility zones, default access parameters, security policies, and administrator credentials.
          </p>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
        >
          {savedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : null}
          <span>{saving ? 'Saving...' : savedSuccess ? 'Saved' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Facility Zones Management */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">Facility Access Zones</h2>
          </div>

          <p className="text-xs text-slate-600">
            Zones defined here populate the pass issuance wizard and the gate turnstile scanner console.
          </p>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="e.g. Roof Terrace or Sector C"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              />
              <button
                type="button"
                onClick={handleAddZone}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
              {settings.zones.map((zone) => (
                <div key={zone} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="font-medium text-slate-800">{zone}</span>
                  {settings.zones.length > 1 && (
                    <button
                      onClick={() => handleRemoveZone(zone)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="Remove zone"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Access Defaults & Token Security */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">Pass Policy & Token Rotation</h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-800">Dynamic QR Token Validity Window:</span>
                <span className="font-mono font-bold text-slate-900">{settings.qrRefreshIntervalSeconds} Seconds</span>
              </div>
              <input
                type="range"
                min={15}
                max={120}
                step={15}
                value={settings.qrRefreshIntervalSeconds}
                onChange={(e) => setSettings({ ...settings, qrRefreshIntervalSeconds: Number(e.target.value) })}
                className="w-full cursor-pointer accent-slate-900"
              />
              <span className="text-[11px] text-slate-500 block mt-1">
                Enforces the 60-second rotating presentation token lifetime. Screenshots or relayed tokens expire automatically.
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Default Pass Duration (Hours)
              </label>
              <select
                value={settings.defaultDurationHours}
                onChange={(e) => setSettings({ ...settings, defaultDurationHours: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value={1}>1 Hour</option>
                <option value={4}>4 Hours</option>
                <option value={8}>8 Hours (Standard)</option>
                <option value={24}>24 Hours</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Password & Reset Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Admin Password Change */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <KeyRound className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">Change Admin Password</h2>
          </div>

          <form onSubmit={handleChangeAdminPassword} className="space-y-3 text-xs">
            {pwError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
                {pwSuccess}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current administrator password"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">New Password (min 6 chars)</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={changingPw}
              className="mt-2 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
            >
              {changingPw ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Prototype Reset */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <h2 className="text-sm font-bold text-slate-900">Prototype Data Reset</h2>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Reset the shared database (`data/db.json`) back to the initial university evaluation seed dataset. Restores seed passes (Elena Rostova, Marcus Sterling, Sarah Jenkins, David Vance), sample audit logs, and default credentials.
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
            <span className="font-semibold text-slate-800 block">Default Prototype Accounts:</span>
            <div>Admin: <code>admin / admin123</code></div>
            <div>Visitor: <code>+1 (555) 234-5678 / visitor123</code></div>
            <div>First-Login Visitor: <code>+1 (555) 567-8901 / Passkey-Demo-9821</code></div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Database to Seed State</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">Confirm Database Reset?</h3>
            </div>
            <p className="text-xs text-slate-600">
              This will restore standard seed passes, visitor credentials, and activity logs. Any newly created test passes will be replaced.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReset}
                disabled={resetting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
              >
                {resetting ? 'Resetting...' : 'Yes, Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
