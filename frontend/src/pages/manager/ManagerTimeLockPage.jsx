import React, { useState, useMemo } from 'react';
import {
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Briefcase,
  Search,
  RotateCcw,
  Plus,
  ShieldCheck,
  Building2,
  History,
  FileText
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

import DataTable from '../../components/common/table/DataTable';
import BaseModal from '../../components/common/modal/BaseModal';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import { cn } from '../../utils/cn';

import {
  useTimeLocks,
  useCreateTimeLock,
  useUnlockTimeLock,
} from '../../hooks/queries/manager/useManagerTimesheets';
import { useManagerJobs } from '../../hooks/queries/manager/useManagerJobs';

function formatDateSafe(dateStr, pattern = 'dd/MM/yyyy HH:mm') {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

export default function ManagerTimeLockPage() {
  // Filters State
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'LOCKED' | 'UNLOCKED'
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    job_id: '',
    period_year: new Date().getFullYear(),
    period_month: new Date().getMonth() + 1,
    lock_reason: 'Monthly Timesheet Review Completed & Locked',
  });

  const [unlockTarget, setUnlockTarget] = useState(null);
  const [unlockReason, setUnlockReason] = useState('');

  // 🚀 TANSTACK REACT QUERY HOOKS
  const { data: timeLocksResponse, isLoading, isFetching, refetch } = useTimeLocks(
    selectedJobId ? { job_id: selectedJobId } : {}
  );
  const { data: jobsResponse } = useManagerJobs({ page_size: 50 });

  const createLockMutation = useCreateTimeLock();
  const unlockMutation = useUnlockTimeLock();

  // Chuẩn hóa danh sách Job cho Dropdown
  const jobOptions = useMemo(() => {
    const list = Array.isArray(jobsResponse)
      ? jobsResponse
      : jobsResponse?.results || [];
    return list.map((j) => ({
      value: String(j.id),
      label: `${j.job_code || `JOB-${j.id}`}: ${j.job_name}`,
    }));
  }, [jobsResponse]);

  // Chuẩn hóa danh sách TimeLocks
  const timeLocksList = useMemo(() => {
    const raw = Array.isArray(timeLocksResponse)
      ? timeLocksResponse
      : timeLocksResponse?.results || [];

    return raw.filter((item) => {
      // Lọc status
      const isLocked = item.is_locked !== false && !item.unlocked_at;
      if (selectedStatus === 'LOCKED' && !isLocked) return false;
      if (selectedStatus === 'UNLOCKED' && isLocked) return false;

      // Lọc search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const jobCode = (item.job?.job_code || `JOB-${item.job?.id || ''}`).toLowerCase();
        const jobName = (item.job?.job_name || '').toLowerCase();
        const reason = (item.reason || item.lock_reason || '').toLowerCase();
        return jobCode.includes(q) || jobName.includes(q) || reason.includes(q);
      }
      return true;
    });
  }, [timeLocksResponse, selectedStatus, searchQuery]);

  // KPI thống kê
  const kpis = useMemo(() => {
    const raw = Array.isArray(timeLocksResponse)
      ? timeLocksResponse
      : timeLocksResponse?.results || [];
    const lockedCount = raw.filter((i) => i.is_locked !== false && !i.unlocked_at).length;
    const unlockedCount = raw.filter((i) => i.unlocked_at || i.is_locked === false).length;
    return {
      total: raw.length,
      lockedCount,
      unlockedCount,
    };
  }, [timeLocksResponse]);

  // Xử lý Tạo Time Lock Mới
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!createForm.job_id) {
      toast.error('Please select a project to lock.');
      return;
    }

    createLockMutation.mutate(
      {
        job_id: Number(createForm.job_id),
        period_year: Number(createForm.period_year),
        period_month: Number(createForm.period_month),
        reason: createForm.lock_reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          setCreateModalOpen(false);
          setCreateForm({
            job_id: '',
            period_year: new Date().getFullYear(),
            period_month: new Date().getMonth() + 1,
            lock_reason: 'Monthly Timesheet Review Completed & Locked',
          });
        },
      }
    );
  };

  // Xử lý Mở Khóa (Unlock)
  const handleUnlockSubmit = (e) => {
    e.preventDefault();
    if (!unlockTarget) return;
    if (!unlockReason.trim()) {
      toast.error('Unlock audit reason is required.');
      return;
    }

    unlockMutation.mutate(
      {
        id: unlockTarget.id,
        reason: unlockReason.trim(),
      },
      {
        onSuccess: () => {
          setUnlockTarget(null);
          setUnlockReason('');
        },
      }
    );
  };

  // Cấu hình Cột DataTable
  const columns = [
    {
      header: 'Project / Job',
      accessorKey: 'job',
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
              {row.job?.job_code || `JOB-${row.job_id || row.job?.id || ''}`}
            </span>
            <span className="text-xs font-bold text-slate-900 truncate">
              {row.job?.job_name || 'Project Master'}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Locked Period',
      accessorKey: 'period_month',
      cell: (row) => {
        const month = String(row.period_month || row.month || '').padStart(2, '0');
        const year = row.period_year || row.year || '2026';
        return (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="font-mono font-bold text-xs text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              Month {month} / {year}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Lock Status',
      accessorKey: 'is_locked',
      cell: (row) => {
        const isLocked = row.is_locked !== false && !row.unlocked_at;
        return isLocked ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
            <Lock className="w-3 h-3" /> LOCKED (Read-Only)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Unlock className="w-3 h-3" /> UNLOCKED (Open)
          </span>
        );
      },
    },
    {
      header: 'Locked By & At',
      accessorKey: 'created_at',
      cell: (row) => (
        <div className="space-y-0.5 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">
            {row.locked_by?.full_name || row.locked_by?.email || 'Manager'}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            {formatDateSafe(row.created_at || row.locked_at)}
          </p>
        </div>
      ),
    },
    {
      header: 'Audit Note / Reason',
      accessorKey: 'reason',
      cell: (row) => (
        <div className="max-w-[200px] text-xs text-slate-600">
          <p className="truncate italic">
            {row.reason || row.lock_reason || 'Periodic timesheet lock'}
          </p>
          {row.unlocked_reason && (
            <p className="text-[10px] text-amber-700 truncate mt-0.5 font-semibold">
              Unlocked: {row.unlocked_reason}
            </p>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      cell: (row) => {
        const isLocked = row.is_locked !== false && !row.unlocked_at;
        return isLocked ? (
          <button
            onClick={() => {
              setUnlockTarget(row);
              setUnlockReason('');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Unlock</span>
          </button>
        ) : (
          <span className="text-[11px] text-slate-400 font-medium italic">Unlocked</span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 text-slate-800 pb-12">
      {/* 🌟 HERO HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Time Lock Periods Management</h1>
            <p className="text-xs text-slate-500 mt-1">
              Freeze monthly project work logs to prevent retroactive modifications and secure report integrity.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetch();
              toast.success('Time lock periods refreshed!');
            }}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
          >
            <RotateCcw className={cn('w-3.5 h-3.5 text-slate-500', isFetching && 'animate-spin')} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Lock New Period</span>
          </button>
        </div>
      </div>

      {/* 📊 3 SUMMARY STATCARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-2xs">
          <span className="text-xs font-bold text-slate-500">Total Lock Periods</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{kpis.total}</span>
            <span className="text-xs font-semibold text-slate-400">periods created</span>
          </div>
        </div>

        <div className="p-4 bg-rose-50/50 border border-rose-200/80 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800">Active Locks (Frozen)</span>
            <Lock className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-rose-900">{kpis.lockedCount}</span>
            <span className="text-xs font-semibold text-rose-700">periods locked</span>
          </div>
        </div>

        <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">Unlocked Periods</span>
            <Unlock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-900">{kpis.unlockedCount}</span>
            <span className="text-xs font-semibold text-emerald-700">periods editable</span>
          </div>
        </div>
      </div>

      {/* 🔍 FILTER TOOLBAR */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {/* Lọc Dự Án */}
          <div className="w-64">
            <SelectDropdown
              value={selectedJobId}
              onChange={(val) => setSelectedJobId(val)}
              options={[{ value: '', label: 'All Projects' }, ...jobOptions]}
              placeholder="Select project..."
            />
          </div>

          {/* Lọc Status */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={cn('px-3 py-1.5 rounded-lg transition', selectedStatus === 'ALL' && 'bg-white text-indigo-700 shadow-xs')}
            >
              All
            </button>
            <button
              onClick={() => setSelectedStatus('LOCKED')}
              className={cn('px-3 py-1.5 rounded-lg transition', selectedStatus === 'LOCKED' && 'bg-white text-rose-700 shadow-xs')}
            >
              Locked ({kpis.lockedCount})
            </button>
            <button
              onClick={() => setSelectedStatus('UNLOCKED')}
              className={cn('px-3 py-1.5 rounded-lg transition', selectedStatus === 'UNLOCKED' && 'bg-white text-emerald-700 shadow-xs')}
            >
              Unlocked ({kpis.unlockedCount})
            </button>
          </div>
        </div>

        {/* Ô Tìm kiếm */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by job code, reason..."
            className="w-full pl-9 pr-3 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-xs rounded-xl border border-transparent focus:border-indigo-400 focus:outline-none"
          />
        </div>
      </div>

      {/* 📋 BẢNG DỮ LIỆU TIME LOCKS */}
      <DataTable
        columns={columns}
        data={timeLocksList}
        isLoading={isLoading}
        emptyMessage="No time lock records matching the selected filters."
      />

      {/* ============================================================
          MODAL 1: TẠO KHÓA KỲ CÔNG MỚI
         ============================================================ */}
      <BaseModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Lock Period for Project"
        subtitle="Freeze all logged work hours for the selected month"
        size="md"
        actions={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateSubmit}
              disabled={createLockMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
            >
              {createLockMutation.isPending ? 'Locking...' : 'Confirm Lock Period'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Project to Lock *</label>
            <SelectDropdown
              value={createForm.job_id}
              onChange={(val) => setCreateForm({ ...createForm, job_id: val })}
              options={jobOptions}
              placeholder="Select project..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Month (1 - 12) *</label>
              <input
                type="number"
                min="1"
                max="12"
                value={createForm.period_month}
                onChange={(e) => setCreateForm({ ...createForm, period_month: e.target.value })}
                className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold border border-transparent focus:border-indigo-400 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Year *</label>
              <input
                type="number"
                min="2020"
                max="2030"
                value={createForm.period_year}
                onChange={(e) => setCreateForm({ ...createForm, period_year: e.target.value })}
                className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold border border-transparent focus:border-indigo-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Lock Audit Note</label>
            <textarea
              rows={2}
              value={createForm.lock_reason}
              onChange={(e) => setCreateForm({ ...createForm, lock_reason: e.target.value })}
              placeholder="Enter audit note or reason for locking..."
              className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs border border-transparent focus:border-indigo-400 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Once locked, assignees cannot add, edit, or delete work logs in this period.</span>
          </div>
        </form>
      </BaseModal>

      {/* ============================================================
          MODAL 2: MỞ KHÓA KỲ CÔNG (UNLOCK - BẮT BUỘC NHẬP LÝ DO AUDIT)
         ============================================================ */}
      <BaseModal
        isOpen={Boolean(unlockTarget)}
        onClose={() => setUnlockTarget(null)}
        title="Unlock Time Period"
        subtitle="Audit reason is required for security tracking"
        size="md"
        actions={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setUnlockTarget(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUnlockSubmit}
              disabled={unlockMutation.isPending}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              {unlockMutation.isPending ? 'Unlocking...' : 'Confirm Unlock'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleUnlockSubmit} className="space-y-4">
          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
            <p>
              Project: <strong>{unlockTarget?.job?.job_code || `JOB-${unlockTarget?.job_id}`}</strong>
            </p>
            <p>
              Period: <strong>Month {unlockTarget?.period_month} / {unlockTarget?.period_year}</strong>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Unlock Reason (Required) *
            </label>
            <textarea
              rows={3}
              required
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="e.g. Unlocked per director request for retroactive 4h logwork correction..."
              className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs border border-transparent focus:border-amber-400 focus:bg-white focus:outline-none"
              autoFocus
            />
          </div>
        </form>
      </BaseModal>
    </div>
  );
}
