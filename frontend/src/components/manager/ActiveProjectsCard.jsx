import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ArrowRight, Calendar, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { differenceInDays, format, parseISO } from 'date-fns';
import { useRecentJobsStore } from '../../stores/useRecentJobsStore';
import { cn } from '../../utils/cn';

export default function ActiveProjectsCard({ jobs = [], isLoading = false }) {
  const navigate = useNavigate();
  const addRecentJob = useRecentJobsStore((state) => state.addRecentJob);

  const activeJobs = jobs
    .filter((j) => j.status === 'ACTIVE' || j.status === 'PLANNING' || j.status === 'ON_HOLD')
    .slice(0, 4);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Briefcase className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Active Projects Health</h3>
          </div>
          <button
            onClick={() => navigate('/manager/jobs')}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3.5 mt-3.5">
          {isLoading ? (
            <div className="py-8 text-center text-slate-400 text-xs">Loading projects...</div>
          ) : activeJobs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">No active projects found.</div>
          ) : (
            activeJobs.map((job) => {
              const daysLeft = job.deadline
                ? differenceInDays(parseISO(job.deadline), new Date())
                : null;

              let healthBadge = {
                label: 'On Track',
                color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              };

              if (daysLeft !== null && daysLeft < 0) {
                healthBadge = {
                  label: `${Math.abs(daysLeft)}d Overdue`,
                  color: 'bg-rose-50 text-rose-700 border-rose-200',
                };
              } else if (daysLeft !== null && daysLeft <= 7) {
                healthBadge = {
                  label: `${daysLeft}d left`,
                  color: 'bg-amber-50 text-amber-700 border-amber-200',
                };
              }

              const progress = job.progress_percent ?? (job.status === 'COMPLETED' ? 100 : 0);

              return (
                <div
                  key={job.id}
                  onClick={() => {
                    addRecentJob(job);
                    navigate(`/manager/jobs/${job.id}`);
                  }}
                  className="p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                        {job.job_code || `JOB-${job.id}`}
                      </span>
                      <p className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-600 transition">
                        {job.job_name}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0',
                        healthBadge.color
                      )}
                    >
                      {healthBadge.label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span>Deliverables progress</span>
                      <span className="font-bold text-slate-700">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          progress === 100
                            ? 'bg-emerald-500'
                            : progress > 50
                              ? 'bg-blue-600'
                              : 'bg-indigo-500'
                        )}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>Managing {activeJobs.length} active initiatives</span>
        <span className="text-blue-600 font-bold">100% scoped to you</span>
      </div>
    </div>
  );
}
