import React, { useState, useMemo, useEffect } from "react";
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
  History as HistoryIcon,
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
  useVoidLogWork,
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
  // Filter States
  const [selectedStatus, setSelectedStatus] = useState("PENDING");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLogWorkId, setSelectedLogWorkId] = useState(null);

  // Modal States
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [correctForm, setCorrectForm] = useState({
    hours_spent: "",
    description: "",
    adjustment_reason: "",
  });

  // 🚀 QUERY HOOKS
  const queryParams = useMemo(() => {
    const params = { page_size: 50 };
    if (selectedStatus !== "ALL") params.review_status = selectedStatus;
    if (selectedJobId) params.job_id = selectedJobId;
    if (selectedEmployeeId) params.user_id = selectedEmployeeId;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    return params;
  }, [selectedStatus, selectedJobId, selectedEmployeeId, searchQuery]);

  const { data: logWorkData, isLoading, refetch } = useLogWorks(queryParams);
  const { data: jobsResponse } = useManagerJobs({ page_size: 100 });
  const { data: employeesResponse } = useManagerEmployees({ page_size: 100 });

  // Mutations
  const approveMutation = useApproveLogWork();
  const rejectMutation = useRejectLogWork();
  const correctMutation = useCorrectLogWork();

  // Normalize LogWork list
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

  // Auto-select first item in list or maintain selection
  useEffect(() => {
    if (logWorks.length > 0) {
      const exists = logWorks.some((item) => String(item.id) === String(selectedLogWorkId));
      if (!selectedLogWorkId || !exists) {
        setSelectedLogWorkId(logWorks[0].id);
      }
    } else {
      setSelectedLogWorkId(null);
    }
  }, [logWorks, selectedLogWorkId]);

  // Selected LogWork Active Object
  const selectedLogWork = useMemo(() => {
    if (!selectedLogWorkId) return null;
    return logWorks.find((item) => String(item.id) === String(selectedLogWorkId)) || null;
  }, [logWorks, selectedLogWorkId]);

  // Helper getters for robust data extraction
  const getEmployeeName = (lw) => {
    if (!lw) return "Employee";
    return lw.user?.full_name || lw.user_name || lw.employee_name || lw.user?.email || "Employee";
  };

  const getJobTitle = (lw) => {
    if (!lw) return "Associated Job";
    return lw.task?.job?.job_name || lw.task?.job?.name || lw.job_name || lw.job_title || "Project Job";
  };

  const getTaskTitle = (lw) => {
    if (!lw) return "Associated Task";
    return lw.task?.title || lw.task_title || `Task #${lw.task?.id || lw.task_id || lw.id}`;
  };

  const getTaskId = (lw) => {
    if (!lw) return null;
    return lw.task?.id || lw.task_id || (typeof lw.task === "number" ? lw.task : null);
  };

  const getUserId = (lw) => {
    if (!lw) return null;
    return lw.user?.id || lw.user_id || (typeof lw.user === "number" ? lw.user : null);
  };

  // Related Daily Work Logs for ONLY the same task & employee
  const taskHistoryLogs = useMemo(() => {
    if (!selectedLogWork) return [];
    const activeTaskId = getTaskId(selectedLogWork);
    const activeUserId = getUserId(selectedLogWork);

    if (!activeTaskId || !activeUserId) return [selectedLogWork];

    const matched = logWorks.filter((lw) => {
      const lwTaskId = getTaskId(lw);
      const lwUserId = getUserId(lw);
      return String(lwTaskId) === String(activeTaskId) && String(lwUserId) === String(activeUserId);
    });

    return matched.length > 0 ? matched : [selectedLogWork];
  }, [logWorks, selectedLogWork]);

  const totalEffortOnTask = useMemo(() => {
    if (!taskHistoryLogs || taskHistoryLogs.length === 0) {
      return parseFloat(selectedLogWork?.hours_spent || 0);
    }
    return taskHistoryLogs.reduce((acc, cur) => acc + (parseFloat(cur.hours_spent) || 0), 0);
  }, [taskHistoryLogs, selectedLogWork]);

  // ⚡ AUTO-ADVANCE HELPER
  const autoAdvanceToNext = (processedId) => {
    const remaining = logWorks.filter((item) => String(item.id) !== String(processedId));
    if (remaining.length > 0) {
      setSelectedLogWorkId(remaining[0].id);
    } else {
      setSelectedLogWorkId(null);
    }
  };

  // 🚀 ACTION HANDLERS
  const handleApprove = (logWork) => {
    if (!logWork) return;
    approveMutation.mutate(
      { id: logWork.id, note: "Approved by manager" },
      {
        onSuccess: () => {
          autoAdvanceToNext(logWork.id);
        },
      }
    );
  };

  const handleOpenRejectModal = () => {
    if (!selectedLogWork) return;
    setRejectionReason("");
    setRejectModalOpen(true);
  };

  const handleConfirmReject = () => {
    if (!selectedLogWork) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    rejectMutation.mutate(
      { id: selectedLogWork.id, reason: rejectionReason.trim() },
      {
        onSuccess: () => {
          setRejectModalOpen(false);
          autoAdvanceToNext(selectedLogWork.id);
        },
      }
    );
  };

  const handleOpenCorrectModal = () => {
    if (!selectedLogWork) return;
    setCorrectForm({
      hours_spent: selectedLogWork.hours_spent || "",
      description: selectedLogWork.description || "",
      adjustment_reason: "",
    });
    setCorrectModalOpen(true);
  };

  const handleConfirmCorrect = () => {
    if (!selectedLogWork) return;
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
        id: selectedLogWork.id,
        data: {
          hours_spent: parseFloat(correctForm.hours_spent),
          description: correctForm.description,
          adjustment_reason: correctForm.adjustment_reason.trim(),
        },
      },
      {
        onSuccess: () => {
          setCorrectModalOpen(false);
          refetch();
        },
      }
    );
  };

  const pendingCount = useMemo(() => {
    return logWorks.filter((item) => (item.review_status || item.status) === "PENDING").length;
  }, [logWorks]);

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col antialiased bg-slate-100 overflow-hidden rounded-2xl">
      
      {/* =========================================================================
           TOP APP BAR HEADER
           ========================================================================= */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0 shadow-2xs z-20">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-[10px] font-bold border border-blue-200">
              TIMESHEET EFFORT COCKPIT
            </span>
          </div>
          <h1 className="text-lg font-extrabold text-slate-900 mt-0.5">Timesheet Approvals & LogWork Review</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs flex items-center gap-2 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>{pendingCount} Pending Verification</span>
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
      {logWorks.length === 0 && !isLoading ? (
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
                There are no pending timesheets or logwork entries requiring your approval right now.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedStatus("ALL")}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                View Historical Log Entries
              </button>
            </div>
          </div>
        </div>
      ) : (
        <main className="flex-1 flex overflow-hidden p-3 gap-3 bg-slate-100 min-h-0">
          
          {/* =========================================================================
               LEFT COLUMN (MASTER TABLE): 56% WIDTH - COMPACT & SNUG
               ========================================================================= */}
          <section className="w-[56%] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0">
            
            {/* Filter Toolbar */}
            <div className="p-3 border-b border-slate-200 bg-white space-y-2 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <div className="relative flex-1">
                  <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search employee, task, or description..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 max-w-[160px] truncate"
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

            {/* MASTER TABLE */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
              {isLoading ? (
                <div className="flex h-full items-center justify-center p-8">
                  <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <table className="w-full text-left text-sm table-fixed">
                  <thead className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                    <tr>
                      <th className="py-2.5 px-3 w-[26%]">EMPLOYEE</th>
                      <th className="py-2.5 px-2.5 w-[18%]">WORK DATE</th>
                      <th className="py-2.5 px-2.5 w-[36%]">TASK & PROJECT</th>
                      <th className="py-2.5 px-2 w-[10%] text-center">HOURS</th>
                      <th className="py-2.5 px-3 w-[10%] text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {logWorks.map((lw) => {
                      const isSelected = String(lw.id) === String(selectedLogWorkId);
                      const employeeName = getEmployeeName(lw);
                      const taskTitle = getTaskTitle(lw);
                      const jobCode = getJobTitle(lw);
                      const hours = parseFloat(lw.hours_spent || 0).toFixed(1);
                      const status = (lw.review_status || lw.status || "PENDING").toUpperCase();

                      return (
                        <tr
                          key={lw.id}
                          onClick={() => setSelectedLogWorkId(lw.id)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isSelected
                              ? "bg-blue-50/80 border-l-4 border-blue-600 hover:bg-blue-50"
                              : "hover:bg-slate-50 border-l-4 border-transparent"
                          )}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar
                                avatarUrl={lw.user?.avatar_url || lw.user_avatar || lw.avatar_url}
                                fullName={employeeName}
                                size="xs"
                              />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-xs truncate">{employeeName}</p>
                                <p className="text-[10px] text-slate-400 truncate">Staff</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 font-mono font-bold text-slate-700 text-xs whitespace-nowrap">
                            {formatDateSafe(lw.work_date)}
                          </td>
                          <td className="py-2.5 px-2.5 min-w-0">
                            <p className="font-bold text-slate-900 text-xs truncate">{taskTitle}</p>
                            <p className="text-[10px] text-slate-400 font-mono truncate">{jobCode}</p>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-mono font-extrabold text-xs">
                              {hours}h
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={cn(
                                "inline-block px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase whitespace-nowrap",
                                status === "APPROVED"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : status === "REJECTED"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              )}
                            >
                              {status}
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
              <span>Showing {logWorks.length} logwork records</span>
              <span className="font-semibold text-slate-700">Click any row to inspect</span>
            </div>
          </section>

          {/* =========================================================================
               RIGHT COLUMN (DETAIL INSPECTION PANE): 44% WIDTH
               ========================================================================= */}
          <section className="w-[44%] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0">
            {selectedLogWork ? (
              <>
                {/* Right Pane Header */}
                <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between shrink-0">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono text-[11px] font-extrabold border border-blue-200">
                        LOGWORK #{selectedLogWork.id}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border",
                          (selectedLogWork.review_status || selectedLogWork.status) === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : (selectedLogWork.review_status || selectedLogWork.status) === "REJECTED"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        )}
                      >
                        {selectedLogWork.review_status || selectedLogWork.status || "PENDING"}
                      </span>
                    </div>
                    <h2 className="text-sm font-extrabold text-slate-900">Work Log Verification Details</h2>
                    <p className="text-[11px] text-slate-500">Audit employee's claimed effort and daily work history</p>
                  </div>
                </div>

                {/* Right Pane Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar text-xs text-slate-700 min-h-0">
                  
                  {/* ⏱️ PROMINENT EFFORT HERO BANNER */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner shrink-0">
                        <ClockIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-blue-100 font-bold uppercase tracking-wider">Submitted Work Effort</p>
                        <p className="text-xl font-extrabold font-mono leading-tight mt-0.5">
                          {parseFloat(selectedLogWork.hours_spent || 0).toFixed(1)}{" "}
                          <span className="text-xs font-sans font-normal text-blue-200">hours</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right bg-white/10 px-2.5 py-1 rounded-xl border border-white/20 shrink-0">
                      <p className="text-[9px] text-blue-100 font-semibold">Work Date</p>
                      <p className="font-mono font-extrabold text-xs text-white mt-0.5">
                        {formatDateSafe(selectedLogWork.work_date)}
                      </p>
                    </div>
                  </div>

                  {/* 👤 EMPLOYEE & PROJECT CONTEXT CARD */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500">Logged By Employee:</span>
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          avatarUrl={selectedLogWork.user?.avatar_url || selectedLogWork.user_avatar || selectedLogWork.avatar_url}
                          fullName={getEmployeeName(selectedLogWork)}
                          size="xs"
                        />
                        <span className="font-extrabold text-slate-900 text-xs">
                          {getEmployeeName(selectedLogWork)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 shrink-0">Parent Project (Job):</span>
                      <span className="font-bold text-blue-700 font-mono text-xs text-right truncate max-w-[220px]">
                        {getJobTitle(selectedLogWork)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 shrink-0">Associated Task:</span>
                      <span className="font-extrabold text-slate-900 text-xs text-right truncate max-w-[220px]">
                        {getTaskTitle(selectedLogWork)}
                      </span>
                    </div>
                  </div>

                  {/* 📝 CURRENT WORK DESCRIPTION REPORT (MÔ TẢ CÔNG VIỆC TRONG NGÀY) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                        <FileTextIcon className="w-3.5 h-3.5 text-blue-600" />
                        <span>Work Description for this Day</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {selectedLogWork.created_at ? formatDateSafe(selectedLogWork.created_at, "HH:mm • dd/MM") : ""}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed text-xs font-normal">
                      {selectedLogWork.description ? (
                        `"${selectedLogWork.description}"`
                      ) : (
                        <span className="text-slate-400 italic">No daily description provided for this entry.</span>
                      )}
                    </div>
                  </div>

                  {/* 📅 DAILY LOGS HISTORY ON THIS SPECIFIC TASK */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                        <HistoryIcon className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Daily Log History on this Task</span>
                      </h3>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        Total: {totalEffortOnTask.toFixed(1)} hrs ({taskHistoryLogs.length} Day{taskHistoryLogs.length !== 1 ? "s" : ""})
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                      {taskHistoryLogs.map((hist) => {
                        const isCurrent = String(hist.id) === String(selectedLogWork.id);
                        const histStatus = (hist.review_status || hist.status || "PENDING").toUpperCase();
                        return (
                          <div
                            key={hist.id}
                            onClick={() => setSelectedLogWorkId(hist.id)}
                            className={cn(
                              "p-2 rounded-xl flex items-center justify-between gap-2 text-xs cursor-pointer transition",
                              isCurrent
                                ? "bg-blue-50 border border-blue-200"
                                : "bg-slate-50 border border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-slate-800 shrink-0">
                                {formatDateSafe(hist.work_date, "dd MMM")}
                              </span>
                              <span
                                className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0",
                                  histStatus === "APPROVED"
                                    ? "text-emerald-700 bg-emerald-100"
                                    : histStatus === "REJECTED"
                                    ? "text-rose-700 bg-rose-100"
                                    : "text-amber-700 bg-amber-100"
                                )}
                              >
                                {histStatus}
                              </span>
                              <span className="text-slate-500 truncate text-[11px]">
                                {hist.description || "Daily work log"}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "font-mono font-extrabold shrink-0",
                                isCurrent ? "text-blue-700" : "text-slate-700"
                              )}
                            >
                              {parseFloat(hist.hours_spent || 0).toFixed(1)}h
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* =========================================================================
                     FIXED BOTTOM ACTION FOOTER (ALWAYS 100% VISIBLE ON ANY LAPTOP SCREEN!)
                     ========================================================================= */}
                <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0 z-20">
                  <button
                    onClick={handleOpenRejectModal}
                    disabled={rejectMutation.isPending}
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <XCircleIcon className="w-3.5 h-3.5 text-rose-500" />
                    <span>Reject</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleOpenCorrectModal}
                      disabled={correctMutation.isPending}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <Edit3Icon className="w-3.5 h-3.5 text-slate-500" />
                      <span>Adjust</span>
                    </button>

                    <button
                      onClick={() => handleApprove(selectedLogWork)}
                      disabled={approveMutation.isPending}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2Icon className="w-3.5 h-3.5" />
                      <span>
                        {approveMutation.isPending ? "Approving..." : "Approve & Next →"}
                      </span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-xs">
                Select a work log entry on the left to inspect
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
        onClose={() => setRejectModalOpen(false)}
        title="Reject Work Log Entry"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setRejectModalOpen(false)}
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
            Please provide a specific reason for rejecting this work log entry. The employee will be notified to review and adjust their claimed hours.
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
        onClose={() => setCorrectModalOpen(false)}
        title="Adjust & Correct Logged Hours"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setCorrectModalOpen(false)}
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
            max="24"
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
