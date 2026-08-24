import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../../utils/cn';
import { useAuth } from '../../../hooks/useAuth';
import RoleBadge from '../badges/RoleBadge';

// Schema xác thực dữ liệu cá nhân (Zod Validation)
const profileFormSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  phone_number: z.string().optional(),
});

// Editable profile fields (full_name, phone_number)
export function ProfileFormCard({ profile, onSave, saving, error, role, email, className = '' }) {
  const { user } = useAuth();
  const currentRole = (role || user?.role || 'EMPLOYEE').toUpperCase();
  const isEmployee = currentRole === 'EMPLOYEE';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileFormSchema),
    values: {
      full_name: profile?.full_name ?? '',
      phone_number: profile?.phone_number ?? '',
    },
  });

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Personal Information</h3>
        <RoleBadge role={currentRole} />
      </div>

      <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase">Department</p>
          <p className="text-xs font-medium text-slate-800 mt-0.5">{profile?.department || '—'}</p>
        </div>
        {isEmployee ? (
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Manager</p>
            <p className="text-xs font-medium text-slate-800 mt-0.5">{profile?.manager_name || '—'}</p>
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Account Role</p>
            <p className="text-xs font-semibold text-slate-800 mt-0.5">{currentRole}</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSave)} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Full Name *
          </label>
          <input
            type="text"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium transition-all"
            {...register('full_name')}
          />
          {errors.full_name && (
            <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.full_name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Phone Number
          </label>
          <input
            type="text"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium transition-all"
            {...register('phone_number')}
          />
        </div>

        {error && <p className="text-[11px] font-semibold text-rose-500">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg text-xs shadow-xs shadow-blue-600/30 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}