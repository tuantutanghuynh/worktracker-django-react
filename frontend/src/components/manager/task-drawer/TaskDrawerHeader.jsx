import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  FileText,
  CheckCircle2,
  RotateCcw,
  UserCheck,
  PauseCircle,
  ArrowRight,
  Flame,
  Calendar,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import UserAvatar from '../../common/avatar/UserAvatar';
import { cn } from '../../../utils/cn';

function formatDateSafe(dateStr, formatPattern = 'dd/MM/yyyy') {
  if (!dateStr) return 'No date';
  try {
    return format(parseISO(dateStr), formatPattern);
  } catch {
    return dateStr;
  }
}

export default function TaskDrawerHeader({
  task,
  isEditing,
  setIsEditing,
  closeTaskDrawer,
  onChangeTaskStatus,
  isChangingStatus,
}) {
  const navigate = useNavigate();
  if (!task) return null;

  return (
    <div className="space-y-3">
      {/* 🌟 1. BANNER CẢNH BÁO LUÂN CHUYỂN NHÂN SỰ (PHASE-OUT) */}
      {task.description && (task.description.includes('[LOCKED_FOR_REASSIGNMENT]') || task.description.includes('[PHASE_OUT]')) && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-amber-950 text-xs">Staff Transition Warning (Phase-out)</p>
              <p className="text-[11px] text-amber-700">
                This employee is undergoing project transfer. Please re-assign this task to another active team member.
              </p>
            </div>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shrink-0 shadow-2xs flex items-center gap-1"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Re-assign</span>
            </button>
          )}
        </div>
      )}

      {/* ⚠️ 1.1 BANNER CẢNH BÁO CLIENT INACTIVE / PROJECT FROZEN */}
      {task.job && (task.job.client_is_active === false || task.job.status === 'ON_HOLD') && (
        <div className="p-3 bg-amber-500/10 border border-amber-300 rounded-xl flex items-center justify-between gap-3 shadow-2xs text-amber-950">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-800 flex items-center justify-center font-bold shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-amber-950 text-xs">Project & Task Frozen ({task.job.status || 'ON_HOLD'})</p>
              <p className="text-[11px] text-amber-800">
                {task.job.client_is_active === false
                  ? 'The client for this project is inactive. Task status transitions are temporarily locked.'
                  : `Project is in ${task.job.status} state. Task transitions are paused until project is Active.`}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
            <PauseCircle className="w-3 h-3 text-amber-700" />
            <span>Frozen</span>
          </span>
        </div>
      )}

      {/* 🌟 1.2 BANNER TRẠNG THÁI REVIEWING / COMPLETED / CANCELLED */}
      {task.status === 'REVIEWING' && (
        <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-purple-950 text-xs truncate">Task Deliverable in QA Review Queue</p>
              <p className="text-[11px] text-purple-700 truncate">
                Assignee <strong>{task.assignee?.full_name || 'Employee'}</strong> has submitted work for inspection.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              closeTaskDrawer();
              navigate('/manager/tasks/review');
            }}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shrink-0 shadow-2xs flex items-center gap-1"
          >
            <span>Go to QA Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {task.status === 'COMPLETED' && (
        <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-emerald-950 text-xs">Task Completed & QA Verified</p>
              <p className="text-[11px] text-emerald-700 font-mono">
                Completed at {formatDateSafe(task.completed_at || task.updated_at, 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onChangeTaskStatus({
                toStatus: 'IN_PROGRESS',
                reason: 'Reopened for additional rework by Manager',
              })
            }
            disabled={isChangingStatus}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-lg border border-slate-200 text-xs shadow-2xs transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
            <span>Reopen for Rework</span>
          </button>
        </div>
      )}

      {task.status === 'CANCELLED' && (
        <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-rose-950 text-xs">Task is Cancelled</p>
              <p className="text-[11px] text-rose-700">This deliverable is currently cancelled.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onChangeTaskStatus({
                toStatus: 'TODO',
                reason: 'Task reactivated to To Do by Manager',
              })
            }
            disabled={isChangingStatus}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-2xs transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore to TODO</span>
          </button>
        </div>
      )}

      {/* 📋 2. THANH THUỘC TÍNH CỐT LÕI (4-COLUMN CLEAN STRIP) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
        <div>
          <span className="text-slate-400 font-semibold text-[11px] block">Status</span>
          <span
            className={cn(
              'inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border uppercase tracking-wider',
              task.status === 'TODO' && 'bg-blue-50 text-blue-700 border-blue-200',
              task.status === 'IN_PROGRESS' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
              task.status === 'REVIEWING' && 'bg-purple-50 text-purple-700 border-purple-200',
              task.status === 'COMPLETED' && 'bg-orange-50 text-orange-700 border-orange-200',
              task.status === 'CANCELLED' && 'bg-rose-50 text-rose-700 border-rose-200'
            )}
          >
            {task.status}
          </span>
        </div>

        <div>
          <span className="text-slate-400 font-semibold text-[11px] block">Priority</span>
          <span
            className={cn(
              'inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-extrabold uppercase border',
              task.priority === 'HIGH'
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : task.priority === 'LOW'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            )}
          >
            {task.priority === 'HIGH' && <Flame className="w-3 h-3 text-rose-500" />}
            {task.priority || 'MEDIUM'}
          </span>
        </div>

        <div>
          <span className="text-slate-400 font-semibold text-[11px] block">Assignee</span>
          {(() => {
            const isUnassigned =
              !task.assignee ||
              task.assignee?.role === 'MANAGER' ||
              (task.job?.manager && (task.assignee?.id === task.job.manager.id || task.assignee?.email === task.job.manager.email));

            if (isUnassigned) {
              return (
                <div className="flex items-center gap-1.5 mt-1 text-amber-700">
                  <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 font-extrabold text-[9px] flex items-center justify-center shrink-0">
                    ?
                  </div>
                  <span className="font-bold text-xs text-amber-700 italic">
                    Unassigned
                  </span>
                </div>
              );
            }

            return (
              <div className="flex items-center gap-1.5 mt-1">
                {task.assignee && <UserAvatar user={task.assignee} size="xs" />}
                <span className="font-bold text-slate-900 text-xs truncate max-w-[120px]">
                  {task.assignee?.full_name || task.assignee?.email}
                </span>
              </div>
            );
          })()}
        </div>

        <div>
          <span className="text-slate-400 font-semibold text-[11px] block">Deadline</span>
          <div className="flex items-center gap-1.5 mt-1 text-slate-800 font-semibold">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-mono font-bold text-xs">{formatDateSafe(task.deadline)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
