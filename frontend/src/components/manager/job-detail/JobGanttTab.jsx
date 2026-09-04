import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Target,
  ZoomIn,
  ZoomOut,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import {
  format,
  parseISO,
  differenceInCalendarDays,
  addDays,
  isSameDay,
  isWeekend,
  isValid,
  startOfDay,
} from 'date-fns';
import { cn } from '../../../utils/cn';
import UserAvatar from '../../common/avatar/UserAvatar';

/**
 * Module: components/manager/job-detail/JobGanttTab
 * Description: Clean, high-performance Gantt timeline with minimalist toolbar, dynamic zoom, auto-focus, and safe task drawer interaction.
 */

export default function JobGanttTab({
  job,
  tasks = [],
  tasksLoading = false,
  openTaskDrawer,
}) {
  const timelineScrollRef = useRef(null);
  const containerRef = useRef(null);

  // Dynamic Toolbar & View States
  const [dayWidth, setDayWidth] = useState(36);
  const [showWbsList, setShowWbsList] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const today = startOfDay(new Date());

  // 1. Calculate Full Gantt Timeline Range
  const { timelineStart, totalDays, daysList, earliestTaskDate } = useMemo(() => {
    let minDate = job?.start_date ? parseISO(job.start_date) : new Date();
    let maxDate = job?.deadline ? parseISO(job.deadline) : addDays(minDate, 30);

    if (!isValid(minDate)) minDate = new Date();
    if (!isValid(maxDate) || maxDate <= minDate) maxDate = addDays(minDate, 30);

    let firstTask = null;

    tasks.forEach((t) => {
      if (t.start_date) {
        const s = parseISO(t.start_date);
        if (isValid(s)) {
          if (s < minDate) minDate = s;
          if (s > maxDate) maxDate = s;
          if (!firstTask || s < firstTask) firstTask = s;
        }
      } else if (t.created_at) {
        const c = parseISO(t.created_at);
        if (isValid(c)) {
          if (c < minDate) minDate = c;
          if (!firstTask || c < firstTask) firstTask = c;
        }
      }
      if (t.deadline) {
        const d = parseISO(t.deadline);
        if (isValid(d)) {
          if (d > maxDate) maxDate = d;
          if (d < minDate) minDate = d;
          if (!firstTask || d < firstTask) firstTask = d;
        }
      }
    });

    const paddedStart = startOfDay(addDays(minDate, -3));
    const paddedEnd = startOfDay(addDays(maxDate, 4));
    const count = Math.max(differenceInCalendarDays(paddedEnd, paddedStart) + 1, 14);

    const days = [];
    for (let i = 0; i < count; i++) {
      const current = addDays(paddedStart, i);
      days.push({
        date: current,
        dayStr: format(current, 'dd/MM'),
        dayName: format(current, 'EEE'),
        dayNumber: format(current, 'dd'),
        monthName: format(current, 'MMM yyyy'),
        isWeekend: isWeekend(current),
        isToday: isSameDay(current, today),
        index: i,
      });
    }

    return {
      timelineStart: paddedStart,
      timelineEnd: paddedEnd,
      totalDays: count,
      daysList: days,
      earliestTaskDate: firstTask || minDate,
    };
  }, [job, tasks, today]);

  // 2. Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        !searchQuery ||
        (t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.code && t.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.assignee?.full_name &&
          t.assignee.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'OVERDUE'
          ? t.deadline && parseISO(t.deadline) < today && t.status !== 'COMPLETED'
          : t.status === statusFilter);

      return matchSearch && matchStatus;
    });
  }, [tasks, searchQuery, statusFilter, today]);

  // 3. Compute Coordinates
  const calculatedTasks = useMemo(() => {
    return filteredTasks.map((t, idx) => {
      const taskDeadline = t.deadline ? startOfDay(parseISO(t.deadline)) : startOfDay(addDays(timelineStart, 7));

      let taskStart = null;
      if (t.start_date) {
        const parsedStart = startOfDay(parseISO(t.start_date));
        if (isValid(parsedStart)) {
          taskStart = parsedStart;
        }
      } else if (t.created_at) {
        const parsedCreated = startOfDay(parseISO(t.created_at));
        if (isValid(parsedCreated)) {
          taskStart = parsedCreated;
        }
      }

      if (!taskStart) {
        if (job?.start_date) {
          const parsedJobStart = startOfDay(parseISO(job.start_date));
          if (isValid(parsedJobStart) && parsedJobStart <= taskDeadline) {
            taskStart = parsedJobStart;
          }
        }
      }

      if (!taskStart || taskStart > taskDeadline) {
        taskStart = taskDeadline;
      }

      if (taskStart < timelineStart) {
        taskStart = timelineStart;
      }

      const startOffsetDays = Math.max(differenceInCalendarDays(taskStart, timelineStart), 0);
      const durationDays = Math.max(differenceInCalendarDays(taskDeadline, taskStart) + 1, 1);

      const leftPx = startOffsetDays * dayWidth;
      const widthPx = Math.max(durationDays * dayWidth, dayWidth);

      const isOverdue = t.deadline && parseISO(t.deadline) < today && t.status !== 'COMPLETED';

      const progressPct =
        t.status === 'COMPLETED'
          ? 100
          : t.status === 'REVIEWING'
          ? 80
          : t.status === 'IN_PROGRESS'
          ? 50
          : 0;

      return {
        ...t,
        taskStart,
        taskDeadline,
        startOffsetDays,
        durationDays,
        leftPx,
        widthPx,
        isOverdue,
        progressPct,
        rowIndex: idx,
      };
    });
  }, [filteredTasks, timelineStart, dayWidth, today, job?.start_date]);

  // 4. Auto-Scroll to Active Tasks
  const scrollToActiveTasks = () => {
    if (earliestTaskDate && timelineScrollRef.current) {
      const offsetDays = Math.max(differenceInCalendarDays(earliestTaskDate, timelineStart), 0);
      timelineScrollRef.current.scrollTo({
        left: Math.max(offsetDays * dayWidth - 100, 0),
        behavior: 'smooth',
      });
    }
  };

  const scrollToToday = () => {
    const todayIndex = daysList.findIndex((d) => d.isToday);
    if (todayIndex !== -1 && timelineScrollRef.current) {
      timelineScrollRef.current.scrollTo({
        left: Math.max(todayIndex * dayWidth - 250, 0),
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToActiveTasks();
    }, 200);
    return () => clearTimeout(timer);
  }, [dayWidth]);

  // 5. Dynamic Zoom Controls
  const handleZoomIn = () => {
    setDayWidth((prev) => Math.min(prev + 8, 80));
  };

  const handleZoomOut = () => {
    setDayWidth((prev) => Math.max(prev - 8, 12));
  };

  const handleFitAll = () => {
    if (containerRef.current) {
      const availableWidth =
        containerRef.current.offsetWidth - (showWbsList ? 330 : 0) - 40;
      if (availableWidth > 0 && totalDays > 0) {
        const optimalWidth = Math.max(Math.floor(availableWidth / totalDays), 12);
        setDayWidth(optimalWidth);
        if (timelineScrollRef.current) {
          timelineScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
      }
    }
  };

  // 6. Safe Task Drawer Trigger
  const handleTaskClick = (task) => {
    if (!openTaskDrawer) return;
    const targetId = typeof task === 'object' ? task.id : task;
    openTaskDrawer(targetId);
  };

  const timelineCanvasWidth = totalDays * dayWidth;

  return (
    <div ref={containerRef} className="space-y-3.5 text-slate-800">
      
      {/* ============================================================
          1. SLEEK MINIMALIST TOOLBAR
         ============================================================ */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        
        {/* Left Controls: Show/Hide List + Search + Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Toggle Task List Button */}
          <button
            onClick={() => setShowWbsList(!showWbsList)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs border',
              showWbsList
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            )}
            title={showWbsList ? 'Collapse Task Directory' : 'Expand Task Directory'}
          >
            {showWbsList ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
            <span>{showWbsList ? 'Hide Task List' : 'Show Task List'}</span>
          </button>

          {/* Search Input */}
          <div className="relative w-40 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search task or assignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-inner"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shadow-inner">
            {['ALL', 'IN_PROGRESS', 'REVIEWING', 'COMPLETED', 'TODO'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer uppercase',
                  statusFilter === st
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {st === 'ALL' ? 'All' : st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Right Controls: Zoom Group + Focus Tasks + Today */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Zoom Engine Group */}
          <div className="flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shadow-inner">
            <button
              onClick={handleZoomOut}
              disabled={dayWidth <= 12}
              className="p-1 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleFitAll}
              className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-white hover:text-blue-700 transition cursor-pointer"
              title="Fit all days to screen width"
            >
              Fit All
            </button>

            <button
              onClick={handleZoomIn}
              disabled={dayWidth >= 80}
              className="p-1 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Focus on Active Tasks Button */}
          <button
            onClick={scrollToActiveTasks}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
            title="Focus on earliest active tasks"
          >
            <Target className="w-3.5 h-3.5 text-blue-600" />
            <span>Tasks</span>
          </button>

          {/* Jump to Today Button */}
          <button
            onClick={scrollToToday}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
            title="Jump to Today's marker"
          >
            <span>Today</span>
          </button>

        </div>

      </div>

      {/* ============================================================
          2. MAIN GANTT CANVAS (SPLIT-PANE: WBS TABLE + TIMELINE GRID)
         ============================================================ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs relative">
        
        <div className="flex items-stretch overflow-x-auto">
          
          {/* CỘT TRÁI (WBS DIRECTORY): Cố định 330px, có thể ẩn hoàn toàn */}
          {showWbsList && (
            <div className="w-[330px] shrink-0 border-r border-slate-200 bg-white z-20 sticky left-0 shadow-sm transition-all duration-300">
              
              {/* Table Header */}
              <div className="h-12 border-b border-slate-200 px-4 flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider bg-slate-50/90">
                <span>Task Code & Title</span>
                <span>Assignee</span>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-slate-100 text-xs">
                {calculatedTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleTaskClick(t)}
                    className="h-[42px] px-3.5 flex items-center justify-between cursor-pointer transition hover:bg-blue-50/40 group"
                    title="Click to view task details in Drawer"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      {t.code && (
                        <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 shrink-0">
                          {t.code}
                        </span>
                      )}
                      <span className="font-semibold text-slate-800 group-hover:text-blue-600 truncate">
                        {t.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-right">
                      {t.assignee ? (
                        <UserAvatar
                          user={t.assignee}
                          src={t.assignee.avatar_url || t.assignee.avatar}
                          fullName={t.assignee.full_name || t.assignee.email}
                          size="xs"
                          className="shrink-0 shadow-2xs"
                        />
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                      )}
                    </div>
                  </div>
                ))}

                {calculatedTasks.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No tasks matched your search or status filter.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* CỘT PHẢI (TIMELINE CANVAS): Cuộn ngang mượt mà */}
          <div
            ref={timelineScrollRef}
            className="flex-1 min-w-[500px] overflow-x-auto relative bg-slate-50/20"
          >
            <div style={{ width: `${timelineCanvasWidth}px` }} className="relative">
              
              {/* Timeline Sticky Header: Date Ticks */}
              <div className="h-12 border-b border-slate-200 flex bg-slate-50/95 sticky top-0 z-10 select-none">
                {daysList.map((d) => (
                  <div
                    key={d.index}
                    style={{ width: `${dayWidth}px` }}
                    className={cn(
                      'shrink-0 border-r border-slate-200/80 text-center py-1.5 flex flex-col justify-center overflow-hidden',
                      d.isToday ? 'bg-blue-100/50 text-blue-800' : d.isWeekend ? 'bg-slate-100/50' : ''
                    )}
                  >
                    {dayWidth >= 28 && (
                      <span className="text-[9px] text-slate-400 font-semibold block leading-tight truncate">
                        {d.dayName}
                      </span>
                    )}
                    <span
                      className={cn(
                        'text-[11px] font-bold leading-tight truncate',
                        d.isToday ? 'text-blue-700 font-extrabold' : 'text-slate-700'
                      )}
                    >
                      {d.dayNumber}
                    </span>
                  </div>
                ))}
              </div>

              {/* Background Grid Columns & Today Line */}
              <div className="absolute inset-0 top-12 pointer-events-none flex">
                {daysList.map((d) => (
                  <div
                    key={d.index}
                    style={{ width: `${dayWidth}px` }}
                    className={cn(
                      'shrink-0 border-r border-slate-200/50 relative',
                      d.isToday ? 'bg-blue-50/40 border-r-2 border-blue-500' : d.isWeekend ? 'bg-slate-50/60' : ''
                    )}
                  >
                    {d.isToday && (
                      <span className="absolute top-0 -left-1 w-2 h-2 rounded-full bg-blue-600 shadow-sm shadow-blue-500 animate-ping"></span>
                    )}
                  </div>
                ))}
              </div>

              {/* Timeline Task Bars */}
              <div className="divide-y divide-slate-100 relative z-10">
                {calculatedTasks.map((t) => {
                  const barGradients = {
                    COMPLETED: 'from-emerald-500 to-teal-600 border-emerald-400 text-white shadow-emerald-500/20',
                    IN_PROGRESS: 'from-blue-600 to-indigo-600 border-blue-400 text-white shadow-blue-500/20',
                    REVIEWING: 'from-purple-600 to-indigo-600 border-purple-400 text-white shadow-purple-500/20',
                    TODO: 'from-slate-400 to-slate-500 border-slate-300 text-white shadow-slate-500/10',
                    OVERDUE: 'from-rose-600 to-red-600 border-rose-400 text-white shadow-rose-500/25',
                  };

                  const activeStyle = t.isOverdue
                    ? barGradients.OVERDUE
                    : barGradients[t.status] || barGradients.TODO;

                  return (
                    <div key={t.id} className="h-[42px] flex items-center relative">
                      <div
                        style={{
                          left: `${t.leftPx}px`,
                          width: `${t.widthPx}px`,
                        }}
                        onClick={() => handleTaskClick(t)}
                        className={cn(
                          'absolute h-6 rounded-lg bg-gradient-to-r border shadow-xs flex items-center px-2 text-[11px] font-bold transition transform hover:scale-[1.02] active:scale-100 cursor-pointer overflow-hidden group',
                          activeStyle
                        )}
                        title={`${t.title} (${t.durationDays} days) • Start: ${format(t.taskStart, 'dd/MM/yyyy')} • Due: ${format(t.taskDeadline, 'dd/MM/yyyy')}`}
                      >
                        {/* Progress Fill Background */}
                        <div
                          style={{ width: `${t.progressPct}%` }}
                          className="h-full absolute left-0 top-0 bg-white/20 rounded-l-xl pointer-events-none"
                        />

                        {/* Bar Label */}
                        <div className="relative z-10 flex items-center justify-between w-full truncate gap-1.5">
                          <span className="truncate">{t.title}</span>
                          {t.widthPx >= 36 && (
                            <span className="text-[10px] font-extrabold opacity-90 shrink-0">
                              {t.durationDays}d
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
