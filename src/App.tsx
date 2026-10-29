/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { AdminLoginView } from './views/AdminLoginView';
import { AdminDashboardView } from './views/AdminDashboardView';
import { PassListView } from './views/PassListView';
import { CreatePassWizard } from './views/CreatePassWizard';
import { PassDetailView } from './views/PassDetailView';
import { GateConsoleView } from './views/GateConsoleView';
import { AuditTrailView } from './views/AuditTrailView';
import { SettingsView } from './views/SettingsView';
import { VisitorMobileWebView } from './views/VisitorMobileWebView';
import { api } from './services/api';
import { AdminUser } from './types';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      return p === '/' ? '/dashboard' : p;
    }
    return '/dashboard';
  });

  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => api.getAdminSession());
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Pre-filled visitor credentials for smooth demo transition
  const [visitorPrefill, setVisitorPrefill] = useState<{ phone: string; tempPass: string } | null>(null);

  // Sync with browser navigation
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      setCurrentPath(p === '/' ? '/dashboard' : p);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (path !== currentPath) {
      window.history.pushState(null, '', path);
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAdminLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    navigateTo('/dashboard');
  };

  const handleAdminLogout = () => {
    api.clearAdminSession();
    setAdminUser(null);
  };

  const handleOpenVisitorWithCredentials = (phone: string, tempPass: string) => {
    setVisitorPrefill({ phone, tempPass });
    navigateTo('/visitor');
  };

  const handleResetData = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const isVisitorScreen = currentPath.startsWith('/visitor');

  const renderCurrentView = () => {
    // 1. Visitor Mobile Screen (Isolated dedicated mobile app view)
    if (isVisitorScreen) {
      return (
        <VisitorMobileWebView
          key={`visitor-${refreshKey}`}
          initialPhone={visitorPrefill?.phone || ''}
          initialPassword={visitorPrefill?.tempPass || ''}
          onNavigateAdmin={() => navigateTo('/dashboard')}
        />
      );
    }

    // 2. If not logged in as Admin, show Admin Login View
    if (!adminUser) {
      return (
        <AdminLoginView
          onLoginSuccess={handleAdminLoginSuccess}
          onSwitchToVisitorView={() => navigateTo('/visitor')}
        />
      );
    }

    // 3. Create Pass: /create-pass
    if (currentPath === '/create-pass' || currentPath === '/admin/passes/new') {
      return (
        <CreatePassWizard
          key={`create-${refreshKey}`}
          onNavigate={navigateTo}
          onOpenVisitorWithPhone={handleOpenVisitorWithCredentials}
        />
      );
    }

    // 4. Pass Details: /passes/:id
    if (currentPath.startsWith('/passes/') && currentPath !== '/passes') {
      const passId = currentPath.replace('/passes/', '').split('/')[0];
      return <PassDetailView key={`${passId}-${refreshKey}`} passId={passId} onNavigate={navigateTo} />;
    }

    // 5. Pass Directory: /passes
    if (currentPath === '/passes') {
      return <PassListView key={`list-${refreshKey}`} onNavigate={navigateTo} />;
    }

    // 6. Gate Console: /gate
    if (currentPath === '/gate') {
      return <GateConsoleView key={`gate-${refreshKey}`} onNavigate={navigateTo} />;
    }

    // 7. Audit Trail: /audit
    if (currentPath === '/audit') {
      return <AuditTrailView key={`audit-${refreshKey}`} onNavigate={navigateTo} />;
    }

    // 8. Settings: /settings
    if (currentPath === '/settings') {
      return <SettingsView key={`settings-${refreshKey}`} onResetData={handleResetData} onNavigate={navigateTo} />;
    }

    // Default: Dashboard
    return <AdminDashboardView key={`dash-${refreshKey}`} onNavigate={navigateTo} />;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-slate-200 selection:text-slate-900">
      {/* Top Bar Navigation: Rendered ONLY on Admin & Gate views, NEVER on Visitor Mobile View */}
      {!isVisitorScreen && (
        <Navigation
          currentPath={currentPath}
          onNavigate={navigateTo}
          adminUser={adminUser}
          onAdminLogout={handleAdminLogout}
        />
      )}

      {/* Main Content Area */}
      <main className={`flex-1 ${isVisitorScreen ? 'py-4 flex items-center justify-center' : 'max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
        {renderCurrentView()}
      </main>

      {/* White Footer: Rendered ONLY on Admin screens */}
      {!isVisitorScreen && (
        <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">PASSKEY</span>
              <span>·</span>
              <span>Temporary Identity & Access Verification System</span>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span>NIST P-256 ECDSA Digital Signatures</span>
              <span>·</span>
              <span>PBKDF2 Salted PIN Hashing</span>
              <span>·</span>
              <span>On-Device Biometric Authorization</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
