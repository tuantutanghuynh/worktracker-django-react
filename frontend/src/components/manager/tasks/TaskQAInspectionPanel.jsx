import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PauseCircle,
  Paperclip,
  Download,
  MessageSquare,
  MessageCircle,
  Clock,
  Check,
  FileText,
} from "lucide-react";
import { format, parseISO } from "date-fns";

import UserAvatar from "../../common/avatar/UserAvatar";
import { cn } from "../../../utils/cn";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function formatDateSafe(dateStr, pattern = "dd MMM yyyy") {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

function getFileDownloadUrl(fileUrl) {
  if (!fileUrl) return "#";
  if (fileUrl.startsWith("http")) return fileUrl;
  return `${API_BASE_URL}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
}

/**
 * TaskQAInspectionPanel - Tabbed QA Workspace cho Manager
 * 
 * Props:
 * - task: Object chi tiết Task
 * - attachments: Array danh sách file nộp
 * - latestHandoverNote: String lời nhắn bàn giao
 * - isFrozen: Boolean
 * - isJobActive: Boolean
 * - onApprove: (task) => void
 * - onOpenRejectModal: () => void
 * - onOpenDirectChat: () => void
 * - isApproving: Boolean
 * - isRejecting: Boolean
 */
export default function TaskQAInspectionPanel({
  task,
  attachments = [],
  latestHandoverNote,
  isFrozen = false,
  isJobActive = true,
  onApprove,
  onOpenRejectModal,
  onOpenDirectChat,
  isApproving = false,
  isRejecting = false,
}) {
  const [activeTab, setActiveTab] = useState("deliverables"); // "deliverables" | "scope"

  if (!task) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs">
        <FileText className="w-8 h-8 text-slate-300 mb-2" />
        <p className="font-semibold text-slate-600">No Task Selected</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Select a task from the list to inspect deliverables.</p>
      </div>
    );
  }

  const assigneeName = task.assignee?.full_name || task.assignee_name || "Unassigned";
  const assigneeAvatar = task.assignee?.avatar_url || task.assignee_avatar;
  const jobTitle = task.job?.job_name || task.job_title || "Project Job";
  const taskCode = task.code || `TSK-${task.id}`;
  const submittedDate = task.updated_at || task.created_at;
  const rejections = task.rejection_history || [];

  return (
    <div className="flex flex-col h-full bg-white text-slate-800">
      
      {/* 1. COMPACT UNIFIED HEADER */}
      <div className="p-4 border-b border-slate-200/90 bg-slate-50/60 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono text-[11px] font-extrabold border border-purple-200">
              {taskCode}
            </span>

            {isFrozen ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-extrabold uppercase border border-slate-300">
                <PauseCircle className="w-3 h-3 text-slate-600 shrink-0" />
                <span>REVIEW FROZEN ({task.job?.status || "ON_HOLD"})</span>
              </span>
            ) : task.status === "REVIEWING" ? (
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-extrabold uppercase border border-purple-200">
                Ready for QA
              </span>
            ) : task.status === "COMPLETED" ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase border border-emerald-200">
                QA Passed
              </span>
            ) : task.status === "IN_PROGRESS" ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase border border-amber-200">
                In Revision
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase border border-slate-200">
                {task.status}
              </span>
            )}
          </div>

          <span className="text-[11px] text-slate-400 font-mono">
            {formatDateSafe(submittedDate)}
          </span>
        </div>

        <h2 className="text-sm font-extrabold text-slate-900 leading-snug">{task.title}</h2>
        <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
          Project: <span className="font-semibold text-slate-700">{jobTitle}</span>
        </p>

        {/* Compact Metadata Row */}
        <div className="mt-3 pt-2.5 border-t border-slate-200/70 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs items-center">
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatar avatarUrl={assigneeAvatar} fullName={assigneeName} size="xs" />
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-semibold leading-none">Assignee</p>
              <p className="text-xs font-bold text-slate-800 truncate leading-tight mt-0.5">{assigneeName}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-slate-400 font-semibold leading-none">Priority & Due</p>
            <p className="text-xs font-bold text-slate-800 leading-tight mt-0.5 flex items-center gap-1.5">
              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-extrabold text-[9px]">
                {task.priority || "MEDIUM"}
              </span>
              <span>{formatDateSafe(task.deadline)}</span>
            </p>
          </div>

          <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
            <button
              type="button"
              onClick={onOpenDirectChat}
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              title="Open 1-on-1 direct chat with assignee"
            >
              <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>Chat 1-on-1</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. TAB NAVIGATION STRIP */}
      <div className="flex items-center border-b border-slate-200 px-4 bg-white text-xs font-bold gap-6 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("deliverables")}
          className={cn(
            "py-2.5 transition flex items-center gap-1.5 cursor-pointer relative",
            activeTab === "deliverables"
              ? "text-blue-600 border-b-2 border-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-900 border-b-2 border-transparent"
          )}
        >
          <Paperclip className="w-3.5 h-3.5" />
          <span>Deliverables & Notes</span>
          {attachments.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
              {attachments.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("scope")}
          className={cn(
            "py-2.5 transition flex items-center gap-1.5 cursor-pointer relative",
            activeTab === "scope"
              ? "text-blue-600 border-b-2 border-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-900 border-b-2 border-transparent"
          )}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Original Scope & Specs</span>
        </button>
      </div>

      {/* 3. SCROLLABLE TAB CONTENTS */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs min-h-0">
        
        {/* TAB 1: DELIVERABLES & QA NOTES */}
        {activeTab === "deliverables" && (
          <div className="space-y-4">
            
            {/* Lời nhắn bàn giao của nhân viên */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Assignee's Handover Summary Note:</span>
              </label>
              <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200/80 text-slate-800 leading-relaxed text-xs font-medium">
                {latestHandoverNote ? (
                  <p className="text-slate-800 whitespace-pre-wrap">{latestHandoverNote}</p>
                ) : (
                  <p className="italic text-slate-400">
                    {`"Completed and submitted deliverables for task '${task.title}'. Ready for manager QA signoff."`}
                  </p>
                )}
              </div>
            </div>

            {/* Danh sách File đính kèm */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                  <span>Deliverables & Handover Files ({attachments.length} Files):</span>
                </h3>
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

            {/* Lịch sử từ chối sửa bài (nếu có) */}
            {rejections.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200/80">
                <h3 className="text-xs font-extrabold text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>QA Rejection History ({rejections.length} Rejections):</span>
                </h3>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {rejections.map((rej, idx) => (
                    <div
                      key={rej.id || idx}
                      className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-rose-950 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-rose-200 text-rose-800 text-[10px] flex items-center justify-center font-extrabold">
                            {rejections.length - idx}
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

          </div>
        )}

        {/* TAB 2: ORIGINAL SCOPE & REQUIREMENTS */}
        {activeTab === "scope" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <h3 className="text-xs font-extrabold text-slate-800">
                Original Scope & Acceptance Criteria:
              </h3>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed text-xs">
                {task.description ? (
                  <p className="whitespace-pre-wrap">{task.description}</p>
                ) : (
                  <span className="italic text-slate-400">Standard operational guidelines provided on task inception.</span>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 4. DYNAMIC STICKY BOTTOM ACTION FOOTER */}
      {task.status === "REVIEWING" && isJobActive && (
        <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenRejectModal}
            disabled={isRejecting || isApproving}
            className="px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Reject with Fix Notes</span>
          </button>

          <button
            type="button"
            onClick={() => onApprove(task)}
            disabled={isApproving || isRejecting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isApproving ? "Approving..." : "Approve & Complete Task →"}</span>
          </button>
        </div>
      )}

      {isFrozen && (
        <div className="p-3 border-t border-slate-200 bg-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              QA review is paused because project is in <strong>{task.job?.status || "ON_HOLD"}</strong> state.
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

    </div>
  );
}
