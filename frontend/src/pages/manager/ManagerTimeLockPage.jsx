import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  FileText,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
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
  const navigate = useNavigate();

  // 🕒 TỰ ĐỘNG LẤY THỜI GIAN MÁY CHỦ HIỆN TẠI (SERVER-DRIVEN DEFAULT)
  const today = new Date();
  const serverMonth = today.getMonth() + 1; // 1 - 12
  const serverYear = today.getFullYear(); // e.g. 2026

  // 📅 BỘ CHỌN KỲ CÔNG (PERIOD SELECTOR) - MẶC ĐỊNH LÀ KỲ HIỆN TẠI CỦA SERVER
  const [activeMonth, setActiveMonth] = useState(serverMonth);
  const [activeYear, setActiveYear] = useState(serverYear);

  // Filters State
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'LOCKED' | 'UNLOCKED'
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [unlockTarget, setUnlockTarget] = useState(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [isBatchLocking, setIsBatchLocking] = useState(false);

  // 🚀 TANSTACK REACT QUERY HOOKS
  const {
    data: timeLocksResponse,
    isLoading: locksLoading,
    isFetching: locksFetching,
    refetch: refetchLocks,
  } = useTimeLocks();

  const {
    data: jobsResponse,
    isLoading: jobsLoading,
    isFetching: jobsFetching,
    refetch: refetchJobs,
  } = useManagerJobs({ page_size: 100 });

  const createLockMutation = useCreateTimeLock();
  const unlockMutation = useUnlockTimeLock();

  const isFetching = locksFetching || jobsFetching || isBatchLocking;

  // 1. Chuẩn hóa Danh sách Toàn bộ Jobs của Manager
  const allJobs = useMemo(() => {
    if (Array.isArray(jobsResponse)) return jobsResponse;
    if (Array.isArray(jobsResponse?.results)) return jobsResponse.results;
    return [];
  }, [jobsResponse]);

  // 2. Chuẩn hóa Danh sách TimeLocks từ Database
  const rawLocks = useMemo(() => {
    if (Array.isArray(timeLocksResponse)) return timeLocksResponse;
    if (Array.isArray(timeLocksResponse?.results)) return timeLocksResponse.results;
    return [];
  }, [timeLocksResponse]);

  // 3. Kiểm tra tính chất của Kỳ công đang chọn so với Server Clock
  const isPastPeriod = useMemo(() => {
    if (activeYear < serverYear) return true;
    if (activeYear === serverYear && activeMonth < serverMonth) return true;
    return false;
  }, [activeMonth, activeYear, serverMonth, serverYear]);

  const isCurrentPeriod = useMemo(() => {
    return activeYear === serverYear && activeMonth === serverMonth;
  }, [activeMonth, activeYear, serverMonth, serverYear]);

  // 4. Ánh xạ 100% Jobs của Manager với Trạng thái Khóa của Kỳ công đang chọn
  const jobRows = useMemo(() => {
    return allJobs.map((job) => {
      const lockRecord = rawLocks.find(
        (tl) =>
          (tl.job_id === job.id || tl.job?.id === job.id) &&
          Number(tl.lock_month) === Number(activeMonth) &&
          Number(tl.lock_year) === Number(activeYear)
      );

      // Nếu có bản ghi trong DB -> lấy giá trị is_locked của bản ghi đó
      // Nếu chưa có bản ghi -> MỞ (Chưa khóa sổ trong DB)
      let isLocked = false;
      let lockType = 'OPEN'; // 'OPEN' | 'MANUAL_LOCKED' | 'GRACE_UNLOCKED'

      if (lockRecord) {
        if (lockRecord.is_locked === true) {
          isLocked = true;
          lockType = 'MANUAL_LOCKED';
        } else {
          isLocked = false;
          lockType = 'GRACE_UNLOCKED';
        }
      } else {
        isLocked = false;
        lockType = 'OPEN';
      }

      return {
        job_id: job.id,
        job_code: job.job_code || `JOB-${job.id}`,
        job_name: job.job_name,
        job_status: job.status || 'ACTIVE',
        lock_month: activeMonth,
        lock_year: activeYear,
        is_locked: isLocked,
        lock_type: lockType,
        lock_record: lockRecord,
        locked_by: lockRecord?.locked_by,
        locked_at: lockRecord?.locked_at || lockRecord?.created_at,
        lock_reason: lockRecord?.lock_reason || lockRecord?.reason,
        unlocked_reason: lockRecord?.unlocked_reason || lockRecord?.unlock_reason,
      };
    });
  }, [allJobs, rawLocks, activeMonth, activeYear, isPastPeriod, isCurrentPeriod, today]);

  // 5. Lọc dữ liệu theo Status và Tìm kiếm
  const filteredJobRows = useMemo(() => {
    return jobRows.filter((row) => {
      if (selectedStatus === 'LOCKED' && !row.is_locked) return false;
      if (selectedStatus === 'UNLOCKED' && row.is_locked) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          row.job_code.toLowerCase().includes(q) ||
          row.job_name.toLowerCase().includes(q) ||
          (row.lock_reason || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [jobRows, selectedStatus, searchQuery]);

  // 6. Thống kê KPI Kỳ công đang chọn
  const kpis = useMemo(() => {
    const totalJobs = jobRows.length;
    const lockedCount = jobRows.filter((r) => r.is_locked).length;
    const unlockedCount = jobRows.filter((r) => !r.is_locked).length;
    return {
      total: totalJobs,
      lockedCount,
      unlockedCount,
    };
  }, [jobRows]);

  // 🔒 XỬ LÝ KHÓA 1-CLICK CHO 1 JOB CỤ THỂ
  const handleDirectLock = (row) => {
    createLockMutation.mutate(
      {
        job_id: row.job_id,
        lock_month: activeMonth,
        lock_year: activeYear,
        reason: `Period Month ${String(activeMonth).padStart(2, '0')}/${activeYear} locked by Manager`,
      },
      {
        onSuccess: () => {
          refetchLocks();
        },
      }
    );
  };

  // 🔒 XỬ LÝ KHÓA HÀNG LOẠT (BATCH LOCK ALL JOBS)
  const handleBatchLockAll = async () => {
    const openJobs = jobRows.filter((r) => !r.is_locked);
    if (openJobs.length === 0) {
      toast.info('All your projects are already locked for this period!');
      return;
    }

    setIsBatchLocking(true);
    let successCount = 0;

    for (const r of openJobs) {
      try {
        await createLockMutation.mutateAsync({
          job_id: r.job_id,
          lock_month: activeMonth,
          lock_year: activeYear,
          reason: `Batch monthly lock for Month ${String(activeMonth).padStart(2, '0')}/${activeYear}`,
        });
        successCount++;
      } catch (err) {
        console.error('Failed to lock job:', r.job_code, err);
      }
    }

    setIsBatchLocking(false);
    refetchLocks();
    toast.success(
      `Successfully locked ${successCount} project(s) for Month ${String(activeMonth).padStart(2, '0')}/${activeYear}!`
    );
  };

  // 🔓 XỬ LÝ MỞ KHÓA (UNLOCK VỚI LÝ DO AUDIT)
  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    if (!unlockTarget) return;
    if (!unlockReason.trim()) {
      toast.error('Unlock audit reason is required.');
      return;
    }

    try {
      let lockId = unlockTarget.lock_record?.id;
      if (!lockId) {
        // Nếu là Auto-Locked (chưa có dòng trong DB), tạo bản ghi trước rồi mở khóa
        const created = await createLockMutation.mutateAsync({
          job_id: unlockTarget.job_id,
          lock_month: unlockTarget.lock_month,
          lock_year: unlockTarget.lock_year,
          reason: 'System lock record generated for grace window unlock',
        });
        lockId = created.id;
      }

      await unlockMutation.mutateAsync({
        id: lockId,
        reason: unlockReason.trim(),
      });

      setUnlockTarget(null);
      setUnlockReason('');
      refetchLocks();
    } catch (err) {
      console.error('Failed to unlock period', err);
    }
  };

  // Cấu hình Cột DataTable
  const columns = [
    {
      header: 'Project / Job',
      accessorKey: 'job_code',
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
              {row.job_code}
            </span>
            <span className="text-xs font-bold text-slate-900 truncate">
              {row.job_name}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Period Month',
      accessorKey: 'lock_month',
      cell: (row) => {
        const month = String(row.lock_month).padStart(2, '0');
        const year = row.lock_year;
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
        if (row.lock_type === 'MANUAL_LOCKED') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
              <Lock className="w-3 h-3" /> LOCKED (Period Closed)
            </span>
          );
        }
        if (row.lock_type === 'GRACE_UNLOCKED') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
              <Unlock className="w-3 h-3" /> UNLOCKED (Grace Window)
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Unlock className="w-3 h-3" /> OPEN (Ready to Lock)
          </span>
        );
      },
    },
    {
      header: 'Locked By & At',
      accessorKey: 'locked_at',
      cell: (row) => (
        <div className="space-y-0.5 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">
            {row.locked_by?.full_name || row.locked_by?.email || (row.is_locked ? 'Manager' : '—')}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            {row.locked_at ? formatDateSafe(row.locked_at) : 'Open'}
          </p>
        </div>
      ),
    },
    {
      header: 'Audit Reason / Note',
      accessorKey: 'lock_reason',
      cell: (row) => (
        <div className="max-w-[220px] text-xs text-slate-600">
          <p className="truncate italic">
            {row.lock_reason || 'Open for timesheet entry'}
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
        return (
          <div className="flex items-center gap-2">
            {row.is_locked ? (
              <button
                onClick={() => {
                  setUnlockTarget(row);
                  setUnlockReason('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Unlock this period to allow time adjustments"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Unlock</span>
              </button>
            ) : (
              <button
                onClick={() => handleDirectLock(row)}
                disabled={createLockMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                title="Lock this period to freeze timesheets"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock</span>
              </button>
            )}

            <button
              onClick={() => navigate(`/manager/timesheet?job_id=${row.job_id}`)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
              title="Review timesheets for this project"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Timesheet</span>
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 text-slate-800 pb-12">
      {/* 🌟 HERO HEADER VỚI BỘ CHỌN KỲ CÔNG (PERIOD SELECTOR) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">Period Locks Management</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Server Clock: Month {String(serverMonth).padStart(2, '0')} / {serverYear}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Centralized timesheet period freeze for all your projects. Lock to prevent modifications or unlock to correct work logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Nút Làm Mới */}
          <button
            onClick={() => {
              refetchLocks();
              refetchJobs();
              toast.success('Period locks refreshed!');
            }}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
          >
            <RotateCcw className={cn('w-3.5 h-3.5 text-slate-500', isFetching && 'animate-spin')} />
            <span>Refresh</span>
          </button>

          {/* Nút 1-Click Khóa Toàn Bộ Dự Án Của Manager */}
          <button
            onClick={handleBatchLockAll}
            disabled={isFetching || kpis.unlockedCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 transition cursor-pointer disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            <span>{isBatchLocking ? 'Locking All...' : `Lock All My Projects (Month ${String(activeMonth).padStart(2, '0')})`}</span>
          </button>
        </div>
      </div>

      {/* 📅 PERIOD SWITCHER BAR (BỘ CHUYỂN KỲ CÔNG LINH HOẠT) */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mr-1">
            Selected Period:
          </span>

          {[7, 8, 9, 10, 11, 12].map((m) => {
            const isSelected = activeMonth === m && activeYear === 2026;
            const isCurrent = serverMonth === m && serverYear === 2026;

            return (
              <button
                key={m}
                onClick={() => {
                  setActiveMonth(m);
                  setActiveYear(2026);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer",
                  isSelected
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                )}
              >
                <span>Month {String(m).padStart(2, "0")} / 2026</span>
                {isCurrent && (
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.2 rounded-full font-extrabold",
                    isSelected ? "bg-white text-indigo-700" : "bg-blue-100 text-blue-700"
                  )}>
                    NOW
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Cảnh báo nếu kỳ đang xem là kỳ quá khứ */}
        {isPastPeriod && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Past cutoff period — Auto-locked by system rule.</span>
          </div>
        )}
      </div>

      {/* ℹ️ TWO-TIER CUTOFF POLICY BANNER */}
      <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-blue-900">Two-Tier Enterprise Cutoff Policy</p>
            <p className="text-blue-700 mt-0.5">
              • <strong>Manager Cutoff:</strong> Default cutoff on Day 28th of every month for timesheet reporting.
              <span className="mx-2 hidden sm:inline">|</span>
              • <strong>Admin Grace Window:</strong> Managers can unlock &amp; correct job logs until Day 5th of next month before final corporate freeze.
            </p>
          </div>
        </div>
      </div>

      {/* 📊 3 SUMMARY STATCARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-2xs">
          <span className="text-xs font-bold text-slate-500">Your Owned Projects</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{kpis.total}</span>
            <span className="text-xs font-semibold text-slate-400">managed jobs</span>
          </div>
        </div>

        <div className="p-4 bg-rose-50/50 border border-rose-200/80 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800">Locked Projects (Frozen)</span>
            <Lock className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-rose-900">{kpis.lockedCount}</span>
            <span className="text-xs font-semibold text-rose-700">frozen for payroll</span>
          </div>
        </div>

        <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">Open for Submissions</span>
            <Unlock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-900">{kpis.unlockedCount}</span>
            <span className="text-xs font-semibold text-emerald-700">active reporting</span>
          </div>
        </div>
      </div>

      {/* 🔍 FILTER & SEARCH TOOLBAR */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {/* Lọc Status */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition',
                selectedStatus === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'hover:text-slate-900'
              )}
            >
              All ({jobRows.length})
            </button>
            <button
              onClick={() => setSelectedStatus('LOCKED')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition',
                selectedStatus === 'LOCKED'
                  ? 'bg-white text-rose-700 shadow-2xs font-extrabold'
                  : 'hover:text-rose-700'
              )}
            >
              Locked ({kpis.lockedCount})
            </button>
            <button
              onClick={() => setSelectedStatus('UNLOCKED')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition',
                selectedStatus === 'UNLOCKED'
                  ? 'bg-white text-emerald-700 shadow-2xs font-extrabold'
                  : 'hover:text-emerald-700'
              )}
            >
              Unlocked ({kpis.unlockedCount})
            </button>
          </div>
        </div>

        {/* Ô Tìm Kiếm */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by job code, name, reason..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* 📋 BẢNG DANH SÁCH 100% CÁC JOBS CỦA MANAGER */}
      <DataTable
        columns={columns}
        data={filteredJobRows}
        isLoading={jobsLoading || locksLoading}
        emptyMessage="No managed projects found matching your filter."
      />

      {/* ============================================================
          MODAL: MỞ KHÓA KỲ CÔNG (UNLOCK - KÈM NÚT SUBMIT RÕ RÀNG)
         ============================================================ */}
      <BaseModal
        isOpen={Boolean(unlockTarget)}
        onClose={() => setUnlockTarget(null)}
        title="Unlock Time Period"
        description="Audit reason is required for security and compliance tracking."
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setUnlockTarget(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUnlockSubmit}
              disabled={unlockMutation.isPending || createLockMutation.isPending}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50 transition"
            >
              {unlockMutation.isPending || createLockMutation.isPending ? 'Unlocking...' : 'Confirm Unlock'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleUnlockSubmit} className="space-y-4">
          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
            <p>
              Project: <strong>{unlockTarget?.job_code} — {unlockTarget?.job_name}</strong>
            </p>
            <p>
              Period: <strong>Month {String(unlockTarget?.lock_month).padStart(2, '0')} / {unlockTarget?.lock_year}</strong>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Unlock Reason (Required for Audit Log) *
            </label>
            <textarea
              rows={3}
              required
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="e.g. Unlocked per manager request for retroactive work log correction..."
              className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs border border-transparent focus:border-amber-400 focus:bg-white focus:outline-none"
              autoFocus
            />
          </div>
        </form>
      </BaseModal>
    </div>
  );
}
