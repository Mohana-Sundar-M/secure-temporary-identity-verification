/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PassStatus } from '../types';

interface StatusBadgeProps {
  status: PassStatus | 'GRANTED' | 'DENIED' | 'REVOKED' | 'EXPIRED' | 'REPLAY_DETECTED' | 'ZONE_UNAUTHORIZED' | string;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className = '' }) => {
  const norm = String(status).toLowerCase();
  let style = 'bg-slate-100 text-slate-700 border-slate-200';
  let text = label || status;

  switch (norm) {
    case 'active':
    case 'granted':
      style = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      text = label || (norm === 'active' ? 'Active' : 'Access Granted');
      break;
    case 'scheduled':
      style = 'bg-blue-50 text-blue-700 border-blue-200';
      text = label || 'Scheduled';
      break;
    case 'expired':
      style = 'bg-slate-100 text-slate-600 border-slate-200';
      text = label || 'Expired';
      break;
    case 'revoked':
      style = 'bg-rose-50 text-rose-700 border-rose-200';
      text = label || 'Revoked';
      break;
    case 'consumed':
      style = 'bg-slate-100 text-slate-600 border-slate-200';
      text = label || 'Used';
      break;
    case 'denied':
    case 'replay_detected':
    case 'zone_unauthorized':
      style = 'bg-rose-50 text-rose-700 border-rose-200';
      text = label || (norm === 'replay_detected' ? 'Replay Blocked' : norm === 'zone_unauthorized' ? 'Unauthorized Zone' : 'Access Denied');
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-md ${style} ${className}`}
    >
      {text}
    </span>
  );
};
