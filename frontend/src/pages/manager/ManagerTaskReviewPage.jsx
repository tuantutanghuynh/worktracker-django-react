import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";

// Modular Sub-Components
import TaskReviewHeader from "../../components/manager/tasks/TaskReviewHeader";
import TaskReviewQueueList from "../../components/manager/tasks/TaskReviewQueueList";
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

export default function ManagerTaskReviewPage() {
  // Filter States
  const [reviewTab, setReviewTab] = useState("REVIEWING"); // "REVIEWING" | "FROZEN" | "COMPLETED" | "REJECTED" | "ALL"
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // Reject Modal States
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
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
    const qaComment = [...comments].reverse().find((c) => c.content?.includes("[QA Deliverable Submission]"));
    if (qaComment) {
      return qaComment.content.replace("[QA Deliverable Submission]:", "").trim();
    }
    const assigneeComment = [...comments].reverse().find((c) => c.user?.id === selectedTask?.assignee?.id);
    if (assigneeComment) {
      return assigneeComment.content.trim();
    }
    const latest = comments[comments.length - 1];
    return latest?.content?.trim() || null;
  }, [comments, selectedTask]);

  // Auto-advance helper
  const autoAdvanceToNext = (processedId) => {
    const remaining = tasks.filter((t) => String(t.id) !== String(processedId));
    if (remaining.length > 0) {
      setSelectedTaskId(remaining[0].id);
    } else {
      setSelectedTaskId(null);
    }
  };

  // Action handlers
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
    setReferenceFile(null);
    setRejectModalOpen(true);
  };

  const handleConfirmReject = (reason) => {
    if (!selectedTask) return;

    if (referenceFile) {
      const formData = new FormData();
      formData.append("file", referenceFile);
      uploadAttachmentMutation.mutate(formData, {
        onSuccess: () => {
          rejectMutation.mutate(
            { id: selectedTask.id, reason: reason.trim() },
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
            { id: selectedTask.id, reason: reason.trim() },
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
        { id: selectedTask.id, reason: reason.trim() },
        {
          onSuccess: () => {
            setRejectModalOpen(false);
            autoAdvanceToNext(selectedTask.id);
          },
        },
      );
    }
  };

  const handleOpenDirectChat = () => {
    if (!selectedTask) return;
    const targetUserId = selectedTask.assignee?.id || selectedTask.assignee_id;
    if (!targetUserId) {
      toast.error("No assignee assigned to this task.");
      return;
    }
    setQuickChatOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedJobId("");
    setSelectedDate("");
  };

  const assigneeName = selectedTask?.assignee?.full_name || selectedTask?.assignee_name || "Assignee";

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col antialiased bg-slate-100 overflow-hidden rounded-2xl">
      {/* 🌟 Top Header Bar */}
      <TaskReviewHeader
        reviewTab={reviewTab}
        onTabChange={setReviewTab}
        tabCounts={tabCounts}
        onRefresh={() => refetch()}
      />

      {/* 📋 Main 2-Column Split-Pane Workspace */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3 bg-slate-100 min-h-0">
        {/* Left Column: Master Task Queue */}
        <TaskReviewQueueList
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedJobId={selectedJobId}
          onJobChange={setSelectedJobId}
          jobOptions={jobOptions}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onResetFilters={handleResetFilters}
          reviewTab={reviewTab}
        />

        {/* Right Column: Task QA Inspection Pane */}
        <section className="w-[44%] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0">
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

      {/* Modal: Reject / Rework */}
      <TaskRejectReworkModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        assigneeName={assigneeName}
        referenceFile={referenceFile}
        setReferenceFile={setReferenceFile}
        onConfirm={handleConfirmReject}
        isPending={rejectMutation.isPending || uploadAttachmentMutation.isPending}
      />

      {/* 💬 Floating 1-on-1 Direct Chat Window */}
      <FloatingDirectChatWidget
        isOpen={quickChatOpen}
        onClose={() => setQuickChatOpen(false)}
        targetUser={selectedTask?.assignee || { id: selectedTask?.assignee_id, full_name: assigneeName }}
        taskContext={selectedTask ? { id: selectedTask.id, title: selectedTask.title } : null}
      />
    </div>
  );
}
