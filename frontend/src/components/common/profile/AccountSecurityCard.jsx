import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { cn } from '../../../utils/cn';

// Shows account status and links to the change-password flow.
export function AccountSecurityCard({
  status = 'Active',
  changePasswordPath = '/change-password',
  className = '',
}) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3', className)}>
      <h3 className="text-sm font-bold text-slate-900">Account Security</h3>
      
      <div className="flex items-center space-x-2 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-slate-400" />
        <span className="font-medium">Account Status:</span>
        <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
          {status}
        </span>
      </div>

      <Link
        to={changePasswordPath}
        className="inline-block bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
      >
        Change Password
      </Link>
    </div>
  );
}