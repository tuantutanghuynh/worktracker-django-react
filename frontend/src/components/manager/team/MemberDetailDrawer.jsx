import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  MessageSquare,
} from 'lucide-react';
import SideDrawer from '../../common/drawer/SideDrawer';
import StatusBadge from '../../common/badges/StatusBadge';
import PriorityBadge from '../../common/badges/PriorityBadge';
import UserAvatar from '../../common/avatar/UserAvatar';
import { cn } from '../../../utils/cn';
import { useManagerTasks } from '../../../hooks/queries/manager/useManagerTasks';

export default function MemberDetailDrawer({ member, onClose }) {
  const navigate = useNavigate();
  const targetUserId = member?.id || member?.user_id;

  const { data: tasksData, isLoading: tasksLoading } = useManagerTasks(
    targetUserId ? { assignee_id: targetUserId, page_size: 30 } : null
  );

  const memberTasks = useMemo(() => {
    if (!tasksData) return [];
    if (Array.isArray(tasksData)) return tasksData;
    if (Array.isArray(tasksData.results)) return tasksData.results;
    return [];
  }, [tasksData]);

  if (!member) return null;

  return (
    <SideDrawer
      isOpen={Boolean(member)}
      onClose={onClose}
      title={member.full_name || member.email}
      subtitle={member.departmentName || 'General Staff'}
      size="lg"
    >
      <div className="space-y-6 pb-6">
        {/* 👤 Profile Card Header */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4.5 flex items-start gap-4 shadow-2xs">
          <UserAvatar user={member} size="xl" showStatus={true} isOnline={member.is_active} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-900 truncate">
                {member.full_name || member.email}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Staff
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                  member.is_active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                )}
              >
                {member.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{member.email}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{member.phone_number || 'No phone number'}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-700">{member.departmentName}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Joined: {member.joined_date || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ⚡ Quick Action Buttons */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => {
              if (targetUserId) {
                navigate(`/manager/chat?userId=${targetUserId}`);
              } else {
                navigate('/manager/chat');
              }
            }}
            className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Message Employee</span>
          </button>
        </div>

        {/* 📊 Workload Capacity & Utilization Metrics */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Smart Workload Pressure
            </h3>
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider',
                member.workloadStatus === 'OVERLOADED' && 'bg-rose-50 text-rose-700 border-rose-200',
                member.workloadStatus === 'BALANCED' && 'bg-amber-50 text-amber-700 border-amber-200',
                member.workloadStatus === 'AVAILABLE' && 'bg-emerald-50 text-emerald-700 border-emerald-200'
              )}
            >
              {member.workloadStatus}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600">Workload Capacity:</span>
              <span
                className={cn(
                  member.workloadStatus === 'OVERLOADED' && 'text-rose-600',
                  member.workloadStatus === 'BALANCED' && 'text-amber-600',
                  member.workloadStatus === 'AVAILABLE' && 'text-emerald-600'
                )}
              >
                {member.capacityPct || 0}% (~{member.dailyRequiredHours || 0}h / day)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  member.workloadStatus === 'OVERLOADED' && 'bg-rose-500',
                  member.workloadStatus === 'BALANCED' && 'bg-amber-500',
                  member.workloadStatus === 'AVAILABLE' && 'bg-emerald-500'
                )}
                style={{ width: `${Math.min(member.capacityPct || 0, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 text-xs border-t border-slate-200">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Capacity %</p>
              <p className="text-base font-extrabold text-slate-900 mt-0.5">{member.capacityPct || 0}%</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Active Tasks</p>
              <p className="text-base font-extrabold text-blue-700 mt-0.5">{member.activeTasks || 0}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Active Jobs</p>
              <p className="text-base font-extrabold text-indigo-700 mt-0.5">{member.activeJobs || 0}</p>
            </div>
          </div>
        </div>

        {/* 📋 Assigned Tasks Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-purple-600" />
              <span>Assigned Tasks Under Your Management</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-400">
              {memberTasks.length} task{memberTasks.length !== 1 ? 's' : ''}
            </span>
          </div>

          {tasksLoading ? (
            <div className="py-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : memberTasks.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-1">
              <p className="text-xs font-bold text-slate-700">No active tasks in your projects</p>
              <p className="text-[11px] text-slate-400">
                This member is currently not assigned to any tasks under your managed projects.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
              {memberTasks.map((task) => {
                const taskCode = task.code || `TSK-${task.id}`;
                const jobName = task.job?.job_name || task.job_title || 'Project';
                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-purple-300 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs font-bold text-purple-700 shrink-0">
                          {taskCode}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {task.title}
                        </h4>
                      </div>
                      <StatusBadge status={task.status} />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span className="truncate max-w-[200px]">{jobName}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <PriorityBadge priority={task.priority} />
                        {task.deadline && (
                          <span className="font-mono text-[10px] text-slate-400">
                            {task.deadline}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SideDrawer>
  );
}
