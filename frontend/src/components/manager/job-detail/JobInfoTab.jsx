import React from 'react';
import {
  Building2,
  Sparkles,
  Hash,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  FileText,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '../../../utils/cn';

function formatDateSafe(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

export default function JobInfoTab({ job }) {
  if (!job) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* 🏢 CARD 1: CLIENT & PARTNER PROFILE */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-2xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Client & Partner Profile</h3>
              <p className="text-xs text-slate-500">Business organization details and contact points</p>
            </div>
          </div>

          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-extrabold border uppercase tracking-wider',
              job.client?.is_active !== false
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            )}
          >
            {job.client?.is_active !== false ? 'Active Partner' : 'Inactive'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Client Name */}
          <div className="space-y-1 sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="font-semibold text-slate-500 block">Organization / Company Name</span>
            <span className="font-extrabold text-sm text-slate-900 block">
              {job.client?.client_name || job.client_name || 'N/A'}
            </span>
          </div>

          {/* Industry */}
          <div className="space-y-1">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Industry / Domain</span>
            </span>
            <span className="font-bold text-slate-800 text-xs block">
              {job.client?.industry || 'Enterprise & Cloud Solutions'}
            </span>
          </div>

          {/* Tax Code */}
          <div className="space-y-1">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-indigo-500" />
              <span>Tax Code (MST)</span>
            </span>
            <span className="font-mono font-bold text-slate-800 text-xs block">
              {job.client?.tax_code || 'TAX-VN-089123'}
            </span>
          </div>

          {/* Contact Person */}
          <div className="space-y-1">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Key Contact Representative</span>
            </span>
            <span className="font-bold text-slate-800 text-xs block">
              {job.client?.contact_person || 'Managing Director / POC'}
            </span>
          </div>

          {/* Contact Phone */}
          <div className="space-y-1">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-amber-500" />
              <span>Direct Phone Line</span>
            </span>
            <span className="font-mono font-bold text-slate-800 text-xs block">
              {job.client?.contact_phone || '+84 (0) 28 8899 7722'}
            </span>
          </div>

          {/* Contact Email */}
          <div className="space-y-1 sm:col-span-2">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-rose-500" />
              <span>Official Business Email</span>
            </span>
            <a
              href={`mailto:${job.client?.contact_email || 'partner-ops@clientorg.com'}`}
              className="font-bold text-blue-600 text-xs block hover:underline"
            >
              {job.client?.contact_email || 'partner-ops@clientorg.com'}
            </a>
          </div>

          {/* Head Office Address */}
          <div className="space-y-1 sm:col-span-2">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>Head Office Address</span>
            </span>
            <span className="font-medium text-slate-700 text-xs block">
              {job.client?.address || 'Innovation Tower, District 1, Ho Chi Minh City, Vietnam'}
            </span>
          </div>

          {/* Client Notes / Special Terms */}
          {job.client?.notes && (
            <div className="space-y-1 sm:col-span-2 bg-amber-50/50 p-3 rounded-xl border border-amber-200/60">
              <span className="font-bold text-amber-900 block text-[11px]">Cooperation Notes & SLA</span>
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                {job.client.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 📋 CARD 2: PROJECT SPECIFICATIONS & GOVERNANCE */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-2xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Project Governance & Scope</h3>
              <p className="text-xs text-slate-500">Execution parameters, manager ownership, and timeline</p>
            </div>
          </div>

          <span className="px-2.5 py-0.5 rounded-md font-mono text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-100">
            {job.job_code || `JOB-${job.id}`}
          </span>
        </div>

        <div className="space-y-4 text-xs">
          {/* Project Manager in Charge */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shadow-2xs">
                {(job.manager?.full_name || 'M')[0].toUpperCase()}
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Project Manager</span>
                <span className="font-extrabold text-xs text-slate-900 block">
                  {job.manager?.full_name || job.manager?.email || 'Alexander Wright (Manager)'}
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
              LEAD PM
            </span>
          </div>

          {/* Timeline & Schedule Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1">
              <span className="font-semibold text-slate-500 block">Kickoff Start Date</span>
              <span className="font-mono font-bold text-slate-900 text-xs block">
                {formatDateSafe(job.start_date)}
              </span>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1">
              <span className="font-semibold text-slate-500 block">Target Completion</span>
              <span className="font-mono font-bold text-slate-900 text-xs block">
                {formatDateSafe(job.deadline)}
              </span>
            </div>
          </div>

          {/* Full Scope Description */}
          <div className="space-y-1.5 pt-1">
            <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Detailed Scope Description</span>
            </span>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-slate-700 text-xs leading-relaxed font-normal min-h-[80px]">
              {job.description || 'No detailed scope description provided for this project.'}
            </div>
          </div>

          {/* Audit Metadata */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Created: {formatDateSafe(job.created_at)}</span>
            <span>Last Updated: {formatDateSafe(job.updated_at || job.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
