/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Building2,
  Users,
  QrCode,
  Activity,
  Settings,
  Plus,
  Smartphone,
  LogOut,
  Shield,
} from 'lucide-react';
import { AdminUser } from '../types';

interface NavigationProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  adminUser: AdminUser | null;
  onAdminLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentPath,
  onNavigate,
  adminUser,
  onAdminLogout,
}) => {
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: Building2 },
    { label: 'Passes', path: '/passes', icon: Users },
    { label: 'Gate Console', path: '/gate', icon: QrCode },
    { label: 'Access Activity', path: '/audit', icon: Activity },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const isCurrentActive = (path: string) => {
    if (path === '/dashboard') return currentPath === '/' || currentPath === '/dashboard';
    return currentPath.startsWith(path);
  };

  const isVisitorScreen = currentPath.startsWith('/visitor');

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner */}
      <div className="bg-slate-900 text-slate-300 text-xs px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">PASSKEY</span>
          <span className="text-slate-500">·</span>
          <span>Temporary Digital Identity Verification & Short-Term Access Management</span>
        </div>
        <div className="flex items-center gap-4">
          {isVisitorScreen ? (
            <button
              onClick={() => onNavigate('/dashboard')}
              className="text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1"
            >
              <span>&larr; Switch to Admin Portal</span>
            </button>
          ) : (
            <button
              onClick={() => window.open('/visitor', '_blank')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Visitor Mobile App View</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-6">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('/dashboard')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider">
                PK
              </div>
              <div>
                <span className="text-base font-bold text-slate-900 tracking-tight block">PASSKEY</span>
                <span className="text-[11px] text-slate-500 block -mt-1 font-normal">Temporary Identity & Access</span>
              </div>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            {navItems.map((item) => {
              const active = isCurrentActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    active
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <item.icon className="w-4 h-4 text-slate-500" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Action Zone: Issue Pass + Profile */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('/create-pass')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Issue Pass</span>
            </button>

            {adminUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="hidden sm:block text-right">
                  <span className="text-xs font-semibold text-slate-900 block leading-tight">{adminUser.name}</span>
                  <span className="text-[10px] text-slate-500 block">Administrator</span>
                </div>
                <button
                  onClick={onAdminLogout}
                  title="Sign out of Admin Portal"
                  className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden border-t border-slate-200 px-3 py-2 flex items-center justify-between overflow-x-auto text-xs bg-slate-50 gap-2">
        {navItems.map((item) => {
          const active = isCurrentActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`px-2.5 py-1.5 rounded-md whitespace-nowrap text-xs font-medium ${
                active ? 'bg-white font-semibold text-slate-900 shadow-xs border border-slate-200' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
