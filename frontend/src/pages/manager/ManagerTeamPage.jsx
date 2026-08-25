import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Phone,
  Calendar,
  UserCheck,
  TrendingUp,
  LayoutGrid,
  List,
  Edit,
  ShieldCheck,
  Zap,
  ChevronRight,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import DataTable from '../../components/common/table/DataTable';
import PaginationBar from '../../components/common/table/PaginationBar';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import StatusBadge from '../../components/common/badges/StatusBadge';
import PriorityBadge from '../../components/common/badges/PriorityBadge';
import UserAvatar from '../../components/common/avatar/UserAvatar';
import { cn } from '../../utils/cn';

import { useManagerEmployees } from '../../hooks/queries/manager/useManagerTeam';
import { useManagerTasks } from '../../hooks/queries/manager/useManagerTasks';

export default function ManagerTeamPage() {
  // View mode & filters
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL'); // 'ALL' | 'OVERLOADED' | 'BALANCED' | 'AVAILABLE'

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Drawer State
  const [selectedMember, setSelectedMember] = useState(null);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatusFilter]);

  // 🚀 TANSTACK REACT QUERY HOOKS
  const { data: employeesResponse, isLoading, isFetching, refetch } = useManagerEmployees();

  // Chuẩn hóa danh sách nhân sự
  const employeesList = useMemo(() => {
    const raw = Array.isArray(employeesResponse)
      ? employeesResponse
      : employeesResponse?.results || [];

    return raw.map((emp) => {
      const departmentName = emp.department?.name || emp.department_name || 'General Staff';
      const departmentId = emp.department?.id
        ? String(emp.department.id)
        : emp.department_id
          ? String(emp.department_id)
          : '';
      const activeTasks =
        emp.active_tasks_count !== undefined
          ? emp.active_tasks_count
          : emp.tasks_count || 0;

      const loggedHours = parseFloat(emp.logged_hours || 0);
      const capacityHours = parseFloat(emp.capacity_hours || 160.0);
      const capacityRate =
        emp.utilization_rate !== undefined && emp.utilization_rate !== null
          ? Math.round(parseFloat(emp.utilization_rate))
          : capacityHours > 0
            ? Math.round((loggedHours / capacityHours) * 100)
            : 0;

      let workloadStatus = 'AVAILABLE';
      if (capacityRate > 100 || emp.workload_status === 'Overloaded') workloadStatus = 'OVERLOADED';
      else if (capacityRate >= 70 || emp.workload_status === 'High') workloadStatus = 'BALANCED';

      return {
        ...emp,
        departmentName,
        departmentId,
        activeTasks,
        loggedHours,
        capacityHours,
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
        const dept = (emp.departmentName || '').toLowerCase();
        return name.includes(q) || email.includes(q) || dept.includes(q);
      }
      return true;
    });
  }, [employeesList, selectedStatusFilter, searchQuery]);

  // Phân trang dữ liệu
  const totalItems = filteredEmployees.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

  // Thống kê KPI
  const kpis = useMemo(() => {
    const total = employeesList.length;
    const overloaded = employeesList.filter((e) => e.workloadStatus === 'OVERLOADED').length;
    const balanced = employeesList.filter((e) => e.workloadStatus === 'BALANCED').length;
    const available = employeesList.filter((e) => e.workloadStatus === 'AVAILABLE').length;

    return { total, overloaded, balanced, available };
  }, [employeesList]);

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
      header: 'Department',
      accessorKey: 'departmentName',
      cell: (row) => (
        <div className="space-y-0.5 text-xs text-slate-700">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{row.departmentName}</span>
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
              {row.loggedHours.toFixed(1)}h / {row.capacityHours.toFixed(0)}h
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
        }[row.workloadStatus] || 'bg-slate-100 text-slate-700 border-slate-200';

        return (
          <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-wider', config)}>
            {row.workloadStatus}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      cell: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedMember(row)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
            title="View Member Details"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 antialiased">
      {/* 🌟 HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px] font-bold">
              RESOURCE ALLOCATION
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Team Members & Workload Capacity
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Monitor real-time employee workload utilization, assigned active tasks, and department assignments.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-2 transition cursor-pointer self-start md:self-auto disabled:opacity-50"
        >
          <RotateCcw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* 📊 KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Members</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{kpis.total}</span>
            <span className="text-xs font-semibold text-slate-400">staff members</span>
          </div>
        </div>

        <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Overloaded</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-rose-900">{kpis.overloaded}</span>
            <span className="text-xs font-semibold text-rose-700">&gt;100% capacity</span>
          </div>
        </div>

        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Balanced</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-900">{kpis.balanced}</span>
            <span className="text-xs font-semibold text-emerald-700">70% - 100%</span>
          </div>
        </div>

        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Available</span>
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
              className={cn('px-3 py-1.5 rounded-lg transition cursor-pointer', selectedStatusFilter === 'ALL' && 'bg-white text-blue-700 shadow-xs')}
            >
              All ({kpis.total})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('OVERLOADED')}
              className={cn('px-3 py-1.5 rounded-lg transition cursor-pointer', selectedStatusFilter === 'OVERLOADED' && 'bg-white text-rose-700 shadow-xs')}
            >
              Overloaded ({kpis.overloaded})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('BALANCED')}
              className={cn('px-3 py-1.5 rounded-lg transition cursor-pointer', selectedStatusFilter === 'BALANCED' && 'bg-white text-emerald-700 shadow-xs')}
            >
              Balanced ({kpis.balanced})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('AVAILABLE')}
              className={cn('px-3 py-1.5 rounded-lg transition cursor-pointer', selectedStatusFilter === 'AVAILABLE' && 'bg-white text-blue-700 shadow-xs')}
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
              className="w-full pl-9 pr-3 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-xs rounded-xl border border-transparent focus:border-blue-400 focus:outline-none transition"
            />
          </div>

          {/* Chuyển đổi View Mode */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-1.5 rounded-lg transition cursor-pointer', viewMode === 'grid' && 'bg-white text-blue-600 shadow-xs')}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn('p-1.5 rounded-lg transition cursor-pointer', viewMode === 'table' && 'bg-white text-blue-600 shadow-xs')}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 👥 HIỂN THỊ DANH SÁCH NHÂN SỰ */}
      {viewMode === 'grid' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedEmployees.map((emp) => (
              <div
                key={`emp-card-${emp.id || emp.user_id}`}
                onClick={() => setSelectedMember(emp)}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all space-y-4 relative group cursor-pointer"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar user={emp} size="md" showStatus={true} isOnline={true} />
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-purple-700 transition truncate">
                        {emp.full_name || emp.email}
                      </h3>
                      <p className="text-xs text-slate-400 truncate">{emp.email}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-semibold mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{emp.departmentName}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Workload Progress Bar */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">Workload Utilization:</span>
                    <span
                      className={cn(
                        emp.workloadStatus === 'OVERLOADED' && 'text-rose-600',
                        emp.workloadStatus === 'BALANCED' && 'text-emerald-600',
                        emp.workloadStatus === 'AVAILABLE' && 'text-blue-600'
                      )}
                    >
                      {emp.capacityRate}% ({emp.loggedHours.toFixed(1)}h / {emp.capacityHours.toFixed(0)}h)
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

          {/* Phân trang cho Grid View */}
          {totalPages > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-2xs">
              <PaginationBar
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={paginatedEmployees}
          isLoading={isLoading}
          emptyMessage="No team members matching the selected filters."
          onRowClick={(row) => setSelectedMember(row)}
          pagination={{
            currentPage,
            totalPages,
            totalItems,
            pageSize,
            onPageChange: setCurrentPage,
            onPageSizeChange: (newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            },
          }}
        />
      )}

      {/* ============================================================
          SIDE DRAWER: THÔNG TIN CHI TIẾT NHÂN VIÊN & TASK ĐANG PHỤ TRÁCH
         ============================================================ */}
      <MemberDetailDrawer
        key={selectedMember?.id ?? selectedMember?.user_id ?? 'none-member'}
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
      />
    </div>
  );
}

/**
 * Ngăn kéo xem Hồ sơ Chi tiết & Danh sách Task đang làm của Member
 */
function MemberDetailDrawer({ member, onClose }) {
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
              Workload & Capacity Status
            </h3>
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider',
                member.workloadStatus === 'OVERLOADED' && 'bg-rose-50 text-rose-700 border-rose-200',
                member.workloadStatus === 'BALANCED' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                member.workloadStatus === 'AVAILABLE' && 'bg-blue-50 text-blue-700 border-blue-200'
              )}
            >
              {member.workloadStatus}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600">Monthly Capacity Utilization:</span>
              <span
                className={cn(
                  member.workloadStatus === 'OVERLOADED' && 'text-rose-600',
                  member.workloadStatus === 'BALANCED' && 'text-emerald-600',
                  member.workloadStatus === 'AVAILABLE' && 'text-blue-600'
                )}
              >
                {member.capacityRate}% ({member.loggedHours.toFixed(1)}h / {member.capacityHours.toFixed(0)}h)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-200/70 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  member.workloadStatus === 'OVERLOADED' && 'bg-rose-500',
                  member.workloadStatus === 'BALANCED' && 'bg-emerald-500',
                  member.workloadStatus === 'AVAILABLE' && 'bg-blue-500'
                )}
                style={{ width: `${Math.min(member.capacityRate, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-200">
            <div className="p-3 rounded-xl bg-white border border-slate-200/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Total Hours Logged</p>
              <p className="text-base font-extrabold text-slate-900 mt-0.5">{member.loggedHours.toFixed(1)}h</p>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Active Assigned Tasks</p>
              <p className="text-base font-extrabold text-purple-700 mt-0.5">{member.activeTasks} Tasks</p>
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
