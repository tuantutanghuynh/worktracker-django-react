import React from 'react';
import { X, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../utils/cn';

export default function SupportUserProfile({ user, isOpen, onClose }) {
  if (!isOpen || !user) return null;

  const isUserSuspended = user.is_active === false;
  const isManager = user.role_code === 'MANAGER' || user.role === 'MANAGER' || user.role === 2;

  const profileContent = (
    <>
      <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">User Profile</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          title="Close profile"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs custom-scrollbar">
        {/* Profile Card */}
        <div className="text-center pb-4 border-b border-slate-100">
          <div
            className={cn(
              'w-16 h-16 rounded-full font-bold text-xl flex items-center justify-center text-white mx-auto mb-2.5 shadow-sm ring-4 ring-purple-50',
              isManager ? 'bg-blue-600' : 'bg-slate-700'
            )}
          >
            {(user.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
          </div>
          <h4 className="font-bold text-slate-900 text-sm truncate">{user.full_name || user.email}</h4>
          <p className="text-[11px] text-slate-500 truncate">{user.department_name || 'General Operations'}</p>

          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-200 text-[10px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            <span>Role: {user.role_code || (isManager ? 'MANAGER' : 'STAFF')}</span>
          </div>
        </div>

        {/* Detailed Info List */}
        <div className="space-y-3">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Email:</span>
            <span className="text-slate-800 font-mono break-all bg-slate-50 px-2 py-1 rounded-lg block border border-slate-100">
              {user.email}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Department:</span>
            <span className="text-slate-800 font-semibold bg-slate-50 px-2 py-1 rounded-lg block border border-slate-100">
              {user.department_name || 'Operations'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Account Status:</span>
            {isUserSuspended ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-bold text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Suspended
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg font-bold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* 1. Mobile & Tablet Slide-in Overlay Drawer with Backdrop */}
      <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-fade-in">
        <div className="fixed inset-0" onClick={onClose} />
        <div className="relative w-80 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col z-10 animate-slide-in">
          {profileContent}
        </div>
      </div>

      {/* 2. Desktop 3rd Column Panel */}
      <div className="hidden lg:flex w-72 bg-white rounded-2xl border border-slate-200 shadow-xs flex-col overflow-hidden shrink-0 animate-fade-in">
        {profileContent}
      </div>
    </>
  );
}
