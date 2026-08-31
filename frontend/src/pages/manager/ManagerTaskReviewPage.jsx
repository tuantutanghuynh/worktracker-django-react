import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RotateCcw,
  Paperclip,
  Download,
  MessageSquare,
  MessageCircle,
  FilePlus,
  Send,
  Trash2,
  Award,
  ChevronRight,
  User,
  AlertTriangle,
  UploadCloud,
  FileText,
  X,
  Sparkles,
  Calendar,
  PauseCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

import BaseModal from "../../components/common/modal/BaseModal";
import InputField from "../../components/common/forms/InputField";
import UserAvatar from "../../components/common/avatar/UserAvatar";
import { cn } from "../../utils/cn";

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
import { chatService } from "../../services/common/chatService";
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

  // 💬 Realtime 1-on-1 Direct Chat States
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const [directRoom, setDirectRoom] = useState(null);
  const [directMessages, setDirectMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const chatMessagesEndRef = useRef(null);

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
      return qaScopeTasks.filter((t) => (t.rejection_count > 0 || t.status === "IN_PROGRESS"));
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
    const qaComment = [...comments].reverse().find(
      (c) => c.content?.includes("[QA Deliverable Submission]")
    );
    if (qaComment) {
      return qaComment.content.replace("[QA Deliverable Submission]:", "").trim();
    }
    // 2. Fallback: Latest comment from assignee
    const assigneeComment = [...comments].reverse().find(
      (c) => c.user?.id === selectedTask?.assignee?.id
    );
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
            }
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
            }
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
        }
      );
    }
  };

  // 💬 REALTIME DIRECT CHAT LOGIC (KẾT NỐI HỆ THỐNG CHAT 1-1 TOÀN CỤC)
  const handleOpenDirectChat = async () => {
    if (!selectedTask) return;
    const targetUserId = selectedTask.assignee?.id || selectedTask.assignee_id;
    if (!targetUserId) {
      toast.error("No assignee assigned to this task.");
      return;
    }

    setQuickChatOpen(true);
    setIsChatLoading(true);
    try {
      const roomData = await chatService.startDirect(targetUserId);
      setDirectRoom(roomData);

      // Load previous messages of this direct room
      const roomId = roomData.id || roomData.room_id;
      if (roomId) {
        const messagesRes = await chatService.getRoomMessages(roomId);
        setDirectMessages(messagesRes.messages || []);
      }
    } catch (err) {
      toast.error("Could not load direct chat room with employee.");
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSendDirectMessage = async () => {
    const textToSend = chatMessage.trim();
    const roomId = directRoom?.id || directRoom?.room_id;
    if (!textToSend || !roomId) return;

    setChatMessage("");
    setIsSendingMessage(true);

    try {
      const sentMsg = await chatService.sendMessage(roomId, {
        content: textToSend,
      });
      setDirectMessages((prev) => [...prev, sentMsg]);
    } catch (err) {
      toast.error("Failed to send message.");
      setChatMessage(textToSend);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Scroll chat to bottom when new message arrives
  useEffect(() => {
    if (quickChatOpen && chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [directMessages, quickChatOpen]);

  const getFileDownloadUrl = (fileUrl) => {
    if (!fileUrl) return "#";
    if (fileUrl.startsWith("http")) return fileUrl;
    return `${API_BASE_URL}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
  };

  // Assignee name & submission date helpers
  const assigneeName = selectedTask?.assignee?.full_name || selectedTask?.assignee_name || "Assignee";
  const jobTitle = selectedTask?.job?.job_name || selectedTask?.job_title || "Project Job";
  const submittedDate = selectedTask?.updated_at || selectedTask?.created_at;

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col antialiased bg-slate-100 overflow-hidden rounded-2xl">

      {/* =========================================================================
           TOP HEADER BAR
           ========================================================================= */}
      <header className="bg-white border-b border-slate-200 px-5 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 shadow-2xs z-20">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-mono text-[10px] font-bold border border-purple-200">
              TASK DELIVERABLES QA COCKPIT
            </span>
          </div>
          <h1 className="text-lg font-extrabold text-slate-900 mt-0.5">Task Acceptance & Deliverables Review</h1>
        </div>

        {/* 🗂️ REVIEW STAGE FILTER TABS */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setReviewTab("REVIEWING")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                reviewTab === "REVIEWING" ? "bg-white text-purple-700 shadow-xs" : "hover:text-slate-900"
              )}
            >
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              <span>Pending QA {tabCounts.active > 0 && `(${tabCounts.active})`}</span>
            </button>
            <button
              onClick={() => setReviewTab("FROZEN")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                reviewTab === "FROZEN" ? "bg-white text-amber-700 shadow-xs" : "hover:text-slate-900"
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Frozen / On-Hold {tabCounts.frozen > 0 && `(${tabCounts.frozen})`}</span>
            </button>
            <button
              onClick={() => setReviewTab("COMPLETED")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                reviewTab === "COMPLETED" ? "bg-white text-emerald-700 shadow-xs" : "hover:text-slate-900"
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Approved History</span>
            </button>
            <button
              onClick={() => setReviewTab("REJECTED")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                reviewTab === "REJECTED" ? "bg-white text-rose-700 shadow-xs" : "hover:text-slate-900"
              )}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Rejected / Rework</span>
            </button>
            <button
              onClick={() => setReviewTab("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                reviewTab === "ALL" ? "bg-white text-blue-700 shadow-xs" : "hover:text-slate-900"
              )}
            >
              <Paperclip className="w-3.5 h-3.5 text-blue-600" />
              <span>All History</span>
            </button>
          </div>

          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer shrink-0"
            title="Refresh Data"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* =========================================================================
           MAIN 2-COLUMN SPLIT-PANE WORKSPACE
           ========================================================================= */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3 bg-slate-100 min-h-0">

        {/* =========================================================================
             LEFT COLUMN (MASTER TASK QUEUE): 56% WIDTH
             ========================================================================= */}
        <section className="w-[56%] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0">

          {/* Filter Toolbar - ALWAYS VISIBLE */}
          <div className="p-3 border-b border-slate-200 bg-white space-y-2 shrink-0">
            <div className="flex items-center gap-2 text-xs">
              {/* 1. Search Bar (Compact) */}
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search task, code, staff..."
                  className="w-full pl-7.5 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    title="Clear search text"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 2. Project Filter Select */}
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 w-[140px] shrink-0 truncate focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
              >
                {jobOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* 3. Submission Date Filter */}
              <div className="relative w-[135px] shrink-0">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  title="Filter by Submission / Update Date"
                  className={cn(
                    "w-full px-2 py-1.5 bg-slate-50 border rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer transition",
                    selectedDate ? "border-purple-300 bg-purple-50/50 text-purple-900 font-bold" : "border-slate-200"
                  )}
                />
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate("")}
                    className="absolute right-6 top-2 text-slate-400 hover:text-rose-600 cursor-pointer p-0.5"
                    title="Clear date filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* 4. Reset Button */}
              {(searchQuery.trim() || selectedJobId || selectedDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedJobId("");
                    setSelectedDate("");
                  }}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs shrink-0 cursor-pointer transition"
                  title="Clear All Filters"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* MASTER TABLE / EMPTY STATES */}
          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 flex flex-col">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-7 h-7 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100 shadow-2xs">
                  {searchQuery || selectedJobId ? <Search className="w-6 h-6" /> : <Award className="w-6 h-6" />}
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {searchQuery || selectedJobId ? "No Matching Tasks Found" : "No Tasks in This Category"}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    {searchQuery || selectedJobId
                      ? `No deliverables matched your filter criteria.`
                      : `There are currently no tasks in the '${reviewTab}' review tab.`}
                  </p>
                </div>
                {(searchQuery || selectedJobId) && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); setSelectedJobId(""); }}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer"
                  >
                    Clear Search Filters
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left text-sm table-fixed">
                <thead className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                  <tr>
                    <th className="py-2.5 px-3 w-[40%]">TASK TITLE & AUDIT</th>
                    <th className="py-2.5 px-2.5 w-[24%]">ASSIGNEE</th>
                    <th className="py-2.5 px-2 text-center w-[18%]">DELIVERABLES</th>
                    <th className="py-2.5 px-3 text-center w-[18%]">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
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
                          isSelected
                            ? "bg-purple-50/80 border-l-4 border-purple-600 hover:bg-purple-50"
                            : "hover:bg-slate-50 border-l-4 border-transparent"
                        )}
                      >
                        <td className="py-2.5 px-3 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-purple-700 text-xs shrink-0">
                              {taskCode}
                            </span>
                            <span className="font-bold text-slate-900 text-xs truncate max-w-[200px]">
                              {task.title}
                            </span>
                            {rejectionCount > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-extrabold"
                                title={`This deliverable has been rejected ${rejectionCount} time(s)`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                                <span>{rejectionCount}x Rejected</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                            {parentJob}
                          </p>
                        </td>
                        <td className="py-2.5 px-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <UserAvatar
                              avatarUrl={task.assignee?.avatar_url || task.assignee_avatar}
                              fullName={empName}
                              size="xs"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-xs truncate">{empName}</p>
                              <p className="text-[10px] text-slate-400 truncate">Staff</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold text-[11px]">
                            <Paperclip className="w-3 h-3 text-purple-600" />
                            <span>{filesCount} File{filesCount !== 1 ? "s" : ""}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {taskJobFrozen ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300 text-[9px] font-extrabold uppercase whitespace-nowrap">
                              <PauseCircle className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                              <span>FROZEN ({task.job.status})</span>
                            </span>
                          ) : task.status === "REVIEWING" ? (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-[9px] font-extrabold uppercase whitespace-nowrap">
                              PENDING QA
                            </span>
                          ) : task.status === "COMPLETED" ? (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-extrabold uppercase whitespace-nowrap">
                              APPROVED
                            </span>
                          ) : task.status === "IN_PROGRESS" ? (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-extrabold uppercase whitespace-nowrap">
                              IN REWORK
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-extrabold uppercase whitespace-nowrap">
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
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
            <span>Showing {tasks.length} deliverables in '{reviewTab}' tab</span>
            <span className="font-semibold text-slate-700">Click any task to inspect details</span>
          </div>
        </section>

        {/* =========================================================================
               RIGHT COLUMN (TASK QA INSPECTION PANE): 44% WIDTH
               ========================================================================= */}
        <section className="w-[44%] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0">
          {selectedTask ? (
            <>
              {/* Right Pane Header */}
              <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between shrink-0">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono text-[11px] font-extrabold border border-purple-200">
                      {selectedTask.code || `TSK-${selectedTask.id}`}
                    </span>
                    {isFrozen ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[9px] font-extrabold uppercase border border-slate-300">
                        <PauseCircle className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                        <span>REVIEW FROZEN ({selectedTask.job?.status || 'ON_HOLD'})</span>
                      </span>
                    ) : selectedTask.status === "REVIEWING" ? (
                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[9px] font-extrabold uppercase border border-purple-200">
                        READY FOR QA INSPECTION
                      </span>
                    ) : selectedTask.status === "COMPLETED" ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-extrabold uppercase border border-emerald-200">
                        QA PASSED & ACCEPTED
                      </span>
                    ) : selectedTask.status === "IN_PROGRESS" ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[9px] font-extrabold uppercase border border-amber-200">
                        IN REWORK / REVISION
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[9px] font-extrabold uppercase border border-slate-200">
                        {selectedTask.status}
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-extrabold text-slate-900">{selectedTask.title}</h2>
                  <p className="text-[11px] text-slate-500 font-mono">{jobTitle}</p>
                </div>
              </div>

              {/* Right Pane Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar text-xs text-slate-700 min-h-0">

                {/* 🟣 HERO BANNER THEO TRẠNG THÁI */}
                {isFrozen ? (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 backdrop-blur-xs flex items-center justify-center text-amber-300 shadow-inner shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-amber-200 font-bold uppercase tracking-wider">Project {selectedTask.job?.status || 'ON_HOLD'} • Review Paused</p>
                        <p className="text-sm font-extrabold leading-tight mt-0.5">QA Inspection Temporarily Frozen</p>
                      </div>
                    </div>

                    <div className="text-right bg-white/10 px-2.5 py-1 rounded-xl border border-white/20 shrink-0">
                      <p className="text-[9px] text-slate-200 font-semibold">Project State</p>
                      <p className="font-mono font-extrabold text-xs text-amber-300 mt-0.5 uppercase">
                        {selectedTask.job?.status || "ON_HOLD"}
                      </p>
                    </div>
                  </div>
                ) : selectedTask.status === "REVIEWING" ? (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner shrink-0">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-purple-100 font-bold uppercase tracking-wider">Tier 1 • Deliverables QA</p>
                        <p className="text-sm font-extrabold leading-tight mt-0.5">Submitted for QA Acceptance</p>
                      </div>
                    </div>

                    <div className="text-right bg-white/10 px-2.5 py-1 rounded-xl border border-white/20 shrink-0">
                      <p className="text-[9px] text-purple-100 font-semibold">Submitted On</p>
                      <p className="font-mono font-extrabold text-xs text-white mt-0.5">
                        {formatDateSafe(submittedDate)}
                      </p>
                    </div>
                  </div>
                ) : selectedTask.status === "COMPLETED" ? (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider">Accepted Deliverable</p>
                        <p className="text-sm font-extrabold leading-tight mt-0.5">QA Approved & Signed Off</p>
                      </div>
                    </div>

                    <div className="text-right bg-white/10 px-2.5 py-1 rounded-xl border border-white/20 shrink-0">
                      <p className="text-[9px] text-emerald-100 font-semibold">Accepted On</p>
                      <p className="font-mono font-extrabold text-xs text-white mt-0.5">
                        {formatDateSafe(selectedTask.completed_at || selectedTask.updated_at)}
                      </p>
                    </div>
                  </div>
                ) : selectedTask.status === "IN_PROGRESS" ? (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-amber-100 font-bold uppercase tracking-wider">Revision Required</p>
                        <p className="text-sm font-extrabold leading-tight mt-0.5">Deliverable Under Rework</p>
                      </div>
                    </div>

                    <div className="text-right bg-white/10 px-2.5 py-1 rounded-xl border border-white/20 shrink-0">
                      <p className="text-[9px] text-amber-100 font-semibold">Rejections</p>
                      <p className="font-mono font-extrabold text-xs text-white mt-0.5">
                        {selectedTask.rejection_count || 1} Time(s)
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* 👤 ASSIGNEE CARD WITH 💬 DIRECT REALTIME CHAT BUTTON */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Assigned Staff</p>
                      <div className="flex items-center gap-2 mt-1">
                        <UserAvatar
                          avatarUrl={selectedTask.assignee?.avatar_url || selectedTask.assignee_avatar}
                          fullName={assigneeName}
                          size="xs"
                        />
                        <div>
                          <span className="font-extrabold text-slate-900 text-xs">{assigneeName}</span>
                          <span className="text-[10px] text-emerald-600 font-bold ml-1.5 flex items-center gap-1 inline-flex">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 💬 SINGLE 1-ON-1 DIRECT CHAT BUTTON */}
                    <button
                      onClick={handleOpenDirectChat}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                      title="Chat directly with employee in 1-on-1 channel"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Chat Directly</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Priority & Deadline:</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                        {selectedTask.priority || "MEDIUM"} Priority
                      </span>
                      <span className="font-mono font-extrabold text-slate-900 text-xs">
                        {formatDateSafe(selectedTask.deadline)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 🚨 REJECTION & REWORK HISTORY SECTION (NEW AUDIT TRAIL) */}
                {selectedTask.rejection_history && selectedTask.rejection_history.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-rose-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>QA Rejection History ({selectedTask.rejection_history.length} Rejections):</span>
                      </h3>
                      <span className="text-[10px] text-rose-600 font-bold">Audit Records</span>
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                      {selectedTask.rejection_history.map((rej, idx) => (
                        <div
                          key={rej.id || idx}
                          className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-rose-950 flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-rose-200 text-rose-800 text-[10px] flex items-center justify-center font-extrabold">
                                {selectedTask.rejection_history.length - idx}
                              </span>
                              <span>Rejected by {rej.rejected_by}</span>
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">
                              {formatDateSafe(rej.rejected_at, "dd MMM yyyy HH:mm")}
                            </span>
                          </div>
                          <p className="text-xs text-rose-900 font-medium pl-5 leading-relaxed bg-white/60 p-2 rounded-lg border border-rose-100 mt-1">
                            "{rej.reason}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 📎 SUBMITTED HANDOVER FILES (DELIVERABLES) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                      <span>Deliverables & Handover Files ({attachments.length} Files):</span>
                    </h3>
                    <span className="text-[10px] text-purple-600 font-bold">1-Click Download</span>
                  </div>

                  {attachments.length === 0 ? (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>No files attached. Assignee completed task according to instructions.</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {attachments.map((file) => (
                        <div
                          key={file.id}
                          className="p-2.5 bg-slate-50 hover:bg-purple-50/50 border border-slate-200 rounded-xl flex items-center justify-between transition group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                              FILE
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate text-xs group-hover:text-purple-700">
                                {file.file_name || file.name || "Attachment"}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(1)} MB • ` : ""}
                                Submitted {formatDateSafe(file.uploaded_at || file.created_at)}
                              </p>
                            </div>
                          </div>

                          <a
                            href={getFileDownloadUrl(file.file_url || file.file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="p-1.5 bg-white hover:bg-purple-600 text-purple-600 hover:text-white border border-purple-200 rounded-lg transition shadow-2xs cursor-pointer"
                            title="Download Deliverable"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 📝 ASSIGNEE'S HANDOVER NOTE (LỜI NHẮN KHI NỘP BÀI) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>Assignee's Handover Summary Note:</span>
                  </label>

                  <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200/80 text-slate-800 leading-relaxed text-xs font-medium">
                    {latestHandoverNote ? (
                      <p className="text-slate-800 whitespace-pre-wrap">{latestHandoverNote}</p>
                    ) : (
                      <p className="italic text-slate-400">
                        {`"Completed and submitted deliverables for task '${selectedTask.title}'. Ready for manager QA signoff."`}
                      </p>
                    )}
                  </div>
                </div>

                {/* 📋 ORIGINAL TASK ACCEPTANCE CRITERIA */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-extrabold text-slate-900">
                    Original Scope & Acceptance Criteria:
                  </h3>
                  <p className="p-3 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-600 leading-relaxed text-xs">
                    {selectedTask.description || (
                      <span className="italic text-slate-400">Detailed instructions provided on task inception.</span>
                    )}
                  </p>
                </div>

              </div>

              {/* =========================================================================
                     DYNAMIC BOTTOM ACTION FOOTER
                     ========================================================================= */}
              {selectedTask.status === "REVIEWING" && isJobActive && (
                <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0 z-20">
                  <button
                    onClick={handleOpenRejectModal}
                    disabled={rejectMutation.isPending}
                    className="px-3.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    <span>Reject with Fix Notes</span>
                  </button>

                  <button
                    onClick={() => handleApprove(selectedTask)}
                    disabled={approveMutation.isPending}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {approveMutation.isPending ? "Approving..." : "Approve & Complete Task →"}
                    </span>
                  </button>
                </div>
              )}

              {isFrozen && (
                <div className="p-3 border-t border-slate-200 bg-slate-100 flex items-center justify-between gap-3 shrink-0 z-20">
                  <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      QA review is paused because project is in <strong>{selectedTask.job?.status || 'ON_HOLD'}</strong> state.
                    </span>
                  </div>
                  <a
                    href="/manager/jobs"
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Projects →</span>
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-xs">
              Select a task on the left to inspect deliverables
            </div>
          )}
        </section>

      </main>

      {/* =========================================================================
           MODAL: REJECT WITH FIX NOTES & ATTACH REFERENCE DOCUMENTS
           ========================================================================= */}
      <BaseModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Return Task for Rework"
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
              disabled={rejectMutation.isPending || uploadAttachmentMutation.isPending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition"
            >
              {rejectMutation.isPending ? "Sending..." : "Send Fix Request & Attachments"}
            </button>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs">
          <p className="text-slate-600">
            Provide actionable feedback for <strong>{assigneeName}</strong>. The task will transition back to <code>IN_PROGRESS</code>.
          </p>

          <InputField
            label="Fix Instructions / Rejection Reasons *"
            placeholder="Explain what needs to be fixed or adjusted in detail..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            multiline
            rows={3}
          />

          {/* Reference Material Uploader */}
          <div className="space-y-2">
            <label className="font-extrabold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FilePlus className="w-3.5 h-3.5 text-purple-600" />
                <span>Attach Reference Materials / Guidelines:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Optional</span>
            </label>

            {referenceFile ? (
              <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                    REF
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate text-xs">{referenceFile.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {(referenceFile.size / 1024 / 1024).toFixed(2)} MB • Reference Guide
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setReferenceFile(null)}
                  className="text-rose-500 hover:text-rose-700 text-xs font-bold p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-200 hover:border-purple-400 p-3 rounded-xl text-center bg-slate-50/50 cursor-pointer transition flex flex-col items-center justify-center gap-1">
                <UploadCloud className="w-5 h-5 text-purple-600" />
                <span className="text-[11px] text-slate-600">
                  Click to select reference guide or <strong className="text-purple-600">Browse</strong>
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setReferenceFile(e.target.files[0]);
                  }}
                />
              </label>
            )}
          </div>
        </div>
      </BaseModal>

      {/* =========================================================================
           💬 FLOATING 1-ON-1 DIRECT REALTIME CHAT WINDOW (CONNECTED TO /api/chat/)
           ========================================================================= */}
      {quickChatOpen && (
        <div className="fixed bottom-6 right-6 w-96 bg-white rounded-3xl border border-slate-300 shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          {/* Chat Header */}
          <div className="p-3.5 bg-[#0A1128] text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <UserAvatar
                avatarUrl={selectedTask?.assignee?.avatar_url || selectedTask?.assignee_avatar}
                fullName={assigneeName}
                size="xs"
              />
              <div>
                <h3 className="font-extrabold text-xs text-white leading-tight">
                  {assigneeName}
                </h3>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online • Direct Chat Channel
                </p>
              </div>
            </div>
            <button
              onClick={() => setQuickChatOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Messages Body */}
          <div className="p-4 h-72 overflow-y-auto space-y-3 custom-scrollbar text-xs bg-slate-50">
            <div className="text-center">
              <span className="text-[10px] font-mono text-slate-500 bg-slate-200/80 px-2.5 py-0.5 rounded-full">
                1-on-1 Direct Chat with {assigneeName}
              </span>
            </div>

            {isChatLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : directMessages.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-[11px] italic">
                No previous chat messages with {assigneeName}. Send a message below to ask about this task!
              </div>
            ) : (
              directMessages.map((msg) => {
                const isMe =
                  msg.is_mine !== undefined
                    ? msg.is_mine
                    : msg.sender?.id === currentUser?.id || msg.sender_id === currentUser?.id;
                return (
                  <div
                    key={msg.id || Math.random()}
                    className={cn("flex items-start gap-2", isMe ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "p-3 rounded-2xl max-w-[85%] leading-relaxed shadow-2xs",
                        isMe
                          ? "bg-blue-600 text-white rounded-tr-xs"
                          : "bg-white text-slate-800 border border-slate-200 rounded-tl-xs"
                      )}
                    >
                      <p>{msg.content}</p>
                      <p
                        className={cn(
                          "text-[9px] mt-1 font-mono text-right",
                          isMe ? "text-blue-200" : "text-slate-400"
                        )}
                      >
                        {formatDateSafe(msg.created_at, "HH:mm")}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatMessagesEndRef} />
          </div>

          {/* Chat Input Box */}
          <div className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder={`Message ${assigneeName}...`}
              disabled={isSendingMessage || isChatLoading}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendDirectMessage();
                }
              }}
            />
            <button
              onClick={handleSendDirectMessage}
              disabled={isSendingMessage || !chatMessage.trim() || isChatLoading}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Send Message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
