import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';

import TimeLockHeroHeader from '../../components/manager/timelock/TimeLockHeroHeader';
import TimeLockPeriodBar from '../../components/manager/timelock/TimeLockPeriodBar';
import TimeLockStatCards from '../../components/manager/timelock/TimeLockStatCards';
import TimeLockFilterToolbar from '../../components/manager/timelock/TimeLockFilterToolbar';
import TimeLockTable from '../../components/manager/timelock/TimeLockTable';
import UnlockJobModal from '../../components/manager/timelock/UnlockJobModal';

import {
  useTimeLocks,
  useCreateTimeLock,
  useUnlockTimeLock,
} from '../../hooks/queries/manager/useManagerTimesheets';
import { useManagerJobs } from '../../hooks/queries/manager/useManagerJobs';
import managerTimesheetService from '../../services/manager/managerTimesheetService';

export default function ManagerTimeLockPage() {
  const navigate = useNavigate();

  // 🕒 SERVER-DRIVEN CLOCK & PERIOD OPTIONS
  const today = new Date();
  const serverMonth = today.getMonth() + 1; // 1 - 12
  const serverYear = today.getFullYear(); // e.g. 2026

  const periodOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      let m = serverMonth - i;
      let y = serverYear;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      const isCurrent = i === 0;
      options.push({
        value: `${y}-${m}`,
        year: y,
        month: m,
        label: `Month ${String(m).padStart(2, '0')} / ${y}${isCurrent ? ' (Current - In Progress)' : ' (Past Closed Period)'}`,
      });
    }
    return options;
  }, [serverMonth, serverYear]);

  // Mặc định chọn tháng vừa kết thúc
  const defaultPrevMonth = serverMonth === 1 ? 12 : serverMonth - 1;
  const defaultPrevYear = serverMonth === 1 ? serverYear - 1 : serverYear;

  const [activeMonth, setActiveMonth] = useState(defaultPrevMonth);
  const [activeYear, setActiveYear] = useState(defaultPrevYear);

  // Filters State
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'LOCKED' | 'UNLOCKED'
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [unlockTarget, setUnlockTarget] = useState(null);
  const [isBatchLocking, setIsBatchLocking] = useState(false);

  // 🚀 TANSTACK REACT QUERY HOOKS
  const {
    data: timeLocksResponse,
    isLoading: locksLoading,
    isFetching: locksFetching,
    refetch: refetchLocks,
  } = useTimeLocks({
    lock_month: activeMonth,
    lock_year: activeYear,
    page_size: 100,
  });

  const {
    data: jobsResponse,
    isLoading: jobsLoading,
    isFetching: jobsFetching,
    refetch: refetchJobs,
  } = useManagerJobs({ page_size: 100 });

  const createLockMutation = useCreateTimeLock();
  const unlockMutation = useUnlockTimeLock();

  const isFetching = locksFetching || jobsFetching || isBatchLocking;

  // Chuẩn hóa Danh sách Jobs
  const allJobs = useMemo(() => {
    if (Array.isArray(jobsResponse)) return jobsResponse;
    if (Array.isArray(jobsResponse?.results)) return jobsResponse.results;
    return [];
  }, [jobsResponse]);

  // Chuẩn hóa Danh sách TimeLocks từ Database
  const rawLocks = useMemo(() => {
    if (Array.isArray(timeLocksResponse)) return timeLocksResponse;
    if (Array.isArray(timeLocksResponse?.results)) return timeLocksResponse.results;
    return [];
  }, [timeLocksResponse]);

  // 🔒 KIỂM TRA BẢN GHI GLOBAL LOCK CỦA ADMIN
  const globalLockRecord = useMemo(() => {
    return rawLocks.find(
      (tl) =>
        tl.lock_scope === 'GLOBAL' &&
        Number(tl.lock_month) === Number(activeMonth) &&
        Number(tl.lock_year) === Number(activeYear) &&
        tl.is_locked === true
    );
  }, [rawLocks, activeMonth, activeYear]);

  const isGloballyLocked = Boolean(globalLockRecord);

  // Tính chất kỳ công
  const isPastPeriod = useMemo(() => {
    if (activeYear < serverYear) return true;
    if (activeYear === serverYear && activeMonth < serverMonth) return true;
    return false;
  }, [activeMonth, activeYear, serverMonth, serverYear]);

  const isCurrentPeriod = useMemo(() => {
    return activeYear === serverYear && activeMonth === serverMonth;
  }, [activeMonth, activeYear, serverMonth, serverYear]);

  // 🛡️ LỌC DỰ ÁN THEO VÒNG ĐỜI (PROJECT LIFECYCLE CHECK)
  // Chỉ những dự án đã khởi chạy vào hoặc trước khi kỳ công đó kết thúc mới thuộc kỳ công này.
  const activeJobsForPeriod = useMemo(() => {
    // Ngày cuối cùng của kỳ công (activeYear, activeMonth)
    const lastDayOfMonth = new Date(activeYear, activeMonth, 0);
    const lastDayStr = format(lastDayOfMonth, 'yyyy-MM-dd');

    return allJobs.filter((job) => {
      if (job.start_date) {
        const startStr = typeof job.start_date === 'string' ? job.start_date.slice(0, 10) : '';
        if (startStr && startStr > lastDayStr) {
          return false; // Dự án chưa bắt đầu trong kỳ công này (Job tương lai)
        }
      }
      return true;
    });
  }, [allJobs, activeMonth, activeYear]);

  // Ánh xạ Jobs thuộc kỳ công với Trạng thái Khóa
  const jobRows = useMemo(() => {
    return activeJobsForPeriod.map((job) => {
      const lockRecord = rawLocks.find(
        (tl) =>
          tl.lock_scope === 'JOB' &&
          (tl.job_id === job.id || tl.job?.id === job.id) &&
          Number(tl.lock_month) === Number(activeMonth) &&
          Number(tl.lock_year) === Number(activeYear)
      );

      let isLocked = false;
      let lockType = 'OPEN';

      if (isGloballyLocked) {
        isLocked = true;
        lockType = 'GLOBAL_LOCKED';
      } else if (lockRecord) {
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

      const activeLock = isGloballyLocked ? globalLockRecord : lockRecord;

      return {
        job_id: job.id,
        job_code: job.job_code || `JOB-${job.id}`,
        job_name: job.job_name,
        client_name: job.client?.client_name || job.client_name,
        job_status: job.status || 'ACTIVE',
        lock_month: activeMonth,
        lock_year: activeYear,
        is_locked: isLocked,
        lock_type: lockType,
        lock_record: lockRecord,
        global_lock_record: globalLockRecord,
        locked_by: activeLock?.locked_by,
        locked_at: activeLock?.locked_at || activeLock?.created_at,
        lock_reason: activeLock?.lock_reason || activeLock?.reason,
        unlocked_reason: lockRecord?.unlocked_reason || lockRecord?.unlock_reason,
      };
    });
  }, [activeJobsForPeriod, rawLocks, activeMonth, activeYear, isGloballyLocked, globalLockRecord]);

  // Lọc dữ liệu theo Bộ lọc Status & Từ khóa Search
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

  // KPI Chỉ số tổng hợp
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

  // 🔒 Khóa đơn lẻ 1 Job
  const handleDirectLock = async (targetRow) => {
    if (isGloballyLocked) {
      toast.error('Cannot modify lock status because this period is globally locked by Admin.');
      return;
    }

    if (isCurrentPeriod) {
      toast.warning('Current month is still active. You can only lock past completed periods.');
      return;
    }

    const monthStr = String(activeMonth).padStart(2, '0');
    try {
      await createLockMutation.mutateAsync({
        job_id: targetRow.job_id,
        lock_month: activeMonth,
        lock_year: activeYear,
        reason: `Monthly timesheet lock for Month ${monthStr}/${activeYear} by Manager`,
      });
      refetchLocks();
    } catch (err) {
      console.error('Failed to lock period', err);
    }
  };

  // ⚡ Batch Lock All Open Projects
  const handleBatchLockAll = async () => {
    if (isGloballyLocked) {
      toast.error('Period is already globally locked by Admin.');
      return;
    }

    if (isCurrentPeriod) {
      toast.warning('Current month is still active. You can only lock past completed periods.');
      return;
    }

    const openJobs = jobRows.filter((r) => !r.is_locked);
    if (openJobs.length === 0) {
      toast.info('All managed projects in this period are already locked!');
      return;
    }

    setIsBatchLocking(true);
    const toastId = toast.loading(`Freezing all ${openJobs.length} open project(s)...`);

    let successCount = 0;
    const failedJobs = [];

    for (const r of openJobs) {
      try {
        await managerTimesheetService.createTimeLock({
          job_id: r.job_id,
          lock_month: activeMonth,
          lock_year: activeYear,
          reason: `Batch monthly lock for Month ${String(activeMonth).padStart(2, '0')}/${activeYear}`,
        });
        successCount++;
      } catch (err) {
        failedJobs.push({ job_code: r.job_code, error: err });
      }
    }

    setIsBatchLocking(false);
    toast.dismiss(toastId);
    refetchLocks();

    if (successCount === openJobs.length) {
      toast.success(
        `Successfully locked all ${successCount} project(s) for Month ${String(activeMonth).padStart(2, '0')}/${activeYear}!`
      );
    } else if (successCount > 0) {
      toast.warning(
        `Locked ${successCount}/${openJobs.length} project(s). ${failedJobs.length} project(s) skipped (e.g. unreviewed work logs).`
      );
    } else {
      toast.error(
        `Could not lock ${openJobs.length} project(s). Please approve or reject all pending work logs before locking.`
      );
    }
  };

  // 🔓 Mở khóa với lý do audit
  const handleConfirmUnlock = async (reason) => {
    if (!unlockTarget) return;

    try {
      let lockId = unlockTarget.lock_record?.id;
      if (!lockId) {
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
        reason: reason.trim(),
      });

      setUnlockTarget(null);
      refetchLocks();
    } catch (err) {
      console.error('Failed to unlock period', err);
    }
  };

  const handleRefresh = () => {
    refetchLocks();
    refetchJobs();
    toast.success('Period locks refreshed!');
  };

  return (
    <div className="space-y-6 text-slate-800 pb-12 antialiased">
      {/* 🌟 Hero Header */}
      <TimeLockHeroHeader
        serverMonth={serverMonth}
        serverYear={serverYear}
        activeMonth={activeMonth}
        onRefresh={handleRefresh}
        isFetching={isFetching}
        isGloballyLocked={isGloballyLocked}
      />

      {/* 📅 Period Switcher Bar */}
      <TimeLockPeriodBar
        periodOptions={periodOptions}
        activeYear={activeYear}
        activeMonth={activeMonth}
        onPeriodChange={(y, m) => {
          setActiveYear(y);
          setActiveMonth(m);
        }}
        isCurrentPeriod={isCurrentPeriod}
        isPastPeriod={isPastPeriod}
        globalLockRecord={globalLockRecord}
      />

      {/* 📊 3 Summary StatCards */}
      <TimeLockStatCards kpis={kpis} />

      {/* 🔍 Filter Toolbar */}
      <TimeLockFilterToolbar
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        totalCount={jobRows.length}
        lockedCount={kpis.lockedCount}
        unlockedCount={kpis.unlockedCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* 📋 Bảng Danh Sách TimeLocks */}
      <TimeLockTable
        jobRows={filteredJobRows}
        isLoading={jobsLoading || locksLoading}
        isCurrentPeriod={isCurrentPeriod}
        isGloballyLocked={isGloballyLocked}
        onOpenUnlockModal={setUnlockTarget}
        onDirectLock={handleDirectLock}
        isLocking={createLockMutation.isPending}
        onNavigateTimesheet={(jobId) =>
          navigate(`/manager/timesheet?job_id=${jobId}&status=PENDING`)
        }
      />

      {/* 🔓 Modal Mở Khóa */}
      <UnlockJobModal
        isOpen={Boolean(unlockTarget)}
        onClose={() => setUnlockTarget(null)}
        target={unlockTarget}
        onConfirm={handleConfirmUnlock}
        isPending={unlockMutation.isPending || createLockMutation.isPending}
      />
    </div>
  );
}
