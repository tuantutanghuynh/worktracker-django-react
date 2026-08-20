import React, { useState, useMemo } from 'react';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Briefcase,
  Search,
  RotateCcw,
  Building2,
  Mail,
  UserCheck,
  TrendingUp,
  LayoutGrid,
  List,
  Edit,
  ShieldCheck,
  Zap,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

import DataTable from '../../components/common/table/DataTable';
import BaseModal from '../../components/common/modal/BaseModal';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import UserAvatar from '../../components/common/avatar/UserAvatar';
import { cn } from '../../utils/cn';

import { useManagerEmployees, useAssignDepartment } from '../../hooks/queries/manager/useManagerTeam';

export default function ManagerTeamPage() {
  // View mode & filters
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL'); // 'ALL' | 'OVERLOADED' | 'BALANCED' | 'AVAILABLE'

  // Modal State
  const [assignModalTarget, setAssignModalTarget] = useState(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');

  // 🚀 TANSTACK REACT QUERY HOOKS
  const { data: employeesResponse, isLoading, isFetching, refetch } = useManagerEmployees();
  const assignDepartmentMutation = useAssignDepartment();

  // Chuẩn hóa danh sách nhân sự
  const employeesList = useMemo(() => {
    const raw = Array.isArray(employeesResponse)
      ? employeesResponse
      : employeesResponse?.results || [];

    return raw.map((emp) => {
      const activeTasks = emp.active_tasks_count || emp.tasks_count || 0;
      const weeklyHours = parseFloat(emp.weekly_hours || emp.total_hours_this_week || (activeTasks * 7.5)) || 0;
      const capacityRate = Math.min(Math.round((weeklyHours / 40) * 100), 160);

      let workloadStatus = 'AVAILABLE';
      if (capacityRate > 100) workloadStatus = 'OVERLOADED';
      else if (capacityRate >= 70) workloadStatus = 'BALANCED';

      return {
        ...emp,
        activeTasks,
        weeklyHours,
        capacityRate,
        workloadStatus,
      };
    });
  }, [employeesResponse]);

  // Lọc theo Search & Status
  const filteredEmployees = useMemo(() => {
    return employeesList.filter((emp) => {
      if (selectedStatusFilter !== 'ALL' && emp.workloadStatus !== selectedStatusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (emp.full_name || '').toLowerCase();
        const email = (emp.email || '').toLowerCase();
        const dept = (emp.department_name || '').toLowerCase();
        return name.includes(q) || email.includes(q) || dept.includes(q);
      }
      return true;
    });
  }, [employeesList, selectedStatusFilter, searchQuery]);

  // Thống kê KPI
  const kpis = useMemo(() => {
    const total = employeesList.length;
    const overloaded = employeesList.filter((e) => e.workloadStatus === 'OVERLOADED').length;
    const balanced = employeesList.filter((e) => e.workloadStatus === 'BALANCED').length;
    const available = employeesList.filter((e) => e.workloadStatus === 'AVAILABLE').length;

    return { total, overloaded, balanced, available };
  }, [employeesList]);

  // Xử lý Phân bổ Phòng Ban
  const handleAssignSubmit = (e) => {
    e.preventDefault();
    if (!assignModalTarget) return;

    assignDepartmentMutation.mutate(
      {
        userId: assignModalTarget.user_id || assignModalTarget.id,
        departmentId: selectedDepartmentId ? Number(selectedDepartmentId) : null,
      },
      {
        onSuccess: () => {
          setAssignModalTarget(null);
          setSelectedDepartmentId('');
        },
      }
    );
  };

  // Cấu hình Cột DataTable (cho Table View)
  const columns = [
    {
      header: 'Employee',
      accessorKey: 'full_name',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <UserAvatar user={row} size="sm" showStatus={true} isOnline={true} />
          <div className="min-w-0">
            <p className="font-bold text-xs text-slate-900 truncate">{row.full_name || row.email}</p>
            <p className="text-[10px] text-slate-400 truncate">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Department / Role',
      accessorKey: 'department_name',
      cell: (row) => (
        <div className="space-y-0.5 text-xs text-slate-700">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{row.department_name || 'General Staff'}</span>
          </div>
          <p className="text-[10px] text-slate-400">{row.role || 'EMPLOYEE'}</p>
        </div>
      ),
    },
    {
      header: 'Active Tasks',
      accessorKey: 'activeTasks',
      cell: (row) => (
        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
          {row.activeTasks} tasks
        </span>
      ),
    },
    {
      header: 'Workload Utilization',
      accessorKey: 'capacityRate',
      cell: (row) => (
        <div className="w-40 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span
              className={cn(
                row.workloadStatus === 'OVERLOADED' && 'text-rose-600',
                row.workloadStatus === 'BALANCED' && 'text-emerald-600',
                row.workloadStatus === 'AVAILABLE' && 'text-blue-600'
              )}
            >
              {row.capacityRate}%
            </span>
            <span className="text-[10px] text-slate-400 font-mono font-normal">
              {row.weeklyHours.toFixed(1)}h / 40h
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                row.workloadStatus === 'OVERLOADED' && 'bg-rose-500',
                row.workloadStatus === 'BALANCED' && 'bg-emerald-500',
                row.workloadStatus === 'AVAILABLE' && 'bg-blue-500'
              )}
              style={{ width: `${Math.min(row.capacityRate, 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      header: 'Capacity Status',
      accessorKey: 'workloadStatus',
      cell: (row) => {
        const config = {
          OVERLOADED: 'bg-rose-50 text-rose-700 border-rose-200',
          BALANCED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          AVAILABLE: 'bg-blue-50 text-blue-700 border-blue-200',
        };
        return (
          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider',
              config[row.workloadStatus]
            )}
          >
            {row.workloadStatus}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      cell: (row) => (
        <button
          onClick={() => {
            setAssignModalTarget(row);
            setSelectedDepartmentId(String(row.department_id || ''));
          }}
          className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition cursor-pointer"
          title="Assign Department"
        >
          <Edit className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 text-slate-800 pb-12">
      {/* 🌟 HERO HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Team Members & Workload Capacity</h1>
            <p className="text-xs text-slate-500 mt-1">
              Monitor real-time team workload and capacity to balance task distribution and prevent burnout.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetch();
              toast.success('Team members refreshed!');
            }}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
          >
            <RotateCcw className={cn('w-3.5 h-3.5 text-slate-500', isFetching && 'animate-spin')} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 📊 4 KPI STATCARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-2xs">
          <span className="text-xs font-bold text-slate-500">Total Supervised Members</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{kpis.total}</span>
            <span className="text-xs font-semibold text-slate-400">members</span>
          </div>
        </div>

        <div className="p-4 bg-rose-50/50 border border-rose-200/80 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800">Overloaded (&gt;100%)</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-rose-900">{kpis.overloaded}</span>
            <span className="text-xs font-semibold text-rose-700">rebalancing needed</span>
          </div>
        </div>

        <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">Balanced (70-100%)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-900">{kpis.balanced}</span>
            <span className="text-xs font-semibold text-emerald-700">optimal cadence</span>
          </div>
        </div>

        <div className="p-4 bg-blue-50/50 border border-blue-200/80 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800">Available (&lt;70%)</span>
            <Zap className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-900">{kpis.available}</span>
            <span className="text-xs font-semibold text-blue-700">ready for tasks</span>
          </div>
        </div>
      </div>

      {/* 🔍 FILTER TOOLBAR & VIEW TOGGLE */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {/* Lọc Status Tải */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 flex-wrap">
            <button
              onClick={() => setSelectedStatusFilter('ALL')}
              className={cn('px-3 py-1.5 rounded-lg transition', selectedStatusFilter === 'ALL' && 'bg-white text-blue-700 shadow-xs')}
            >
              All ({kpis.total})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('OVERLOADED')}
              className={cn('px-3 py-1.5 rounded-lg transition', selectedStatusFilter === 'OVERLOADED' && 'bg-white text-rose-700 shadow-xs')}
            >
              Overloaded ({kpis.overloaded})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('BALANCED')}
              className={cn('px-3 py-1.5 rounded-lg transition', selectedStatusFilter === 'BALANCED' && 'bg-white text-emerald-700 shadow-xs')}
            >
              Balanced ({kpis.balanced})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('AVAILABLE')}
              className={cn('px-3 py-1.5 rounded-lg transition', selectedStatusFilter === 'AVAILABLE' && 'bg-white text-blue-700 shadow-xs')}
            >
              Available ({kpis.available})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Ô Tìm kiếm */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, department..."
              className="w-full pl-9 pr-3 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-xs rounded-xl border border-transparent focus:border-blue-400 focus:outline-none"
            />
          </div>

          {/* Chuyển đổi View Mode */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-1.5 rounded-lg transition', viewMode === 'grid' && 'bg-white text-blue-600 shadow-xs')}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn('p-1.5 rounded-lg transition', viewMode === 'table' && 'bg-white text-blue-600 shadow-xs')}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 👥 HIỂN THỊ DANH SÁCH NHÂN SỰ */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => (
            <div
              key={`emp-card-${emp.id || emp.user_id}`}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all space-y-4 relative group"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <UserAvatar user={emp} size="md" showStatus={true} isOnline={true} />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{emp.full_name || emp.email}</h3>
                    <p className="text-xs text-slate-400">{emp.email}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-semibold mt-0.5">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>{emp.department_name || 'General Staff'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setAssignModalTarget(emp);
                    setSelectedDepartmentId(String(emp.department_id || ''));
                  }}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Assign Department"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Workload Progress Bar */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500">Weekly Workload Utilization:</span>
                  <span
                    className={cn(
                      emp.workloadStatus === 'OVERLOADED' && 'text-rose-600',
                      emp.workloadStatus === 'BALANCED' && 'text-emerald-600',
                      emp.workloadStatus === 'AVAILABLE' && 'text-blue-600'
                    )}
                  >
                    {emp.capacityRate}% ({emp.weeklyHours.toFixed(1)}h / 40h)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      emp.workloadStatus === 'OVERLOADED' && 'bg-rose-500',
                      emp.workloadStatus === 'BALANCED' && 'bg-emerald-500',
                      emp.workloadStatus === 'AVAILABLE' && 'bg-blue-500'
                    )}
                    style={{ width: `${Math.min(emp.capacityRate, 100)}%` }}
                  />
                </div>
              </div>

              {/* Card Footer: Active Tasks count & Status */}
              <div className="flex items-center justify-between pt-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>{emp.activeTasks} Active Tasks</span>
                </div>

                <span
                  className={cn(
                    'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider',
                    emp.workloadStatus === 'OVERLOADED' && 'bg-rose-50 text-rose-700 border-rose-200',
                    emp.workloadStatus === 'BALANCED' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    emp.workloadStatus === 'AVAILABLE' && 'bg-blue-50 text-blue-700 border-blue-200'
                  )}
                >
                  {emp.workloadStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredEmployees}
          isLoading={isLoading}
          emptyMessage="No team members matching the selected filters."
        />
      )}

      {/* ============================================================
          MODAL: PHÂN BỔ / GÁN PHÒNG BAN CHO NHÂN SỰ
         ============================================================ */}
      <BaseModal
        isOpen={Boolean(assignModalTarget)}
        onClose={() => setAssignModalTarget(null)}
        title="Assign Department"
        subtitle="Update department assignment for employee"
        size="md"
        actions={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAssignModalTarget(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssignSubmit}
              disabled={assignDepartmentMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
            >
              {assignDepartmentMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
            <p>
              Employee: <strong>{assignModalTarget?.full_name || assignModalTarget?.email}</strong>
            </p>
            <p>
              Email: <strong>{assignModalTarget?.email}</strong>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Assigned Department</label>
            <input
              type="text"
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              placeholder="e.g. Software Engineering, QA..."
              className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none"
              autoFocus
            />
          </div>
        </form>
      </BaseModal>
    </div>
  );
}
