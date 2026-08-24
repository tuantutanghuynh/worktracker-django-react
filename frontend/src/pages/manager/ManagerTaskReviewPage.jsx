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
  const [selectedJobId, setSelectedJobId] = useState("");
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
    const params = { status: "REVIEWING", page_size: 50, ordering: "-updated_at" };
    if (selectedJobId) params.job_id = selectedJobId;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    return params;
  }, [selectedJobId, searchQuery]);

  const { data: tasksData, isLoading, refetch } = useManagerTasks(queryParams);
  const { data: jobsResponse } = useManagerJobs({ page_size: 100 });

  // Single Task Detail query for accurate timestamps and full descriptions
  const { data: taskDetail } = useManagerTaskDetail(selectedTaskId);

  // Mutations
  const approveMutation = useApproveTask();
  const rejectMutation = useRejectTask();

  // Normalize Tasks list
  const tasks = useMemo(() => {
    if (!tasksData) return [];
    if (Array.isArray(tasksData)) return tasksData;
    if (Array.isArray(tasksData.results)) return tasksData.results;
    return [];
  }, [tasksData]);

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
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0 shadow-2xs z-20">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-mono text-[10px] font-bold border border-purple-200">
              TASK DELIVERABLES QA COCKPIT
            </span>
          </div>
          <h1 className="text-lg font-extrabold text-slate-900 mt-0.5">Task Acceptance & Deliverables Review</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 font-bold text-xs flex items-center gap-2 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
            <span>{tasks.length} Tasks Pending QA</span>
          </div>

          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
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
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by task title, code, assignee, or job..."
                  className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    title="Clear search text"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 max-w-[170px] truncate focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
              >
                {jobOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {(searchQuery.trim() || selectedJobId) && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setSelectedJobId(""); }}
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
                    {searchQuery || selectedJobId ? "No Matching Tasks Found" : "Task QA Queue is Clear!"}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    {searchQuery || selectedJobId
                      ? `No tasks awaiting QA review matched your filter criteria.`
                      : "All submitted task deliverables across all your managed projects have been inspected and accepted."}
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
                      <th className="py-2.5 px-3 w-[38%]">TASK TITLE & PROJECT</th>
                      <th className="py-2.5 px-2.5 w-[26%]">ASSIGNEE</th>
                      <th className="py-2.5 px-2 text-center w-[18%]">DELIVERABLES</th>
                      <th className="py-2.5 px-3 text-center w-[18%]">QA STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {tasks.map((task) => {
                      const isSelected = String(task.id) === String(selectedTaskId);
                      const taskCode = task.code || `TSK-${task.id}`;
                      const empName = task.assignee?.full_name || task.assignee_name || "Unassigned";
                      const parentJob = task.job?.job_name || task.job_title || "Project Job";
                      const filesCount = task.attachment_count ?? task.attachments_count ?? task.attachments?.length ?? 0;

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
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-purple-700 text-xs shrink-0">
                                {taskCode}
                              </span>
                              <span className="font-bold text-slate-900 text-xs truncate">
                                {task.title}
                              </span>
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
                            <span className="inline-block px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-[9px] font-extrabold uppercase whitespace-nowrap">
                              PENDING QA
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
              <span>Showing {tasks.length} tasks awaiting manager QA signoff</span>
              <span className="font-semibold text-slate-700">Click any task to inspect</span>
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
                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[9px] font-extrabold uppercase border border-purple-200">
                        READY FOR QA INSPECTION
                      </span>
                    </div>
                    <h2 className="text-sm font-extrabold text-slate-900">{selectedTask.title}</h2>
                    <p className="text-[11px] text-slate-500 font-mono">{jobTitle}</p>
                  </div>
                </div>

                {/* Right Pane Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar text-xs text-slate-700 min-h-0">
                  
                  {/* 🟣 PROMINENT QA READY HERO BANNER */}
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

                  {/* 👤 ASSIGNEE CARD WITH 💬 DIRECT REALTIME CHAT BUTTON */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Submitted By Assignee</p>
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

                      {/* 💬 REALTIME DIRECT CHAT BUTTON */}
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

                  {/* 📎 SUBMITTED HANDOVER FILES (DELIVERABLES) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                        <span>Submitted Handover Files ({attachments.length} Files):</span>
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
                     FIXED BOTTOM ACTION FOOTER (ALWAYS 100% VISIBLE ON ANY LAPTOP SCREEN!)
                     ========================================================================= */}
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
                <span>Attach Reference Materials / Guidelines (Tài liệu tham khảo):</span>
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
