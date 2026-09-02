import React, { useState, useMemo, useEffect } from 'react';

import TeamHeader from '../../components/manager/team/TeamHeader';
import TeamKPICards from '../../components/manager/team/TeamKPICards';
import TeamFilterToolbar from '../../components/manager/team/TeamFilterToolbar';
import TeamGridView from '../../components/manager/team/TeamGridView';
import TeamTableView from '../../components/manager/team/TeamTableView';
import MemberDetailDrawer from '../../components/manager/team/MemberDetailDrawer';

import { useManagerEmployees } from '../../hooks/queries/manager/useManagerTeam';
import { useManagerJobs } from '../../hooks/queries/manager/useManagerJobs';

export default function ManagerTeamPage() {
  // View mode & filters
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL'); // 'ALL' | 'OVERLOADED' | 'BALANCED' | 'AVAILABLE'
  const [selectedJobId, setSelectedJobId] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Drawer State
  const [selectedMember, setSelectedMember] = useState(null);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatusFilter, selectedJobId]);

  // 🚀 TANSTACK REACT QUERY HOOKS
  const { data: jobsResponse } = useManagerJobs({ page_size: 100 });
  const { data: employeesResponse, isLoading, isFetching, refetch } = useManagerEmployees({
    job_id: selectedJobId || undefined,
  });

  const jobOptions = useMemo(() => {
    const list = Array.isArray(jobsResponse?.results)
      ? jobsResponse.results
      : Array.isArray(jobsResponse)
      ? jobsResponse
      : [];
    return [
      { value: '', label: 'All My Projects / Jobs' },
      ...list.map((j) => ({
        value: String(j.id),
        label: `${j.job_code ? `[${j.job_code}] ` : ''}${j.job_name}`,
      })),
    ];
  }, [jobsResponse]);

  // Chuẩn hóa danh sách nhân sự (100% Server-Driven Smart Workload)
  const employeesList = useMemo(() => {
    const raw = Array.isArray(employeesResponse)
      ? employeesResponse
      : employeesResponse?.results || [];

    return raw.map((emp) => {
      const departmentName = emp.department_name || emp.department?.name || 'General Staff';
      const departmentId = emp.department?.id
        ? String(emp.department.id)
        : emp.department_id
        ? String(emp.department_id)
        : '';
      const activeTasks = emp.active_tasks_count || 0;
      const activeJobs = emp.active_jobs_count || 0;
      const dailyRequiredHours = parseFloat(emp.daily_required_hours || 0);
      const capacityPct =
        emp.capacity_pct !== undefined && emp.capacity_pct !== null
          ? parseFloat(emp.capacity_pct)
          : 0;
      const workloadStatus = emp.smart_workload_status || emp.workload_status || 'AVAILABLE';

      return {
        ...emp,
        departmentName,
        departmentId,
        activeTasks,
        activeJobs,
        dailyRequiredHours,
        capacityPct,
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

  return (
    <div className="space-y-6 antialiased">
      {/* 🌟 Header Section */}
      <TeamHeader onRefresh={() => refetch()} isFetching={isFetching} />

      {/* 📊 KPI Summary Cards */}
      <TeamKPICards kpis={kpis} />

      {/* 🔍 Filter Toolbar & View Mode Toggle */}
      <TeamFilterToolbar
        jobOptions={jobOptions}
        selectedJobId={selectedJobId}
        onJobChange={setSelectedJobId}
        selectedStatusFilter={selectedStatusFilter}
        onStatusFilterChange={setSelectedStatusFilter}
        kpis={kpis}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* 👥 Hiển thị Danh sách Nhân sự (Grid hoặc Table) */}
      {viewMode === 'grid' ? (
        <TeamGridView
          employees={paginatedEmployees}
          onSelectMember={setSelectedMember}
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      ) : (
        <TeamTableView
          employees={paginatedEmployees}
          isLoading={isLoading}
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          onSelectMember={setSelectedMember}
        />
      )}

      {/* 👤 Side Drawer: Xem Hồ sơ Chi tiết & Deliverables của Nhân viên */}
      <MemberDetailDrawer
        key={selectedMember?.id ?? selectedMember?.user_id ?? 'none-member'}
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
      />
    </div>
  );
}
