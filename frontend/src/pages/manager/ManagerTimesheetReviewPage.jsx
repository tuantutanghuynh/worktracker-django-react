import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import TimesheetReviewHeader from '../../components/manager/timesheet-review/TimesheetReviewHeader';
import TimesheetMasterTable from '../../components/manager/timesheet-review/TimesheetMasterTable';
import TimesheetDetailPane from '../../components/manager/timesheet-review/TimesheetDetailPane';
import {
  TimesheetRejectModal,
  TimesheetCorrectModal,
} from '../../components/manager/timesheet-review/TimesheetModals';

import managerTimesheetService from '../../services/manager/managerTimesheetService';
import {
  useLogWorks,
  useApproveLogWork,
  useRejectLogWork,
  useCorrectLogWork,
  useTimeLocks,
  managerTimesheetKeys,
} from '../../hooks/queries/manager/useManagerTimesheets';
import { useManagerJobs } from '../../hooks/queries/manager/useManagerJobs';

export default function ManagerTimesheetReviewPage() {
  const [searchParams] = useSearchParams();

  // Filter States (Initialized from URL query params for deep-linking)
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'PENDING');
  const [selectedJobId, setSelectedJobId] = useState(searchParams.get('job_id') || '');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  // Sync state when URL params change
  useEffect(() => {
    const urlJob = searchParams.get('job_id');
    const urlStatus = searchParams.get('status');
    const urlSearch = searchParams.get('search');

    if (urlJob !== null && urlJob !== undefined) setSelectedJobId(urlJob);
    if (urlStatus !== null && urlStatus !== undefined) setSelectedStatus(urlStatus);
    if (urlSearch !== null && urlSearch !== undefined) setSearchQuery(urlSearch);
  }, [searchParams]);

  // Selection State: Grouped Day Key (${userId}_${work_date})
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  // Modal States
  const [activeTargetLogWork, setActiveTargetLogWork] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [correctModalOpen, setCorrectModalOpen] = useState(false);

  const [isApprovingAll, setIsApprovingAll] = useState(false);

  // 🚀 QUERY HOOKS
  const queryParams = useMemo(() => {
    const params = { page_size: 200 };
    if (selectedJobId) params.job_id = selectedJobId;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    return params;
  }, [selectedJobId, searchQuery]);

  const { data: logWorkData, isLoading, refetch } = useLogWorks(queryParams);
  const { data: jobsResponse } = useManagerJobs({ page_size: 100 });
  const { data: timeLocksResponse } = useTimeLocks({ page_size: 100 });

  const queryClient = useQueryClient();
  const approveMutation = useApproveLogWork();
  const rejectMutation = useRejectLogWork();
  const correctMutation = useCorrectLogWork();

  // Normalize Raw LogWork list
  const logWorks = useMemo(() => {
    if (!logWorkData) return [];
    if (Array.isArray(logWorkData)) return logWorkData;
    if (Array.isArray(logWorkData.results)) return logWorkData.results;
    return [];
  }, [logWorkData]);

  // Normalize Raw TimeLocks
  const rawLocks = useMemo(() => {
    if (!timeLocksResponse) return [];
    if (Array.isArray(timeLocksResponse)) return timeLocksResponse;
    if (Array.isArray(timeLocksResponse.results)) return timeLocksResponse.results;
    return [];
  }, [timeLocksResponse]);

  // Jobs options for filter
  const jobOptions = useMemo(() => {
    const list = Array.isArray(jobsResponse) ? jobsResponse : jobsResponse?.results || [];
    return [
      { value: '', label: 'All Projects (Jobs)' },
      ...list.map((j) => ({
        value: String(j.id),
        label: `${j.job_code || `JOB-${j.id}`}: ${j.job_name || j.name || j.title}`,
      })),
    ];
  }, [jobsResponse]);

  // Helper getters
  const getEmployeeName = (lw) => {
    if (!lw) return 'Employee';
    return lw.user?.full_name || lw.user?.employee_profile?.full_name || lw.user_name || lw.employee_name || lw.user?.email || 'Employee';
  };

  const getJobTitle = (lw) => {
    if (!lw) return 'Associated Job';
    return lw.task?.job?.job_name || lw.task?.job?.name || lw.job_name || lw.job_title || 'Project Job';
  };

  const getJobCode = (lw) => {
    if (!lw) return '';
    return lw.task?.job?.job_code || (lw.task?.job?.id ? `JOB-${lw.task?.job?.id}` : '');
  };

  const getUserId = (lw) => {
    if (!lw) return null;
    return lw.user?.id || lw.user_id || (typeof lw.user === 'number' ? lw.user : null);
  };

  // 🌟 GROUP ALL LOGWORKS BY (EMPLOYEE + WORK DATE) -> 1 ROW = 1 WORKDAY
  const allGroupedDays = useMemo(() => {
    const groups = {};

    logWorks.forEach((lw) => {
      const userId = getUserId(lw);
      const workDate = lw.work_date;
      if (!userId || !workDate) return;

      const key = `${userId}_${workDate}`;
      if (!groups[key]) {
        const empName = getEmployeeName(lw);
        groups[key] = {
          key,
          userId,
          user: lw.user,
          employeeName: empName,
          work_date: workDate,
          total_hours: 0,
          items: [],
          uniqueJobs: new Map(),
          hasPending: false,
          hasRejected: false,
          allApproved: false,
          hasApproved: false,
        };
      }

      const status = (lw.review_status || lw.status || 'PENDING').toUpperCase();
      const hours = parseFloat(lw.hours_spent || 0);

      // Bỏ qua giờ của bản ghi đã bị hủy (VOIDED)
      if (status !== 'VOIDED') {
        groups[key].total_hours += hours;
      }
      groups[key].items.push(lw);

      const jobTitle = getJobTitle(lw);
      const jobCode = getJobCode(lw);
      if (jobTitle) {
        groups[key].uniqueJobs.set(jobTitle, jobCode);
      }
    });

    // Đánh giá trạng thái ngày công dựa trên các bản ghi HOẠT ĐỘNG (không bị VOIDED)
    Object.values(groups).forEach((group) => {
      const activeItems = group.items.filter(
        (item) => (item.review_status || item.status || 'PENDING').toUpperCase() !== 'VOIDED'
      );

      if (activeItems.length === 0) {
        group.hasPending = false;
        group.hasRejected = false;
        group.allApproved = false;
        group.hasApproved = false;
        return;
      }

      group.hasPending = activeItems.some(
        (item) => (item.review_status || item.status || 'PENDING').toUpperCase() === 'PENDING'
      );
      group.hasRejected = activeItems.some(
        (item) => (item.review_status || item.status || 'PENDING').toUpperCase() === 'REJECTED'
      );
      group.hasApproved = activeItems.some(
        (item) => (item.review_status || item.status || 'PENDING').toUpperCase() === 'APPROVED'
      );
      group.allApproved = activeItems.every(
        (item) => (item.review_status || item.status || 'PENDING').toUpperCase() === 'APPROVED'
      );
    });

    return Object.values(groups).sort((a, b) => new Date(b.work_date) - new Date(a.work_date));
  }, [logWorks]);

  // Filter grouped days by selectedStatus tab
  const filteredDays = useMemo(() => {
    return allGroupedDays.filter((dayGroup) => {
      if (selectedStatus === 'PENDING') return dayGroup.hasPending;
      if (selectedStatus === 'APPROVED') return dayGroup.allApproved;
      if (selectedStatus === 'REJECTED') return dayGroup.hasRejected;
      return true; // "ALL"
    });
  }, [allGroupedDays, selectedStatus]);

  // Auto-select first day group or maintain selection
  useEffect(() => {
    if (filteredDays.length > 0) {
      const exists = filteredDays.some((item) => item.key === selectedDayKey);
      if (!selectedDayKey || !exists) {
        setSelectedDayKey(filteredDays[0].key);
      }
    } else {
      setSelectedDayKey(null);
    }
  }, [filteredDays, selectedDayKey]);

  // Active Selected Day Group
  const selectedDayGroup = useMemo(() => {
    if (!selectedDayKey) return null;
    return allGroupedDays.find((item) => item.key === selectedDayKey) || null;
  }, [allGroupedDays, selectedDayKey]);

  // 🔒 KIỂM TRA XEM NGÀY CÔNG ĐANG CHỌN CÓ THUỘC KỲ BỊ KHÓA KHÔNG
  const selectedPeriodLock = useMemo(() => {
    if (!selectedDayGroup?.work_date) return null;
    const parts = selectedDayGroup.work_date.split('-');
    if (parts.length < 2) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);

    // 1. Kiểm tra Global lock của Admin
    const globalLock = rawLocks.find(
      (tl) =>
        tl.lock_scope === 'GLOBAL' &&
        Number(tl.lock_month) === m &&
        Number(tl.lock_year) === y &&
        tl.is_locked === true
    );
    if (globalLock) {
      return {
        isLocked: true,
        type: 'GLOBAL',
        reason: globalLock.lock_reason || 'Locked company-wide by Admin',
      };
    }

    return null;
  }, [selectedDayGroup, rawLocks]);

  // Auto-advance helper after reviewing
  const autoAdvanceToNextDay = (currentKey) => {
    const remaining = filteredDays.filter((g) => g.key !== currentKey);
    if (remaining.length > 0) {
      setSelectedDayKey(remaining[0].key);
    } else {
      setSelectedDayKey(null);
    }
  };

  // 🚀 ACTION HANDLERS
  const handleApproveSingle = (logWork) => {
    if (!logWork) return;
    if (selectedPeriodLock?.isLocked) {
      toast.error('Cannot approve: This period is locked for payroll freeze.');
      return;
    }

    approveMutation.mutate(
      { id: logWork.id, note: 'Approved by manager' },
      {
        onSuccess: () => {
          refetch();
        },
      }
    );
  };

  const handleApproveAllInDay = async () => {
    if (!selectedDayGroup) return;
    if (selectedPeriodLock?.isLocked) {
      toast.error('Cannot approve: This period is locked for payroll freeze.');
      return;
    }

    const pendingItems = selectedDayGroup.items.filter(
      (item) => (item.review_status || item.status || 'PENDING').toUpperCase() === 'PENDING'
    );

    if (pendingItems.length === 0) {
      toast.info('All tasks for this day are already approved.');
      return;
    }

    setIsApprovingAll(true);
    let successCount = 0;
    try {
      for (const item of pendingItems) {
        await managerTimesheetService.approveLogWork(item.id, 'Approved full day by manager');
        successCount++;
      }
      queryClient.invalidateQueries({ queryKey: managerTimesheetKeys.all });
      toast.success(
        `Approved all ${pendingItems.length} task${pendingItems.length > 1 ? 's' : ''} for ${selectedDayGroup.employeeName}`
      );
      refetch();
      autoAdvanceToNextDay(selectedDayGroup.key);
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: managerTimesheetKeys.all });
      if (successCount > 0) {
        toast.warning(`Approved ${successCount}/${pendingItems.length} tasks. Some failed.`);
        refetch();
      } else {
        toast.error('Failed to approve tasks. Period might be locked.');
      }
    } finally {
      setIsApprovingAll(false);
    }
  };

  const handleOpenRejectModal = (logWork) => {
    if (selectedPeriodLock?.isLocked) {
      toast.error('Cannot reject: This period is locked for payroll freeze.');
      return;
    }
    setActiveTargetLogWork(logWork);
    setRejectModalOpen(true);
  };

  const handleOpenCorrectModal = (logWork) => {
    if (selectedPeriodLock?.isLocked) {
      toast.error('Cannot adjust: This period is locked for payroll freeze.');
      return;
    }
    setActiveTargetLogWork(logWork);
    setCorrectModalOpen(true);
  };

  const handleConfirmReject = (reason) => {
    if (!activeTargetLogWork) return;
    rejectMutation.mutate(
      { id: activeTargetLogWork.id, reason: reason.trim() },
      {
        onSuccess: () => {
          setRejectModalOpen(false);
          setActiveTargetLogWork(null);
          refetch();
        },
      }
    );
  };

  const handleConfirmCorrect = ({ hours, description, reason }) => {
    if (!activeTargetLogWork) return;

    const payload = {
      id: activeTargetLogWork.id,
      adjustment_reason: reason.trim(),
    };
    if (hours !== undefined && hours !== null && hours !== '') {
      payload.hours_spent = parseFloat(hours);
    }
    if (description !== undefined && description !== null) {
      payload.description = description.trim();
    }

    correctMutation.mutate(payload, {
      onSuccess: () => {
        setCorrectModalOpen(false);
        setActiveTargetLogWork(null);
        refetch();
      },
    });
  };

  // Metrics for header
  const totalPendingDays = useMemo(() => {
    return allGroupedDays.filter((g) => g.hasPending).length;
  }, [allGroupedDays]);

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col antialiased bg-slate-100 overflow-hidden rounded-2xl">
      {/* 🌟 Top Header Bar with Metrics */}
      <TimesheetReviewHeader
        totalPendingDays={totalPendingDays}
        onRefresh={() => refetch()}
      />

      {/* 📋 Main 2-Column Split-Pane Workspace */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3 bg-slate-100 min-h-0">
        {/* Left Column: Master Table / Queue of Grouped Workdays (48% width) */}
        <TimesheetMasterTable
          filteredDays={filteredDays}
          selectedDayKey={selectedDayKey}
          onSelectDay={setSelectedDayKey}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedJobId={selectedJobId}
          onJobChange={setSelectedJobId}
          jobOptions={jobOptions}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
        />

        {/* Right Column: Detailed Breakdown of Selected Workday (52% width) */}
        <TimesheetDetailPane
          selectedDayGroup={selectedDayGroup}
          onApproveSingle={handleApproveSingle}
          onApproveAllInDay={handleApproveAllInDay}
          isApprovingAll={isApprovingAll}
          onOpenRejectModal={handleOpenRejectModal}
          onOpenCorrectModal={handleOpenCorrectModal}
          isCorrecting={correctMutation.isPending}
          isRejecting={rejectMutation.isPending}
          isApproving={approveMutation.isPending}
          isPeriodLocked={Boolean(selectedPeriodLock?.isLocked)}
          periodLockReason={selectedPeriodLock?.reason}
        />
      </main>

      {/* Modals */}
      <TimesheetRejectModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        targetLogWork={activeTargetLogWork}
        onConfirm={handleConfirmReject}
        isPending={rejectMutation.isPending}
      />

      <TimesheetCorrectModal
        isOpen={correctModalOpen}
        onClose={() => setCorrectModalOpen(false)}
        targetLogWork={activeTargetLogWork}
        onConfirm={handleConfirmCorrect}
        isPending={correctMutation.isPending}
      />
    </div>
  );
}
