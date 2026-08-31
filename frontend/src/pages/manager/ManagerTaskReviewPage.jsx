import React, { useState, useMemo, useEffect } from "react";
import { ShieldAlert, ShieldCheck, CheckCircle2, XCircle, Clock, Search, RotateCcw, Paperclip, Award, AlertTriangle, FileText, X, PauseCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

import UserAvatar from "../../components/common/avatar/UserAvatar";
import { cn } from "../../utils/cn";

// Modular Sub-Components
import TaskQAInspectionPanel from "../../components/manager/tasks/TaskQAInspectionPanel";
import TaskRejectReworkModal from "../../components/manager/tasks/TaskRejectReworkModal";
import FloatingDirectChatWidget from "../../components/common/chat/FloatingDirectChatWidget";

// Query Hooks & Services
import {
  useManagerTasks,
  useManagerTaskDetail,
  useApproveTask,
  useRejectTask,
  useTaskAttachments,
  useUploadTaskAttachment,
  useTaskComments,
} from "../../hooks/queries/manager/useManagerTasks";
import { useManagerJobs } from "../../hooks/queries/manager/useManagerJobs";
import { useAuth } from "../../hooks/useAuth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function formatDateSafe(dateStr, pattern = "dd MMM yyyy") {
  if (!dateStr) return "N/A";
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

export default function ManagerTaskReviewPage() {
  const { user: currentUser } = useAuth();

  // Filter States
  const [reviewTab, setReviewTab] = useState("REVIEWING"); // "REVIEWING" | "FROZEN" | "COMPLETED" | "REJECTED" | "ALL"
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // Reject Modal States
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [referenceFile, setReferenceFile] = useState(null);

  // 💬 Realtime 1-on-1 Direct Chat State
  const [quickChatOpen, setQuickChatOpen] = useState(false);

  // 🚀 QUERY HOOKS
  const queryParams = useMemo(() => {
    const params = { page_size: 100, ordering: "-updated_at", is_review_scope: "true" };
    if (reviewTab === "REVIEWING" || reviewTab === "FROZEN") {
      params.status = "REVIEWING";
    } else if (reviewTab === "COMPLETED") {
      params.status = "COMPLETED";
    } else if (reviewTab === "REJECTED") {
      params.has_rejections = "true";
    }
    if (selectedJobId) params.job_id = selectedJobId;
    if (selectedDate) params.submitted_date = selectedDate;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    return params;
  }, [reviewTab, selectedJobId, selectedDate, searchQuery]);

  const { data: tasksData, isLoading, refetch } = useManagerTasks(queryParams);
  const { data: jobsResponse } = useManagerJobs({ page_size: 100 });

  // Single Task Detail query for accurate timestamps and full descriptions
  const { data: taskDetail } = useManagerTaskDetail(selectedTaskId);

  // Mutations
  const approveMutation = useApproveTask();
  const rejectMutation = useRejectTask();

  // Normalize raw tasks
  const rawTasks = useMemo(() => {
    if (!tasksData) return [];
    if (Array.isArray(tasksData)) return tasksData;
    if (Array.isArray(tasksData.results)) return tasksData.results;
    return [];
  }, [tasksData]);

  // Filter tasks based on reviewTab (Active Pending vs Frozen On-Hold vs All QA Scope - EXCLUDES TODO)
  const tasks = useMemo(() => {
    const qaScopeTasks = rawTasks.filter((t) => t.status !== "TODO");

    if (reviewTab === "REVIEWING") {
      return qaScopeTasks.filter((t) => t.status === "REVIEWING" && (!t.job?.status || t.job?.status === "ACTIVE"));
    }
    if (reviewTab === "FROZEN") {
      return qaScopeTasks.filter((t) => t.status === "REVIEWING" && t.job?.status && t.job?.status !== "ACTIVE");
    }
    if (reviewTab === "COMPLETED") {
      return qaScopeTasks.filter((t) => t.status === "COMPLETED");
    }
    if (reviewTab === "REJECTED") {
      return qaScopeTasks.filter((t) => t.rejection_count > 0 || t.status === "IN_PROGRESS");
    }
    return qaScopeTasks;
  }, [rawTasks, reviewTab]);

  // Tab counts for quick metrics
  const tabCounts = useMemo(() => {
    const qaScopeTasks = rawTasks.filter((t) => t.status !== "TODO");
    const active = qaScopeTasks.filter((t) => t.status === "REVIEWING" && (!t.job?.status || t.job?.status === "ACTIVE")).length;
    const frozen = qaScopeTasks.filter((t) => t.status === "REVIEWING" && t.job?.status && t.job?.status !== "ACTIVE").length;
    return { active, frozen };
  }, [rawTasks]);

  // Jobs options
  const jobOptions = useMemo(() => {
    const list = Array.isArray(jobsResponse) ? jobsResponse : jobsResponse?.results || [];
    return [
      { value: "", label: "All Projects (Jobs)" },
      ...list.map((j) => ({
        value: String(j.id),
        label: `${j.job_code || `JOB-${j.id}`}: ${j.job_name || j.name || j.title}`,
      })),
    ];
  }, [jobsResponse]);

  // Auto-select first item
  useEffect(() => {
    if (tasks.length > 0) {
      const exists = tasks.some((t) => String(t.id) === String(selectedTaskId));
      if (!selectedTaskId || !exists) {
        setSelectedTaskId(tasks[0].id);
      }
    } else {
      setSelectedTaskId(null);
    }
  }, [tasks, selectedTaskId]);

  // Combined Active Task Object
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    const base = tasks.find((t) => String(t.id) === String(selectedTaskId)) || null;
    if (!base) return null;
    return taskDetail ? { ...base, ...taskDetail } : base;
  }, [tasks, selectedTaskId, taskDetail]);

  const isJobActive = !selectedTask?.job?.status || selectedTask?.job?.status === "ACTIVE";
  const isFrozen = selectedTask?.status === "REVIEWING" && !isJobActive;

  // Attachments for the active task
  const { data: attachmentsResponse } = useTaskAttachments(selectedTaskId);
  const uploadAttachmentMutation = useUploadTaskAttachment(selectedTaskId);

  const attachments = useMemo(() => {
    if (!attachmentsResponse) return [];
    if (Array.isArray(attachmentsResponse)) return attachmentsResponse;
    if (Array.isArray(attachmentsResponse.results)) return attachmentsResponse.results;
    return [];
  }, [attachmentsResponse]);

  // Comments for the active task (Handover note)
  const { data: commentsResponse } = useTaskComments(selectedTaskId);
  const comments = useMemo(() => {
    if (!commentsResponse) return [];
    if (Array.isArray(commentsResponse)) return commentsResponse;
    if (Array.isArray(commentsResponse.results)) return commentsResponse.results;
    return [];
  }, [commentsResponse]);

  const latestHandoverNote = useMemo(() => {
    if (!comments || comments.length === 0) return null;
    // 1. Highest priority: The explicit QA Submission Note
    const qaComment = [...comments].reverse().find((c) => c.content?.includes("[QA Deliverable Submission]"));
    if (qaComment) {
      return qaComment.content.replace("[QA Deliverable Submission]:", "").trim();
    }
    // 2. Fallback: Latest comment from assignee
    const assigneeComment = [...comments].reverse().find((c) => c.user?.id === selectedTask?.assignee?.id);
    if (assigneeComment) {
      return assigneeComment.content.trim();
    }
    // 3. Fallback: Latest comment overall
    const latest = comments[comments.length - 1];
    return latest?.content?.trim() || null;
  }, [comments, selectedTask]);

  // ⚡ AUTO-ADVANCE HELPER
  const autoAdvanceToNext = (processedId) => {
    const remaining = tasks.filter((t) => String(t.id) !== String(processedId));
    if (remaining.length > 0) {
      setSelectedTaskId(remaining[0].id);
    } else {
      setSelectedTaskId(null);
    }
  };

  // 🚀 ACTION HANDLERS
  const handleApprove = (task) => {
    if (!task) return;
    approveMutation.mutate(task.id, {
      onSuccess: () => {
        autoAdvanceToNext(task.id);
      },
    });
  };

  const handleOpenRejectModal = () => {
    if (!selectedTask) return;
    setRejectionReason("");
    setReferenceFile(null);
    setRejectModalOpen(true);
  };

  const handleConfirmReject = () => {
    if (!selectedTask) return;
    if (!rejectionReason.trim()) {
      toast.error("Please enter a rejection reason or fix instructions.");
      return;
    }

    // If reference file attached, upload it first then reject
    if (referenceFile) {
      const formData = new FormData();
      formData.append("file", referenceFile);
      uploadAttachmentMutation.mutate(formData, {
        onSuccess: () => {
          rejectMutation.mutate(
            { id: selectedTask.id, reason: rejectionReason.trim() },
            {
              onSuccess: () => {
                setRejectModalOpen(false);
                autoAdvanceToNext(selectedTask.id);
              },
            },
          );
        },
        onError: () => {
          rejectMutation.mutate(
            { id: selectedTask.id, reason: rejectionReason.trim() },
            {
              onSuccess: () => {
                setRejectModalOpen(false);
                autoAdvanceToNext(selectedTask.id);
              },
            },
          );
        },
      });
    } else {
      rejectMutation.mutate(
        { id: selectedTask.id, reason: rejectionReason.trim() },
        {
          onSuccess: () => {
            setRejectModalOpen(false);
            autoAdvanceToNext(selectedTask.id);
          },
        },
      );
    }
  };

  // 💬 REALTIME DIRECT CHAT LOGIC (KẾT NỐI HỆ THỐNG CHAT 1-1 TOÀN CỤC)
  const handleOpenDirectChat = () => {
    if (!selectedTask) return;
    const targetUserId = selectedTask.assignee?.id || selectedTask.assignee_id;
    if (!targetUserId) {
      toast.error("No assignee assigned to this task.");
      return;
    }
    setQuickChatOpen(true);
  };

  // Assignee name helper for modals
  const assigneeName = selectedTask?.assignee?.full_name || selectedTask?.assignee_name || "Assignee";

  return (
    <div className='w-full h-[calc(100vh-80px)] flex flex-col antialiased bg-slate-100 overflow-hidden rounded-2xl'>
      {/* =========================================================================
           TOP HEADER BAR
           ========================================================================= */}
      <header className='bg-white border-b border-slate-200 px-5 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 shadow-2xs z-20'>
        <div>
          <div className='flex items-center gap-2'>
            <span className='px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-mono text-[10px] font-bold border border-purple-200'>
              TASK DELIVERABLES QA COCKPIT
            </span>
          </div>
          <h1 className='text-lg font-extrabold text-slate-900 mt-0.5'>Task Acceptance & Deliverables Review</h1>
        </div>

        {/* 🗂️ REVIEW STAGE FILTER TABS */}
        <div className='flex items-center gap-2 flex-wrap'>
          <div className='flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600'>
            <button
              onClick={() => setReviewTab("REVIEWING")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                reviewTab === "REVIEWING" ? "bg-white text-purple-700 shadow-xs" : "hover:text-slate-900",
              )}>
              <Clock className='w-3.5 h-3.5 text-purple-600' />
              <span>Pending QA {tabCounts.active > 0 && `(${tabCounts.active})`}</span>
            </button>
            <button
              onClick={() => setReviewTab("FROZEN")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                reviewTab === "FROZEN" ? "bg-white text-amber-700 shadow-xs" : "hover:text-slate-900",
              )}>
              <AlertTriangle className='w-3.5 h-3.5 text-amber-600' />
              <span>Frozen / On-Hold {tabCounts.frozen > 0 && `(${tabCounts.frozen})`}</span>
            </button>
            <button
              onClick={() => setReviewTab("COMPLETED")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                reviewTab === "COMPLETED" ? "bg-white text-emerald-700 shadow-xs" : "hover:text-slate-900",
              )}>
              <CheckCircle2 className='w-3.5 h-3.5 text-emerald-600' />
              <span>Approved History</span>
            </button>
            <button
              onClick={() => setReviewTab("REJECTED")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                reviewTab === "REJECTED" ? "bg-white text-rose-700 shadow-xs" : "hover:text-slate-900",
              )}>
              <XCircle className='w-3.5 h-3.5 text-rose-600' />
              <span>Rejected / Rework</span>
            </button>
            <button
              onClick={() => setReviewTab("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                reviewTab === "ALL" ? "bg-white text-blue-700 shadow-xs" : "hover:text-slate-900",
              )}>
              <Paperclip className='w-3.5 h-3.5 text-blue-600' />
              <span>All History</span>
            </button>
          </div>

          <button
            onClick={() => refetch()}
            className='p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer shrink-0'
            title='Refresh Data'>
            <RotateCcw className='w-4 h-4' />
          </button>
        </div>
      </header>

      {/* =========================================================================
           MAIN 2-COLUMN SPLIT-PANE WORKSPACE
           ========================================================================= */}
      <main className='flex-1 flex overflow-hidden p-3 gap-3 bg-slate-100 min-h-0'>
        {/* =========================================================================
             LEFT COLUMN (MASTER TASK QUEUE): 56% WIDTH
             ========================================================================= */}
        <section className='w-[56%] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0'>
          {/* Filter Toolbar - ALWAYS VISIBLE */}
          <div className='p-3 border-b border-slate-200 bg-white space-y-2 shrink-0'>
            <div className='flex items-center gap-2 text-xs'>
              {/* 1. Search Bar (Compact) */}
              <div className='relative flex-1 min-w-0'>
                <Search className='w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5' />
                <input
                  type='text'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='Search task, code, staff...'
                  className='w-full pl-7.5 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition'
                />
                {searchQuery && (
                  <button
                    type='button'
                    onClick={() => setSearchQuery("")}
                    className='absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5'
                    title='Clear search text'>
                    <X className='w-3.5 h-3.5' />
                  </button>
                )}
              </div>

              {/* 2. Project Filter Select */}
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className='px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 w-[140px] shrink-0 truncate focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer'>
                {jobOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* 3. Submission Date Filter */}
              <div className='relative w-[135px] shrink-0'>
                <input
                  type='date'
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  title='Filter by Submission / Update Date'
                  className={cn(
                    "w-full px-2 py-1.5 bg-slate-50 border rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer transition",
                    selectedDate ? "border-purple-300 bg-purple-50/50 text-purple-900 font-bold" : "border-slate-200",
                  )}
                />
                {selectedDate && (
                  <button
                    type='button'
                    onClick={() => setSelectedDate("")}
                    className='absolute right-6 top-2 text-slate-400 hover:text-rose-600 cursor-pointer p-0.5'
                    title='Clear date filter'>
                    <X className='w-3 h-3' />
                  </button>
                )}
              </div>

              {/* 4. Reset Button */}
              {(searchQuery.trim() || selectedJobId || selectedDate) && (
                <button
                  type='button'
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedJobId("");
                    setSelectedDate("");
                  }}
                  className='px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs shrink-0 cursor-pointer transition'
                  title='Clear All Filters'>
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* MASTER TABLE / EMPTY STATES */}
          <div className='flex-1 overflow-y-auto custom-scrollbar min-h-0 flex flex-col'>
            {isLoading ? (
              <div className='flex-1 flex items-center justify-center p-8'>
                <div className='w-7 h-7 border-3 border-purple-600 border-t-transparent rounded-full animate-spin' />
              </div>
            ) : tasks.length === 0 ? (
              <div className='flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3'>
                <div className='w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100 shadow-2xs'>
                  {searchQuery || selectedJobId ? <Search className='w-6 h-6' /> : <Award className='w-6 h-6' />}
                </div>
                <div className='space-y-1'>
                  <h3 className='text-sm font-extrabold text-slate-900'>{searchQuery || selectedJobId ? "No Matching Tasks Found" : "No Tasks in This Category"}</h3>
                  <p className='text-xs text-slate-500 max-w-xs mx-auto leading-relaxed'>
                    {searchQuery || selectedJobId ? `No deliverables matched your filter criteria.` : `There are currently no tasks in the '${reviewTab}' review tab.`}
                  </p>
                </div>
                {(searchQuery || selectedJobId) && (
                  <button
                    type='button'
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedJobId("");
                    }}
                    className='px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer'>
                    Clear Search Filters
                  </button>
                )}
              </div>
            ) : (
              <table className='w-full text-left text-sm table-fixed'>
                <thead className='bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs'>
                  <tr>
                    <th className='py-2.5 px-3 w-[40%]'>TASK TITLE & AUDIT</th>
                    <th className='py-2.5 px-2.5 w-[24%]'>ASSIGNEE</th>
                    <th className='py-2.5 px-2 text-center w-[18%]'>DELIVERABLES</th>
                    <th className='py-2.5 px-3 text-center w-[18%]'>STATUS</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-100 text-slate-700'>
                  {tasks.map((task) => {
                    const isSelected = String(task.id) === String(selectedTaskId);
                    const taskCode = task.code || `TSK-${task.id}`;
                    const empName = task.assignee?.full_name || task.assignee_name || "Unassigned";
                    const parentJob = task.job?.job_name || task.job_title || "Project Job";
                    const filesCount = task.attachment_count ?? task.attachments_count ?? task.attachments?.length ?? 0;
                    const rejectionCount = task.rejection_count || 0;
                    const taskJobFrozen = task.status === "REVIEWING" && task.job?.status && task.job?.status !== "ACTIVE";

                    return (
                      <tr
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isSelected ? "bg-purple-50/80 border-l-4 border-purple-600 hover:bg-purple-50" : "hover:bg-slate-50 border-l-4 border-transparent",
                        )}>
                        <td className='py-2.5 px-3 min-w-0'>
                          <div className='flex items-center gap-1.5 flex-wrap'>
                            <span className='font-mono font-bold text-purple-700 text-xs shrink-0'>{taskCode}</span>
                            <span className='font-bold text-slate-900 text-xs truncate max-w-[200px]'>{task.title}</span>
                            {rejectionCount > 0 && (
                              <span
                                className='inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-extrabold'
                                title={`This deliverable has been rejected ${rejectionCount} time(s)`}>
                                <AlertTriangle className='w-2.5 h-2.5 text-rose-500 shrink-0' />
                                <span>{rejectionCount}x Rejected</span>
                              </span>
                            )}
                          </div>
                          <p className='text-[10px] text-slate-400 font-mono truncate mt-0.5'>{parentJob}</p>
                        </td>
                        <td className='py-2.5 px-2.5'>
                          <div className='flex items-center gap-2 min-w-0'>
                            <UserAvatar avatarUrl={task.assignee?.avatar_url || task.assignee_avatar} fullName={empName} size='xs' />
                            <div className='min-w-0'>
                              <p className='font-bold text-slate-900 text-xs truncate'>{empName}</p>
                              <p className='text-[10px] text-slate-400 truncate'>Staff</p>
                            </div>
                          </div>
                        </td>
                        <td className='py-2.5 px-2 text-center'>
                          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold text-[11px]'>
                            <Paperclip className='w-3 h-3 text-purple-600' />
                            <span>
                              {filesCount} File{filesCount !== 1 ? "s" : ""}
                            </span>
                          </span>
                        </td>
                        <td className='py-2.5 px-3 text-center'>
                          {taskJobFrozen ? (
                            <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300 text-[9px] font-extrabold uppercase whitespace-nowrap'>
                              <PauseCircle className='w-2.5 h-2.5 text-slate-600 shrink-0' />
                              <span>FROZEN ({task.job.status})</span>
                            </span>
                          ) : task.status === "REVIEWING" ? (
                            <span className='inline-block px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-[9px] font-extrabold uppercase whitespace-nowrap'>
                              PENDING QA
                            </span>
                          ) : task.status === "COMPLETED" ? (
                            <span className='inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-extrabold uppercase whitespace-nowrap'>
                              APPROVED
                            </span>
                          ) : task.status === "IN_PROGRESS" ? (
                            <span className='inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-extrabold uppercase whitespace-nowrap'>
                              IN REWORK
                            </span>
                          ) : (
                            <span className='inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-extrabold uppercase whitespace-nowrap'>
                              {task.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer */}
          <div className='p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between shrink-0'>
            <span>
              Showing {tasks.length} deliverables in '{reviewTab}' tab
            </span>
            <span className='font-semibold text-slate-700'>Click any task to inspect details</span>
          </div>
        </section>

        {/* =========================================================================
               RIGHT COLUMN (TASK QA INSPECTION PANE): 44% WIDTH
               ========================================================================= */}
        <section className='w-[44%] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0'>
          <TaskQAInspectionPanel
            task={selectedTask}
            attachments={attachments}
            latestHandoverNote={latestHandoverNote}
            isFrozen={isFrozen}
            isJobActive={isJobActive}
            onApprove={handleApprove}
            onOpenRejectModal={handleOpenRejectModal}
            onOpenDirectChat={handleOpenDirectChat}
            isApproving={approveMutation.isPending}
            isRejecting={rejectMutation.isPending}
          />
        </section>
      </main>

      {/* =========================================================================
           MODAL: REJECT WITH FIX NOTES & ATTACH REFERENCE DOCUMENTS
           ========================================================================= */}
      <TaskRejectReworkModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        assigneeName={assigneeName}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        referenceFile={referenceFile}
        setReferenceFile={setReferenceFile}
        onConfirm={handleConfirmReject}
        isPending={rejectMutation.isPending || uploadAttachmentMutation.isPending}
      />

      {/* =========================================================================
           💬 FLOATING 1-ON-1 DIRECT REALTIME CHAT WINDOW
           ========================================================================= */}
      <FloatingDirectChatWidget
        isOpen={quickChatOpen}
        onClose={() => setQuickChatOpen(false)}
        targetUser={selectedTask?.assignee || { id: selectedTask?.assignee_id, full_name: assigneeName }}
        taskContext={selectedTask ? { id: selectedTask.id, title: selectedTask.title } : null}
      />
    </div>
  );
}
