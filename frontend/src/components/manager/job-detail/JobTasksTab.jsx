import React, { useState, useMemo } from 'react';
import { Search, Eye, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import DataTable from '../../common/table/DataTable';
import PaginationBar from '../../common/table/PaginationBar';
import UserAvatar from '../../common/avatar/UserAvatar';
import { cn } from '../../../utils/cn';

function formatDateSafe(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

export default function JobTasksTab({ tasks = [], tasksLoading = false, openTaskDrawer }) {
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [taskCurrentPage, setTaskCurrentPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(10);

  // Lọc Tasks theo Search & Status
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        !taskSearchQuery ||
        (t.title && t.title.toLowerCase().includes(taskSearchQuery.toLowerCase())) ||
        (t.code && t.code.toLowerCase().includes(taskSearchQuery.toLowerCase())) ||
        (t.assignee?.full_name &&
          t.assignee.full_name.toLowerCase().includes(taskSearchQuery.toLowerCase())) ||
        (t.assignee?.email &&
          t.assignee.email.toLowerCase().includes(taskSearchQuery.toLowerCase()));

      const matchStatus = !taskStatusFilter || t.status === taskStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [tasks, taskSearchQuery, taskStatusFilter]);

  // Paginated Tasks
  const paginatedTasks = useMemo(() => {
    const start = (taskCurrentPage - 1) * taskPageSize;
    return filteredTasks.slice(start, start + taskPageSize);
  }, [filteredTasks, taskCurrentPage, taskPageSize]);

  // Columns definition
  const taskColumns = [
    {
      header: 'Task Code & Title',
      accessorKey: 'title',
      cell: (row) => (
        <div className="flex items-center gap-2 max-w-[280px]">
          {row.code && (
            <span className="font-mono font-bold text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
              {row.code}
            </span>
          )}
          <span className="font-bold text-xs text-slate-900 truncate" title={row.title}>
            {row.title}
          </span>
        </div>
      ),
    },
    {
      header: 'Assignee',
      accessorKey: 'assignee',
      cell: (row) => {
        const assignee = row.assignee;
        if (!assignee) {
          return (
            <span className="text-xs text-slate-400 italic">Unassigned (Draft)</span>
          );
        }
        return (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <UserAvatar
              user={assignee}
              src={assignee.avatar_url || assignee.avatar}
              fullName={assignee.full_name || assignee.email}
              size="xs"
              className="shrink-0 shadow-2xs"
            />
            <span className="truncate max-w-[130px]">{assignee.full_name || assignee.email}</span>
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => {
        const config = {
          TODO: 'bg-blue-50 text-blue-700 border-blue-200',
          IN_PROGRESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          REVIEWING: 'bg-purple-50 text-purple-700 border-purple-200',
          COMPLETED: 'bg-orange-50 text-orange-700 border-orange-200',
          CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
        };
        return (
          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-extrabold border uppercase tracking-wider',
              config[row.status] || 'bg-slate-100 text-slate-700'
            )}
          >
            {row.status}
          </span>
        );
      },
    },
    {
      header: 'Priority',
      accessorKey: 'priority',
      cell: (row) => {
        const priority = row.priority || 'MEDIUM';
        const PRIORITY_STYLES = {
          HIGH: 'bg-rose-50 text-rose-700 border-rose-200',
          MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
          LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
        return (
          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase border inline-flex items-center',
              PRIORITY_STYLES[priority] || 'bg-slate-100 text-slate-700 border-slate-200'
            )}
          >
            {priority}
          </span>
        );
      },
    },
    {
      header: 'Deadline',
      accessorKey: 'deadline',
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{formatDateSafe(row.deadline)}</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      className: 'text-right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openTaskDrawer(row.id)}
            className="px-2.5 py-1 hover:bg-blue-50 text-blue-600 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden space-y-0">
      {/* Toolbar Tìm kiếm & Lọc trạng thái Task */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={taskSearchQuery}
            onChange={(e) => {
              setTaskSearchQuery(e.target.value);
              setTaskCurrentPage(1);
            }}
            placeholder="Search tasks by title, code, or assignee..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          {[
            { value: '', label: 'All' },
            { value: 'TODO', label: 'To Do' },
            { value: 'IN_PROGRESS', label: 'In Progress' },
            { value: 'REVIEWING', label: 'Reviewing' },
            { value: 'COMPLETED', label: 'Completed' },
          ].map((pill) => (
            <button
              key={pill.value}
              onClick={() => {
                setTaskStatusFilter(pill.value);
                setTaskCurrentPage(1);
              }}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer',
                taskStatusFilter === pill.value
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={taskColumns}
        data={paginatedTasks}
        isLoading={tasksLoading}
        onRowClick={(row) => openTaskDrawer(row.id)}
        emptyMessage={
          taskSearchQuery || taskStatusFilter
            ? 'No tasks match your search filter.'
            : "No tasks found in this project. Click 'Add Task' to create one."
        }
      />

      <PaginationBar
        currentPage={taskCurrentPage}
        totalPages={Math.ceil(filteredTasks.length / taskPageSize) || 1}
        totalItems={filteredTasks.length}
        pageSize={taskPageSize}
        onPageChange={setTaskCurrentPage}
        onPageSizeChange={(newSize) => {
          setTaskPageSize(newSize);
          setTaskCurrentPage(1);
        }}
      />
    </div>
  );
}
