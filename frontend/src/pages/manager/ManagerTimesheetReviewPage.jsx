import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit3,
  Trash2,
  Filter,
  Search,
  RotateCcw,
  Calendar,
  Building2,
  Briefcase,
  Layers,
  User,
  CheckCheck,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  FileCheck,
  Ban,
  ArrowUpDown,
  Sparkles,
  Lock,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

import DataTable from "../../components/common/table/DataTable";
import BaseModal from "../../components/common/modal/BaseModal";
import InputField from "../../components/common/forms/InputField";
import SelectDropdown from "../../components/common/forms/SelectDropdown";
import TaskDetailDrawer from "../../components/manager/TaskDetailDrawer";
import { cn } from "../../utils/cn";

// Query Hooks & Stores
import { useLogWorks, useApproveLogWork, useRejectLogWork, useCorrectLogWork, useVoidLogWork } from "../../hooks/queries/manager/useManagerTimesheets";
import { useManagerJobs } from "../../hooks/queries/manager/useManagerJobs";
import { useManagerEmployees } from "../../hooks/queries/manager/useManagerTeam";
import { useUIStore } from "../../stores/useUIStore";

// Tabs trạng thái duyệt
const STATUS_TABS = [
  { id: "PENDING", label: "Pending Review", color: "bg-amber-500" },
  { id: "APPROVED", label: "Approved", color: "bg-emerald-500" },
  { id: "REJECTED", label: "Rejected", color: "bg-rose-500" },
  { id: "VOIDED", label: "Voided", color: "bg-slate-400" },
  { id: "ALL", label: "All Records", color: "bg-blue-500" },
];

