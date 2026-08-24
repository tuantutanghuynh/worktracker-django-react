import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  Clock as ClockIcon,
  CheckCircle2 as CheckCircle2Icon,
  XCircle as XCircleIcon,
  Edit3 as Edit3Icon,
  Search as SearchIcon,
  RotateCcw as RotateCcwIcon,
  CheckCheck as CheckCheckIcon,
  FileText as FileTextIcon,
  Briefcase as BriefcaseIcon,
  Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";

import BaseModal from "../../components/common/modal/BaseModal";
import InputField from "../../components/common/forms/InputField";
import UserAvatar from "../../components/common/avatar/UserAvatar";
import { cn } from "../../utils/cn";

// Query Hooks
import {
  useLogWorks,
  useApproveLogWork,
  useRejectLogWork,
  useCorrectLogWork,
} from "../../hooks/queries/manager/useManagerTimesheets";
import { useManagerJobs } from "../../hooks/queries/manager/useManagerJobs";
import { useManagerEmployees } from "../../hooks/queries/manager/useManagerTeam";

function formatDateSafe(dateStr, pattern = "dd MMM yyyy") {
  if (!dateStr) return "N/A";
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

export default function ManagerTimesheetReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter States (Initialized from URL query params for deep-linking)
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get("status") || "PENDING");
  const [selectedJobId, setSelectedJobId] = useState(searchParams.get("job_id") || "");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(searchParams.get("user_id") || "");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");

  // Sync state when URL params change
  useEffect(() => {
    const urlJob = searchParams.get("job_id");
    const urlStatus = searchParams.get("status");
    const urlUser = searchParams.get("user_id");
    const urlSearch = searchParams.get("search");

    if (urlJob !== null && urlJob !== undefined) setSelectedJobId(urlJob);
    if (urlStatus !== null && urlStatus !== undefined) setSelectedStatus(urlStatus);
    if (urlUser !== null && urlUser !== undefined) setSelectedEmployeeId(urlUser);
    if (urlSearch !== null && urlSearch !== undefined) setSearchQuery(urlSearch);
  }, [searchParams]);
  
  // Selection State: Grouped Day Key (${userId}_${work_date})
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  // Modal States
  const [activeTargetLogWork, setActiveTargetLogWork] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [correctForm, setCorrectForm] = useState({
    hours_spent: "",
    description: "",
    adjustment_reason: "",
  });

  const [isApprovingAll, setIsApprovingAll] = useState(false);

  // 🚀 QUERY HOOKS (Fetch all records for manager scope so daily totals are always complete and stable)
  const queryParams = useMemo(() => {
    const params = { page_size: 200 };
    if (selectedJobId) params.job_id = selectedJobId;
    if (selectedEmployeeId) params.user_id = selectedEmployeeId;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    return params;
  }, [selectedJobId, selectedEmployeeId, searchQuery]);

  const { data: logWorkData, isLoading, refetch } = useLogWorks(queryParams);
  const { data: jobsResponse } = useManagerJobs({ page_size: 100 });
  const { data: employeesResponse } = useManagerEmployees({ page_size: 100 });

  // Mutations
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

  // Jobs options for filter
  const jobOptions = useMemo(() => {
    const list = Array.isArray(jobsResponse)
      ? jobsResponse
      : jobsResponse?.results || [];
    return [
      { value: "", label: "All Projects (Jobs)" },
      ...list.map((j) => ({
        value: String(j.id),
        label: `${j.job_code || `JOB-${j.id}`}: ${j.job_name || j.name || j.title}`,
      })),
    ];
  }, [jobsResponse]);

  // Helper getters for robust data extraction
  const getEmployeeName = (lw) => {
    if (!lw) return "Employee";
    return lw.user?.full_name || lw.user?.employee_profile?.full_name || lw.user_name || lw.employee_name || lw.user?.email || "Employee";
  };

  const getJobTitle = (lw) => {
    if (!lw) return "Associated Job";
    return lw.task?.job?.job_name || lw.task?.job?.name || lw.job_name || lw.job_title || "Project Job";
  };

  const getJobCode = (lw) => {
    if (!lw) return "";
    return lw.task?.job?.job_code || (lw.task?.job?.id ? `JOB-${lw.task?.job?.id}` : "");
  };

  const getTaskTitle = (lw) => {
    if (!lw) return "Associated Task";
    return lw.task?.title || lw.task_title || `Task #${lw.task?.id || lw.task_id || lw.id}`;
  };

  const getUserId = (lw) => {
    if (!lw) return null;
    return lw.user?.id || lw.user_id || (typeof lw.user === "number" ? lw.user : null);
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
          allApproved: true,
        };
      }

      const hours = parseFloat(lw.hours_spent || 0);
      groups[key].total_hours += hours;
      groups[key].items.push(lw);

      const jobTitle = getJobTitle(lw);
      const jobCode = getJobCode(lw);
      if (jobTitle) {
        groups[key].uniqueJobs.set(jobTitle, jobCode);
      }

      const status = (lw.review_status || lw.status || "PENDING").toUpperCase();
      if (status === "PENDING") groups[key].hasPending = true;
      if (status === "REJECTED") groups[key].hasRejected = true;
      if (status !== "APPROVED") groups[key].allApproved = false;
    });

    return Object.values(groups).sort((a, b) => new Date(b.work_date) - new Date(a.work_date));
  }, [logWorks]);

  // Filter grouped days by selectedStatus tab
  const filteredDays = useMemo(() => {
    return allGroupedDays.filter((dayGroup) => {
      if (selectedStatus === "PENDING") return dayGroup.hasPending;
      if (selectedStatus === "APPROVED") return dayGroup.allApproved;
      if (selectedStatus === "REJECTED") return dayGroup.hasRejected;
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
    approveMutation.mutate(
      { id: logWork.id, note: "Approved by manager" },
      {
        onSuccess: () => {
          refetch();
        },
      }
    );
  };

  const handleApproveAllInDay = async () => {
    if (!selectedDayGroup) return;
    const pendingItems = selectedDayGroup.items.filter(
      (item) => (item.review_status || item.status || "PENDING").toUpperCase() === "PENDING"
    );

    if (pendingItems.length === 0) {
      toast.info("All tasks for this day are already approved.");
      return;
    }

    setIsApprovingAll(true);
    try {
      for (const item of pendingItems) {
        await approveMutation.mutateAsync({ id: item.id, note: "Approved full day by manager" });
      }
      toast.success(`Approved all ${pendingItems.length} tasks for ${selectedDayGroup.employeeName} (${formatDateSafe(selectedDayGroup.work_date)})`);
      refetch();
      autoAdvanceToNextDay(selectedDayGroup.key);
    } catch (err) {
      toast.error("Failed to approve some tasks. Please try again.");
    } finally {
      setIsApprovingAll(false);
    }
  };

  const handleOpenRejectModal = (logWork) => {
    setActiveTargetLogWork(logWork);
    setRejectionReason("");
    setRejectModalOpen(true);
  };

  const handleConfirmReject = () => {
    if (!activeTargetLogWork) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    rejectMutation.mutate(
      { id: activeTargetLogWork.id, reason: rejectionReason.trim() },
      {
        onSuccess: () => {
          setRejectModalOpen(false);
          setActiveTargetLogWork(null);
          refetch();
        },
      }
    );
  };

  const handleOpenCorrectModal = (logWork) => {
    setActiveTargetLogWork(logWork);
    setCorrectForm({
      hours_spent: logWork.hours_spent || "",
      description: logWork.description || "",
      adjustment_reason: "",
    });
    setCorrectModalOpen(true);
  };

  const handleConfirmCorrect = () => {
    if (!activeTargetLogWork) return;
    if (!correctForm.hours_spent || parseFloat(correctForm.hours_spent) <= 0) {
      toast.error("Please enter a valid number of hours.");
      return;
    }
    if (!correctForm.adjustment_reason.trim()) {
      toast.error("Please provide an adjustment reason.");
      return;
    }

    correctMutation.mutate(
      {
        id: activeTargetLogWork.id,
        data: {
          hours_spent: parseFloat(correctForm.hours_spent),
          description: correctForm.description,
          adjustment_reason: correctForm.adjustment_reason.trim(),
        },
      },
      {
        onSuccess: () => {
          setCorrectModalOpen(false);
          setActiveTargetLogWork(null);
          refetch();
        },
      }
    );
  };

  const totalPendingDays = useMemo(() => {
    return allGroupedDays.filter((g) => g.hasPending).length;
  }, [allGroupedDays]);

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col antialiased bg-slate-100 overflow-hidden rounded-2xl">
      
      {/* =========================================================================
           TOP APP BAR HEADER (SLIM & CRISP ~44px)
           ========================================================================= */}
      <header className="bg-white border-b border-slate-200 px-5 py-2.5 flex items-center justify-between shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-2.5">
          <h1 className="text-base font-extrabold text-slate-900">Timesheet Approvals & LogWork Review</h1>
          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-[10px] font-bold border border-blue-200">
            DAILY COCKPIT
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs flex items-center gap-2 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>{totalPendingDays} Daily Timesheets Pending</span>
          </div>

          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            title="Refresh Data"
          >
            <RotateCcwIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* =========================================================================
           MAIN 2-COLUMN SPLIT-PANE WORKSPACE (FIT 100% CLEANLY IN VIEWPORT)
           ========================================================================= */}
      {filteredDays.length === 0 && !isLoading ? (
        /* 🌟 ALL CAUGHT UP EMPTY STATE VIEW */
        <div className="flex-1 p-6 bg-slate-100 flex items-center justify-center">
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3.5 shadow-2xs max-w-md mx-auto">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border-2 border-emerald-100 shadow-sm">
              <CheckCheckIcon className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                ZERO PENDING QUEUE
              </span>
              <h2 className="text-lg font-extrabold text-slate-900">You're All Caught Up!</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                There are no pending timesheets requiring your approval under the selected filter.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedStatus("ALL")}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                View All Timesheets
              </button>
            </div>
          </div>
        </div>
      ) : (
        <main className="flex-1 flex overflow-hidden p-3 gap-3 bg-slate-100 min-h-0">
          
          {/* =========================================================================
               LEFT COLUMN (GROUPED MASTER TABLE): 48% WIDTH - 4 CLEAN SPACIOUS COLUMNS
               ========================================================================= */}
          <section className="w-[48%] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0">
            
            {/* Filter Toolbar */}
            <div className="p-3 border-b border-slate-200 bg-white space-y-2 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <div className="relative flex-1">
                  <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search employee, task, or project..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 max-w-[150px] truncate"
                >
                  {jobOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                >
                  <option value="PENDING">Pending Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="ALL">All Statuses</option>
                </select>
              </div>
            </div>

            {/* MASTER TABLE: 4 CLEAN COLUMNS (EMPLOYEE, WORK DATE, HOURS, STATUS) */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0">
              {isLoading ? (
                <div className="flex h-full items-center justify-center p-8">
                  <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <table className="w-full text-left text-sm table-fixed">
                  <thead className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                    <tr>
                      <th className="py-2.5 px-3.5 w-[38%]">EMPLOYEE</th>
                      <th className="py-2.5 px-3 w-[26%]">WORK DATE</th>
                      <th className="py-2.5 px-2 w-[18%] text-center">TOTAL HOURS</th>
                      <th className="py-2.5 px-3 w-[18%] text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredDays.map((dayGroup) => {
                      const isSelected = dayGroup.key === selectedDayKey;
                      const overallStatus = dayGroup.hasPending
                        ? "PENDING"
                        : dayGroup.hasRejected
                        ? "REJECTED"
                        : "APPROVED";

                      return (
                        <tr
                          key={dayGroup.key}
                          onClick={() => setSelectedDayKey(dayGroup.key)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isSelected
                              ? "bg-blue-50/90 border-l-4 border-blue-600 hover:bg-blue-50"
                              : "hover:bg-slate-50 border-l-4 border-transparent"
                          )}
                        >
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UserAvatar
                                avatarUrl={dayGroup.user?.avatar_url || dayGroup.user?.employee_profile?.avatar_url}
                                fullName={dayGroup.employeeName}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="font-extrabold text-slate-900 text-sm truncate">{dayGroup.employeeName}</p>
                                <p className="text-[11px] text-slate-500 truncate font-medium">
                                  {dayGroup.items.length} Task{dayGroup.items.length !== 1 ? "s" : ""} Logged
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-800 text-xs whitespace-nowrap">
                            {formatDateSafe(dayGroup.work_date)}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 font-mono font-extrabold text-xs shadow-2xs">
                              {dayGroup.total_hours.toFixed(1)} hrs
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={cn(
                                "inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase whitespace-nowrap",
                                overallStatus === "APPROVED"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : overallStatus === "REJECTED"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              )}
                            >
                              {overallStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Table Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
              <span>Showing {filteredDays.length} daily timesheet records</span>
              <span className="font-semibold text-slate-700">Click any row to inspect</span>
            </div>
          </section>

          {/* =========================================================================
               RIGHT COLUMN (DETAIL INSPECTION PANE): 52% WIDTH
               ========================================================================= */}
          <section className="w-[52%] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0">
            {selectedDayGroup ? (
              <>
                {/* Right Pane Header */}
                <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between shrink-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono text-[10px] font-extrabold border border-blue-200">
                        DAILY TIMESHEET
                      </span>
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                        <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                        {formatDateSafe(selectedDayGroup.work_date, "EEEE, dd MMMM yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        avatarUrl={selectedDayGroup.user?.avatar_url || selectedDayGroup.user?.employee_profile?.avatar_url}
                        fullName={selectedDayGroup.employeeName}
                        size="xs"
                      />
                      <h2 className="text-sm font-extrabold text-slate-900">{selectedDayGroup.employeeName}</h2>
                    </div>
                  </div>

                  {/* ⏱️ TOTAL LOGGED (CỐ ĐỊNH TỔNG GIỜ CỦA NGÀY HÔM ĐÓ, KHÔNG GIẢM KHI DUYỆT TỪNG CÁI) */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-2 rounded-xl shadow-xs text-right shrink-0">
                    <p className="text-[9px] text-blue-100 font-bold uppercase tracking-wider">Total Logged</p>
                    <p className="text-base font-extrabold font-mono leading-tight">
                      {selectedDayGroup.total_hours.toFixed(1)}{" "}
                      <span className="text-xs font-sans font-normal text-blue-200">hrs</span>
                    </p>
                  </div>
                </div>

                {/* Right Pane Scrollable Body: LIST OF TASKS WITH CLEAR JOB NAMES */}
                <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar text-xs text-slate-700 min-h-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">
                      Task Breakdown for this Day
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Review individual tasks or approve all
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedDayGroup.items.map((lw) => {
                      const logStatus = (lw.review_status || lw.status || "PENDING").toUpperCase();
                      const jobName = getJobTitle(lw);
                      const jobCode = getJobCode(lw);
                      const taskTitle = getTaskTitle(lw);
                      const hours = parseFloat(lw.hours_spent || 0).toFixed(1);

                      return (
                        <div
                          key={lw.id}
                          className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition shadow-2xs space-y-2.5"
                        >
                          {/* Job Banner with large clear font */}
                          <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-slate-100">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <BriefcaseIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="font-extrabold text-blue-900 text-xs truncate">
                                {jobName}
                              </span>
                              {jobCode && (
                                <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                                  {jobCode}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="inline-block font-mono font-extrabold text-xs px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                                {hours} hrs
                              </span>
                              <span
                                className={cn(
                                  "inline-block text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase",
                                  logStatus === "APPROVED"
                                    ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                                    : logStatus === "REJECTED"
                                    ? "text-rose-700 bg-rose-50 border border-rose-200"
                                    : "text-amber-700 bg-amber-50 border border-amber-200"
                                )}
                              >
                                {logStatus}
                              </span>
                            </div>
                          </div>

                          {/* Task Title */}
                          <h4 className="font-extrabold text-slate-900 text-sm truncate">{taskTitle}</h4>

                          {/* Work Description */}
                          <div className="p-2.5 rounded-lg bg-slate-50 text-slate-700 text-xs leading-relaxed border border-slate-100">
                            {lw.description ? (
                              `"${lw.description}"`
                            ) : (
                              <span className="text-slate-400 italic">No task description provided.</span>
                            )}
                          </div>

                          {/* Action Buttons for this specific LogWork */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                            <span className="text-[10px] text-slate-400 font-mono">
                              LogWork #{lw.id}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenCorrectModal(lw)}
                                disabled={correctMutation.isPending}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                                title="Adjust hours"
                              >
                                <Edit3Icon className="w-3 h-3 text-slate-500" />
                                <span>Adjust</span>
                              </button>

                              {logStatus === "PENDING" && (
                                <>
                                  <button
                                    onClick={() => handleOpenRejectModal(lw)}
                                    disabled={rejectMutation.isPending}
                                    className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                                    title="Reject log"
                                  >
                                    <XCircleIcon className="w-3 h-3 text-rose-500" />
                                    <span>Reject</span>
                                  </button>

                                  <button
                                    onClick={() => handleApproveSingle(lw)}
                                    disabled={approveMutation.isPending}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition shadow-2xs cursor-pointer disabled:opacity-50"
                                    title="Approve log"
                                  >
                                    <CheckCircle2Icon className="w-3 h-3" />
                                    <span>Approve</span>
                                  </button>
                                </>
                              )}

                              {logStatus === "APPROVED" && (
                                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 px-2 py-0.5">
                                  <CheckCircle2Icon className="w-3.5 h-3.5" />
                                  Approved
                                </span>
                              )}

                              {logStatus === "REJECTED" && (
                                <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1 px-2 py-0.5">
                                  <XCircleIcon className="w-3.5 h-3.5" />
                                  Rejected
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* =========================================================================
                     FIXED BOTTOM ACTION FOOTER: APPROVE ENTIRE DAY OR PROGRESS
                     ========================================================================= */}
                <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0 z-20">
                  <span className="text-xs text-slate-500 font-medium">
                    {selectedDayGroup.items.length} Task{selectedDayGroup.items.length !== 1 ? "s" : ""} on {formatDateSafe(selectedDayGroup.work_date, "dd MMM")}
                  </span>

                  {selectedDayGroup.hasPending ? (
                    <button
                      onClick={handleApproveAllInDay}
                      disabled={isApprovingAll}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2Icon className="w-4 h-4" />
                      <span>
                        {isApprovingAll ? "Approving All..." : `Approve Entire Day (${selectedDayGroup.total_hours.toFixed(1)} hrs) →`}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <CheckCircle2Icon className="w-4 h-4 text-emerald-600" />
                      <span>All Tasks Verified for this Day</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-xs">
                Select a daily timesheet entry on the left to inspect
              </div>
            )}
          </section>

        </main>
      )}

      {/* =========================================================================
           MODAL: REJECT LOGWORK WITH REASON
           ========================================================================= */}
      <BaseModal
        isOpen={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setActiveTargetLogWork(null);
        }}
        title={`Reject LogWork #${activeTargetLogWork?.id || ""}`}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setRejectModalOpen(false);
                setActiveTargetLogWork(null);
              }}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReject}
              disabled={rejectMutation.isPending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-600">
            Please provide a specific reason for rejecting this work log entry for <strong>{getTaskTitle(activeTargetLogWork)}</strong>.
          </p>
          <InputField
            label="Rejection Reason *"
            placeholder="e.g., Logged hours exceed task scope; please adjust description."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            multiline
            rows={3}
          />
        </div>
      </BaseModal>

      {/* =========================================================================
           MODAL: ADJUST / CORRECT LOGWORK HOURS
           ========================================================================= */}
      <BaseModal
        isOpen={correctModalOpen}
        onClose={() => {
          setCorrectModalOpen(false);
          setActiveTargetLogWork(null);
        }}
        title={`Adjust Hours for LogWork #${activeTargetLogWork?.id || ""}`}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setCorrectModalOpen(false);
                setActiveTargetLogWork(null);
              }}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmCorrect}
              disabled={correctMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition"
            >
              {correctMutation.isPending ? "Saving..." : "Save Adjustment"}
            </button>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs">
          <InputField
            label="Corrected Hours Spent *"
            type="number"
            step="0.25"
            min="0.1"
            max="8.0"
            value={correctForm.hours_spent}
            onChange={(e) => setCorrectForm({ ...correctForm, hours_spent: e.target.value })}
          />

          <InputField
            label="Work Description"
            value={correctForm.description}
            onChange={(e) => setCorrectForm({ ...correctForm, description: e.target.value })}
            multiline
            rows={2}
          />

          <InputField
            label="Adjustment Reason *"
            placeholder="e.g., Reduced hours to reflect actual verified task work."
            value={correctForm.adjustment_reason}
            onChange={(e) => setCorrectForm({ ...correctForm, adjustment_reason: e.target.value })}
            multiline
            rows={2}
          />
        </div>
      </BaseModal>

    </div>
  );
}