function formatDateSafe(dateStr, pattern = "dd/MM/yyyy") {
  if (!dateStr) return "N/A";
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

export default function ManagerTimesheetReviewPage() {
  const navigate = useNavigate();
  const openTaskDrawer = useUIStore((state) => state.openTaskDrawer);

  // Filter States
  const [selectedStatusTab, setSelectedStatusTab] = useState("PENDING");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal States
  const [approveTarget, setApproveTarget] = useState(null);
  const [approveNote, setApproveNote] = useState("");

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [correctTarget, setCorrectTarget] = useState(null);
  const [correctForm, setCorrectForm] = useState({
    hours_spent: "",
    description: "",
    adjustment_reason: "",
  });

  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState("");

  // 🚀 QUERY HOOKS
  const queryParams = useMemo(() => {
    const params = {};
    if (selectedStatusTab !== "ALL") params.review_status = selectedStatusTab;
    if (selectedJobId) params.job_id = selectedJobId;
    if (selectedEmployeeId) params.user_id = selectedEmployeeId;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (currentPage > 1) params.page = currentPage;
    if (pageSize) params.page_size = pageSize;
    return params;
  }, [selectedStatusTab, selectedJobId, selectedEmployeeId, searchQuery, startDate, endDate, currentPage, pageSize]);

  const { data: logWorksResponse, isLoading: logWorksLoading, refetch, isFetching } = useLogWorks(queryParams);

  const { data: jobsResponse } = useManagerJobs();
  const { data: employeesResponse = [] } = useManagerEmployees();

  // Mutations
  const approveMutation = useApproveLogWork();
  const rejectMutation = useRejectLogWork();
  const correctMutation = useCorrectLogWork();
  const voidMutation = useVoidLogWork();

  // Chuẩn hóa dữ liệu LogWorks
  const logWorks = useMemo(() => {
    if (Array.isArray(logWorksResponse)) return logWorksResponse;
    if (logWorksResponse && Array.isArray(logWorksResponse.results)) {
      return logWorksResponse.results;
    }
    return [];
  }, [logWorksResponse]);

  const totalCount = useMemo(() => {
    if (logWorksResponse?.count !== undefined) return logWorksResponse.count;
    return logWorks.length;
  }, [logWorksResponse, logWorks]);

  // Chuẩn hóa Job options
  const jobOptions = useMemo(() => {
    const list = Array.isArray(jobsResponse) ? jobsResponse : jobsResponse?.results || [];
    return list.map((j) => ({
      value: String(j.id),
      label: `${j.job_code || `JOB-${j.id}`}: ${j.job_name}`,
    }));
  }, [jobsResponse]);

  // Chuẩn hóa Employee options
  const employeeOptions = useMemo(() => {
    const list = Array.isArray(employeesResponse) ? employeesResponse : employeesResponse?.results || [];
    return list.map((emp) => ({
      value: String(emp.user_id || emp.id),
      label: `${emp.full_name || emp.email} (${emp.department_name || "Staff"})`,
    }));
  }, [employeesResponse]);

  // KPI Metrics tính toán nhanh
  const kpis = useMemo(() => {
    let pendingHours = 0;
    let pendingCount = 0;
    let approvedHours = 0;
    let totalHours = 0;

    logWorks.forEach((lw) => {
      const hrs = parseFloat(lw.hours_spent) || 0;
      totalHours += hrs;
      if (lw.review_status === "PENDING") {
        pendingHours += hrs;
        pendingCount += 1;
      } else if (lw.review_status === "APPROVED") {
        approvedHours += hrs;
      }
    });

    return { pendingHours, pendingCount, approvedHours, totalHours };
  }, [logWorks]);

  // Handlers
  const handleClearFilters = () => {
    setSelectedJobId("");
    setSelectedEmployeeId("");
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const handleApproveSubmit = (e) => {
    e.preventDefault();
    if (!approveTarget) return;

    approveMutation.mutate(
      {
        id: approveTarget.id,
        note: approveNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          setApproveTarget(null);
          setApproveNote("");
        },
      },
    );
  };

  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (!rejectTarget) return;
    if (!rejectionReason.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }

    rejectMutation.mutate(
      {
        id: rejectTarget.id,
        reason: rejectionReason.trim(),
      },
      {
        onSuccess: () => {
          setRejectTarget(null);
          setRejectionReason("");
        },
      },
    );
  };

  const handleCorrectSubmit = (e) => {
    e.preventDefault();
    if (!correctTarget) return;
    if (!correctForm.adjustment_reason.trim()) {
      toast.error("Adjustment reason is required.");
      return;
    }

    correctMutation.mutate(
      {
        id: correctTarget.id,
        data: {
          hours_spent: parseFloat(correctForm.hours_spent),
          description: correctForm.description.trim() || undefined,
          adjustment_reason: correctForm.adjustment_reason.trim(),
        },
      },
      {
        onSuccess: () => {
          setCorrectTarget(null);
          setCorrectForm({ hours_spent: "", description: "", adjustment_reason: "" });
        },
      },
    );
  };

  const handleVoidSubmit = (e) => {
    e.preventDefault();
    if (!voidTarget) return;
    if (!voidReason.trim()) {
      toast.error("Reason for voiding is required.");
      return;
    }

    voidMutation.mutate(
      {
        id: voidTarget.id,
        reason: voidReason.trim(),
      },
      {
        onSuccess: () => {
          setVoidTarget(null);
          setVoidReason("");
        },
      },
    );
  };

  // Cấu hình Cột DataTable
  const columns = [
    {
      header: "Employee",
      accessorKey: "user",
      cell: (row) => (
        <div className='flex items-center gap-2.5'>
          <div className='w-8 h-8 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200 shrink-0 shadow-2xs'>
            {(row.employee_name || row.user?.email || "U")[0].toUpperCase()}
          </div>
          <div className='min-w-0'>
            <p className='font-bold text-xs text-slate-900 truncate'>{row.employee_name || row.user?.full_name || row.user?.email || "Employee"}</p>
            <p className='text-[10px] text-slate-400 truncate'>{row.user?.email || ""}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Project & Task",
      accessorKey: "task",
      cell: (row) => (
        <div className='space-y-1 min-w-[200px] max-w-[280px]'>
          <div className='flex items-center gap-1.5 flex-wrap'>
            <span className='font-bold text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100 shrink-0'>
              {row.task?.job?.job_code || `JOB-${row.task?.job?.id || ""}`}
            </span>
            <span className='text-[11px] font-semibold text-slate-700 truncate'>{row.task?.job?.job_name || "Project"}</span>
          </div>

          <div className='flex items-center gap-1.5'>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (row.task?.id) openTaskDrawer(row.task.id);
              }}
              className='text-xs font-medium text-slate-900 hover:text-blue-600 truncate transition text-left cursor-pointer hover:underline'>
              {row.task?.task_code && <span className='font-bold text-slate-500 mr-1'>{row.task.task_code}:</span>}
              {row.task?.title || "Task Deliverable"}
            </button>
            {row.task?.status && (
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border shrink-0",
                  row.task.status === "COMPLETED" && "bg-orange-50 text-orange-700 border-orange-200",
                  row.task.status === "REVIEWING" && "bg-purple-50 text-purple-700 border-purple-200",
                  row.task.status === "IN_PROGRESS" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                  row.task.status === "TODO" && "bg-blue-50 text-blue-700 border-blue-200",
                )}>
                {row.task.status}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Work Date",
      accessorKey: "work_date",
      cell: (row) => (
        <div className='flex items-center gap-1.5 text-xs text-slate-700 font-medium'>
          <Calendar className='w-3.5 h-3.5 text-slate-400 shrink-0' />
          <span>{formatDateSafe(row.work_date)}</span>
        </div>
      ),
    },
    {
      header: "Hours Spent",
      accessorKey: "hours_spent",
      cell: (row) => (
        <div className='flex items-center gap-1'>
          <span className='font-extrabold text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200'>{row.hours_spent} hrs</span>
        </div>
      ),
    },
    {
      header: "Review Status",
      accessorKey: "review_status",
      cell: (row) => {
        const config = {
          PENDING: "bg-amber-50 text-amber-700 border-amber-200",
          APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
          REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
          VOIDED: "bg-slate-100 text-slate-600 border-slate-200",
        };
        return (
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider",
              config[row.review_status] || "bg-slate-100 text-slate-700",
            )}>
            {row.review_status}
          </span>
        );
      },
    },
    {
      header: "Work Description & Notes",
      accessorKey: "description",
      cell: (row) => (
        <div className='max-w-xs space-y-1'>
          <p className='text-xs text-slate-700 line-clamp-2 leading-relaxed'>{row.description || <span className='text-slate-400 italic'>No notes provided</span>}</p>
          {row.review_note && (
            <p className='text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100'>Review: {row.review_note}</p>
          )}
          {row.rejection_reason && (
            <p className='text-[10px] text-rose-700 font-medium bg-rose-50 px-2 py-0.5 rounded border border-rose-100'>Reject reason: {row.rejection_reason}</p>
          )}
          {row.adjustment_reason && (
            <p className='text-[10px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-100'>Adjust reason: {row.adjustment_reason}</p>
          )}
        </div>
      ),
    },
    {
      header: "Decision Actions",
      accessorKey: "actions",
      className: "text-right",
      cell: (row) => (
        <div className='flex items-center justify-end gap-1.5' onClick={(e) => e.stopPropagation()}>
          {row.review_status === "PENDING" && (
            <>
              <button
                onClick={() => {
                  setApproveTarget(row);
                  setApproveNote("");
                }}
                className='p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition cursor-pointer'
                title='Approve LogWork'>
                <CheckCircle2 className='w-4 h-4' />
              </button>

              <button
                onClick={() => {
                  setRejectTarget(row);
                  setRejectionReason("");
                }}
                className='p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition cursor-pointer'
                title='Reject LogWork'>
                <XCircle className='w-4 h-4' />
              </button>

              <button
                onClick={() => {
                  setCorrectTarget(row);
                  setCorrectForm({
                    hours_spent: String(row.hours_spent),
                    description: row.description || "",
                    adjustment_reason: "",
                  });
                }}
                className='p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 transition cursor-pointer'
                title='Correct / Adjust Hours'>
                <Edit3 className='w-4 h-4' />
              </button>

              <button
                onClick={() => {
                  setVoidTarget(row);
                  setVoidReason("");
                }}
                className='p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition cursor-pointer'
                title='Void Entry'>
                <Ban className='w-4 h-4' />
              </button>
            </>
          )}

          {row.review_status === "APPROVED" && (
            <button
              onClick={() => {
                setCorrectTarget(row);
                setCorrectForm({
                  hours_spent: String(row.hours_spent),
                  description: row.description || "",
                  adjustment_reason: "",
                });
              }}
              className='p-1.5 hover:bg-amber-50 hover:text-amber-700 text-slate-400 rounded-lg transition cursor-pointer'
              title='Adjust Hours'>
              <Edit3 className='w-4 h-4' />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className='space-y-6 text-slate-800 pb-12'>
      {/* 🌟 HERO HEADER & SUMMARY CARDS */}
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs'>
        <div className='flex items-start gap-4'>
          <div className='w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20 shrink-0'>
            <Clock className='w-6 h-6' />
          </div>
          <div>
            <h1 className='text-xl font-bold text-slate-900'>Timesheet Approvals & Review Queue</h1>
            <p className='text-xs text-slate-500 mt-1'>Verify, approve, adjust or reject employee logged work hours across your managed projects.</p>
          </div>
        </div>

        <div className='flex items-center gap-3'>
          <button
            onClick={() => navigate("/manager/timelock")}
            className='inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 shadow-2xs transition cursor-pointer'>
            <Lock className='w-3.5 h-3.5 text-indigo-600' />
            <span>Time Lock Periods</span>
          </button>

          <button
            onClick={() => {
              refetch();
              toast.success("Timesheet queue updated!");
            }}
            disabled={isFetching}
            className='inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer'>
            <RotateCcw className={cn("w-3.5 h-3.5 text-slate-500", isFetching && "animate-spin")} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* 📊 4 SUMMARY STATCARDS */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
        <div className='p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-2'>
          <div className='flex items-center justify-between'>
            <span className='text-xs font-bold text-amber-800'>Pending Review</span>
            <span className='w-2 h-2 rounded-full bg-amber-500 animate-ping' />
          </div>
          <div className='flex items-baseline gap-2'>
            <span className='text-2xl font-extrabold text-amber-900'>{kpis.pendingCount}</span>
            <span className='text-xs font-semibold text-amber-700'>entries ({kpis.pendingHours.toFixed(1)} hrs)</span>
          </div>
        </div>

        <div className='p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-2'>
          <span className='text-xs font-bold text-emerald-800'>Approved in Queue</span>
          <div className='flex items-baseline gap-2'>
            <span className='text-2xl font-extrabold text-emerald-900'>{kpis.approvedHours.toFixed(1)}</span>
            <span className='text-xs font-semibold text-emerald-700'>verified work hours</span>
          </div>
        </div>

        <div className='p-4 bg-blue-50/50 border border-blue-200/80 rounded-2xl space-y-2'>
          <span className='text-xs font-bold text-blue-800'>Total Logged Hours</span>
          <div className='flex items-baseline gap-2'>
            <span className='text-2xl font-extrabold text-blue-900'>{kpis.totalHours.toFixed(1)}</span>
            <span className='text-xs font-semibold text-blue-700'>hours recorded</span>
          </div>
        </div>

        <div className='p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2'>
          <span className='text-xs font-bold text-slate-700'>Total Filtered Records</span>
          <div className='flex items-baseline gap-2'>
            <span className='text-2xl font-extrabold text-slate-900'>{totalCount}</span>
            <span className='text-xs font-semibold text-slate-500'>submissions</span>
          </div>
        </div>
      </div>

      {/* 🔘 STATUS TABS STRIP */}
      <div className='flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto custom-scrollbar'>
        {STATUS_TABS.map((tab) => {
          const isActive = selectedStatusTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedStatusTab(tab.id);
                setCurrentPage(1);
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0",
                isActive ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80",
              )}>
              <span className={cn("w-2 h-2 rounded-full", isActive ? "bg-white" : tab.color)} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 🔍 FILTER TOOLBAR */}
      <div className='p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3'>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs'>
          <div className='relative'>
            <Search className='w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2' />
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder='Search employee, task, note...'
              className='w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <select
            value={selectedJobId}
            onChange={(e) => {
              setSelectedJobId(e.target.value);
              setCurrentPage(1);
            }}
            className='w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium'>
            <option value=''>-- All Projects / Jobs --</option>
            {jobOptions.map((j) => (
              <option key={j.value} value={j.value}>
                {j.label}
              </option>
            ))}
          </select>

          <select
            value={selectedEmployeeId}
            onChange={(e) => {
              setSelectedEmployeeId(e.target.value);
              setCurrentPage(1);
            }}
            className='w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium'>
            <option value=''>-- All Employees --</option>
            {employeeOptions.map((emp) => (
              <option key={emp.value} value={emp.value}>
                {emp.label}
              </option>
            ))}
          </select>

          <div className='flex items-center gap-2'>
            <input
              type='date'
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className='flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500'
              title='From date'
            />
            <span className='text-slate-400'>→</span>
            <input
              type='date'
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className='flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500'
              title='To date'
            />
          </div>
        </div>

        {(selectedJobId || selectedEmployeeId || searchQuery || startDate || endDate) && (
          <div className='flex items-center justify-between pt-2 border-t border-slate-100 text-xs'>
            <span className='text-slate-500 font-medium'>Active filters applied</span>
            <button onClick={handleClearFilters} className='text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer'>
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* 📋 DATA TABLE */}
      <div className='bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden'>
        <DataTable
          columns={columns}
          data={logWorks}
          isLoading={logWorksLoading}
          pagination={{
            currentPage: currentPage,
            totalPages: Math.ceil(totalCount / pageSize) || 1,
            totalItems: totalCount,
            pageSize: pageSize,
            pageSizeOptions: [10, 20, 50],
            onPageChange: (page) => setCurrentPage(page),
            onPageSizeChange: (size) => {
              setPageSize(size);
              setCurrentPage(1);
            },
          }}
          emptyMessage={
            selectedStatusTab === "PENDING"
              ? "🎉 Outstanding! There are no pending timesheets awaiting your review."
              : "No timesheet entries found matching the active filter criteria."
          }
        />
      </div>

      {/* 🟢 MODAL: APPROVE LOGWORK */}
      <BaseModal
        isOpen={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title='Approve Work Log'
        description={`Approve ${approveTarget?.hours_spent} hours on "${approveTarget?.task?.title}" for ${approveTarget?.employee_name || "Employee"}`}>
        <form onSubmit={handleApproveSubmit} className='space-y-4 text-xs'>
          <div className='p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5'>
            <div className='flex items-center justify-between'>
              <span className='font-bold text-emerald-900'>Logged Hours:</span>
              <span className='font-extrabold text-sm text-emerald-800'>{approveTarget?.hours_spent} hrs</span>
            </div>
            <div className='flex items-center justify-between text-[11px] text-emerald-700'>
              <span>Work Date:</span>
              <span>{formatDateSafe(approveTarget?.work_date)}</span>
            </div>
          </div>

          <div>
            <label className='block font-semibold text-slate-700 mb-1'>Approval Note (Optional)</label>
            <input
              type='text'
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder='e.g. Good progress on this milestone'
              className='w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500'
            />
          </div>

          <div className='pt-3 flex items-center justify-end gap-2 border-t border-slate-100'>
            <button
              type='button'
              onClick={() => setApproveTarget(null)}
              className='px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer'>
              Cancel
            </button>
            <button
              type='submit'
              disabled={approveMutation.isPending}
              className='px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition'>
              {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
            </button>
          </div>
        </form>
      </BaseModal>

      {/* 🔴 MODAL: REJECT LOGWORK */}
      <BaseModal
        isOpen={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title='Reject Work Log Submission'
        description={`Reject ${rejectTarget?.hours_spent} hours logged by ${rejectTarget?.employee_name || "Employee"}`}>
        <form onSubmit={handleRejectSubmit} className='space-y-4 text-xs'>
          <div>
            <label className='block font-bold text-rose-700 mb-1'>Reason for Rejection *</label>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder='Explain why this log work entry was rejected...'
              required
              className='w-full bg-rose-50/40 border border-rose-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed'
            />
          </div>

          <div className='pt-3 flex items-center justify-end gap-2 border-t border-slate-100'>
            <button
              type='button'
              onClick={() => setRejectTarget(null)}
              className='px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer'>
              Cancel
            </button>
            <button
              type='submit'
              disabled={rejectMutation.isPending}
              className='px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition'>
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </button>
          </div>
        </form>
      </BaseModal>

      {/* ✏️ MODAL: CORRECT / ADJUST LOGWORK */}
      <BaseModal
        isOpen={Boolean(correctTarget)}
        onClose={() => setCorrectTarget(null)}
        title='Adjust LogWork Hours'
        description={`Adjust hours or description for entry #${correctTarget?.id}`}>
        <form onSubmit={handleCorrectSubmit} className='space-y-4 text-xs'>
          <InputField
            label='Adjusted Hours Spent *'
            type='number'
            step='0.25'
            min='0.25'
            max='24'
            value={correctForm.hours_spent}
            onChange={(e) => setCorrectForm({ ...correctForm, hours_spent: e.target.value })}
            required
          />

          <div>
            <label className='block font-semibold text-slate-700 mb-1'>Updated Work Description</label>
            <textarea
              rows={2}
              value={correctForm.description}
              onChange={(e) => setCorrectForm({ ...correctForm, description: e.target.value })}
              className='w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500'
            />
          </div>

          <div>
            <label className='block font-bold text-amber-700 mb-1'>Adjustment Reason (Audit requirement) *</label>
            <textarea
              rows={2}
              value={correctForm.adjustment_reason}
              onChange={(e) => setCorrectForm({ ...correctForm, adjustment_reason: e.target.value })}
              placeholder='Explain why hours were adjusted by Manager...'
              required
              className='w-full bg-amber-50/50 border border-amber-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500'
            />
          </div>

          <div className='pt-3 flex items-center justify-end gap-2 border-t border-slate-100'>
            <button
              type='button'
              onClick={() => setCorrectTarget(null)}
              className='px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer'>
              Cancel
            </button>
            <button
              type='submit'
              disabled={correctMutation.isPending}
              className='px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition'>
              {correctMutation.isPending ? "Saving..." : "Confirm Adjustment"}
            </button>
          </div>
        </form>
      </BaseModal>

      {/* ⚪ MODAL: VOID LOGWORK */}
      <BaseModal
        isOpen={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        title='Void Work Log Entry'
        description={`Invalidate work log entry #${voidTarget?.id}`}>
        <form onSubmit={handleVoidSubmit} className='space-y-4 text-xs'>
          <div>
            <label className='block font-bold text-slate-700 mb-1'>Reason for Voiding *</label>
            <textarea
              rows={3}
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder='Explain why this logwork entry is being voided...'
              required
              className='w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500'
            />
          </div>

          <div className='pt-3 flex items-center justify-end gap-2 border-t border-slate-100'>
            <button
              type='button'
              onClick={() => setVoidTarget(null)}
              className='px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer'>
              Cancel
            </button>
            <button
              type='submit'
              disabled={voidMutation.isPending}
              className='px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition'>
              {voidMutation.isPending ? "Voiding..." : "Confirm Void"}
            </button>
          </div>
        </form>
      </BaseModal>

      {/* Task Detail Slide-over */}
      <TaskDetailDrawer />
    </div>
  );
}
