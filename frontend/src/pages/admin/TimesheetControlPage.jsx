import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Lock, Search, ChevronRight, Unlock } from 'lucide-react';
import BaseModal from '../../components/common/modal/BaseModal';
import SideDrawer from '../../components/common/drawer/SideDrawer';
import InputField from '../../components/common/forms/InputField';
import SelectDropdown from '../../components/common/forms/SelectDropdown';
import SortableHeader from '../../components/common/table/SortableHeader';
import PaginationBar from '../../components/common/table/PaginationBar';
import ExportButton from '../../components/common/table/ExportButton';
import {
  useAdminTimesheetEmployees,
  useAdminTimesheetEmployeeDetail,
  useAdminGlobalTimeLocks,
  useLockGlobalPeriod,
  useUnlockGlobalPeriod,
} from '../../hooks/queries/admin/useAdminTimesheets';
import { useAdminDepartments } from '../../hooks/queries/admin/useAdminDepartments';
import { useAdminUsers } from '../../hooks/queries/admin/useAdminUsers';
import { useDebounce } from '../../hooks/useDebounce';
import { useOrdering } from '../../hooks/useOrdering';

const PAGE_SIZE = 10; // khớp AdminPageNumberPagination.page_size ở backend

// Nhãn "No Log" thay vì "Missing": hệ thống chưa có model nghỉ phép/ngày
// lễ, nên một ngày không có log CHƯA CHẮC là quên chấm công — có thể là
// nghỉ phép. "No Log" mô tả đúng sự thật đo được, không quy kết.
const STATUS_OPTIONS = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'WARNING', label: 'Below Target' },
  { value: 'MISSING', label: 'No Log' },
  { value: 'OVER_LIMIT', label: 'Over Limit' },
];

const STATUS_STYLES = {
  NORMAL: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  WARNING: 'bg-amber-50 text-amber-600 border-amber-200',
  MISSING: 'bg-amber-50 text-amber-600 border-amber-200',
  OVER_LIMIT: 'bg-rose-50 text-rose-600 border-rose-200',
};

const STATUS_LABELS = {
  NORMAL: 'Normal',
  WARNING: 'Below Target',
  MISSING: 'No Log',
  OVER_LIMIT: 'Over Limit',
};

// Giải thích ý nghĩa từng status khi rê chuột — tránh Admin hiểu nhầm
// "No Log" = quên chấm công (thực tế có thể là nghỉ phép).
const STATUS_HINTS = {
  NORMAL: 'Logged every working day and met the expected hours so far this month.',
  WARNING: 'Logged every working day, but total hours are below 80% of what is expected so far.',
  MISSING: 'Some working days have no logged hours. Note: leave and public holidays are not tracked yet, so approved days off also appear here.',
  OVER_LIMIT: 'At least one day exceeds the standard daily hours.',
};

function StatusPill({ status }) {
  return (
    <span
      title={STATUS_HINTS[status] || ''}
      className={`inline-flex whitespace-nowrap px-1.5 py-0.5 text-[9px] font-bold rounded-full border ${STATUS_STYLES[status] || STATUS_STYLES.NORMAL}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

const lockSchema = z.object({
  reason: z.string().optional(),
});

const unlockSchema = z.object({
  reason: z.string().min(1, 'Unlock reason is required'),
});

// Admin page for company-wide timesheet oversight: KPI overview, per-
// employee monthly compliance table, and locking/unlocking the GLOBAL
// timesheet period (TimeLock.LockScope.GLOBAL — Admin-only, distinct from
// Manager's per-job JOB-scope lock). Data logic lives in
// hooks/queries/admin/useAdminTimesheets.js — this file is JSX only.
export function TimesheetControlPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [department, setDepartment] = useState('');
  const [manager, setManager] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [ordering, toggleSort] = useOrdering();

  const filterKey = `${month}|${year}|${debouncedSearch}|${department}|${manager}|${statusFilter}|${ordering}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }


  const { data: employeesPage, isLoading } = useAdminTimesheetEmployees({
    month,
    year,
    department: department || undefined,
    manager: manager || undefined,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
    ordering: ordering || undefined,
    page,
  });
  const employees = employeesPage?.results || [];
  const totalCount = employeesPage?.count || 0;

  const { data: departmentsPage } = useAdminDepartments({ page_size: 500 });
  const departmentOptions = (departmentsPage?.results || []).map((d) => ({
    value: String(d.id),
    label: d.name,
  }));

  const { data: managersPage } = useAdminUsers({ role: 'MANAGER', page_size: 500 });
  const managerOptions = (managersPage?.results || []).map((m) => ({
    value: String(m.id),
    label: m.email,
  }));

  // Every GLOBAL lock ever created — small list (at most 1 per month/year
  // in the system's history), so no pagination needed here. Used to find
  // whether the currently selected month/year is locked.
  const { data: timeLocksPage } = useAdminGlobalTimeLocks({ page_size: 500 });
  const currentPeriodLock = (timeLocksPage?.results || []).find(
    (l) => l.lock_month === month && l.lock_year === year
  );
  const isPeriodLocked = !!currentPeriodLock?.is_locked;

  const { data: employeeDetail } = useAdminTimesheetEmployeeDetail(selectedEmployeeId, { month, year });
  const selectedEmployeeRow = employees.find((e) => e.user_id === selectedEmployeeId);

  const lockMutation = useLockGlobalPeriod();
  const unlockMutation = useUnlockGlobalPeriod();

  const {
    register: registerLock,
    handleSubmit: handleLockSubmit,
    reset: resetLock,
    formState: { errors: lockErrors },
  } = useForm({ resolver: zodResolver(lockSchema) });

  const {
    register: registerUnlock,
    handleSubmit: handleUnlockSubmit,
    reset: resetUnlock,
    formState: { errors: unlockErrors },
  } = useForm({ resolver: zodResolver(unlockSchema) });

  function openLockModal() {
    resetLock({ reason: '' });
    setLockModalOpen(true);
  }

  function onSubmitLock(data) {
    lockMutation.mutate(
      { lock_month: month, lock_year: year, reason: data.reason || undefined },
      { onSuccess: () => setLockModalOpen(false) }
    );
  }

  function openUnlockModal() {
    resetUnlock({ reason: '' });
    setUnlockModalOpen(true);
  }

  function onSubmitUnlock(data) {
    unlockMutation.mutate(
      { id: currentPeriodLock.id, reason: data.reason },
      { onSuccess: () => setUnlockModalOpen(false) }
    );
  }

  const monthValue = `${year}-${String(month).padStart(2, '0')}`;
  function onMonthChange(e) {
    const [y, m] = e.target.value.split('-').map(Number);
    if (y && m) {
      setYear(y);
      setMonth(m);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-lg font-bold text-slate-900">Timesheet Control</h1>
        <div className="flex items-center gap-2 self-start sm:self-auto">
        <ExportButton
          url="/admin/timesheets/employees/export/"
          params={{
            month,
            year,
            department: department || undefined,
            manager: manager || undefined,
            status: statusFilter || undefined,
            search: debouncedSearch || undefined,
            ordering: ordering || undefined,
          }}
          filename="worktracker_timesheets.xlsx"
        />
        <button
          type="button"
          onClick={isPeriodLocked ? openUnlockModal : openLockModal}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold shadow-md transition ${
            isPeriodLocked
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
          }`}
        >
          {isPeriodLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {isPeriodLocked ? 'Unlock Period' : 'Lock Period'}
        </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Employee name, email..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>
          <InputField label="Period" type="month" value={monthValue} onChange={onMonthChange} />
          <SelectDropdown
            theme="light"
            label="Department"
            placeholder="All departments"
            options={departmentOptions}
            value={department}
            onChange={setDepartment}
          />
          <SelectDropdown
            theme="light"
            label="Manager"
            placeholder="All managers"
            options={managerOptions}
            value={manager}
            onChange={setManager}
          />
          <SelectDropdown
            theme="light"
            label="Status"
            placeholder="All status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </div>

      {/* Không dùng overflow-x-auto: table-fixed + width theo % nên bảng luôn
          co vừa khung, không bao giờ phải kéo ngang. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50">
            <tr>
              <SortableHeader label="Employee" sortKey="full_name" ordering={ordering} onSort={toggleSort} className="w-[21%]" />
              <SortableHeader label="Department" sortKey="department_name" ordering={ordering} onSort={toggleSort} className="w-[14%]" />
              <SortableHeader label="Month Hours" sortKey="month_hours" ordering={ordering} onSort={toggleSort} className="w-[19%]" />
              <SortableHeader label="Avg/Day" sortKey="avg_per_day" ordering={ordering} onSort={toggleSort} className="w-[10%]" />
              <SortableHeader label="Issues" sortKey="violations" ordering={ordering} onSort={toggleSort} className="w-[9%]" />
              <SortableHeader label="Status" sortKey="status" ordering={ordering} onSort={toggleSort} className="w-[12%]" />
              <SortableHeader label="Last Log" sortKey="last_entry" ordering={ordering} onSort={toggleSort} className="w-[12%]" />
              <th className="w-8 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && employees.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                  No employees match these filters.
                </td>
              </tr>
            )}
            {employees.map((emp) => (
              <tr
                key={emp.user_id}
                onClick={() => setSelectedEmployeeId(emp.user_id)}
                className="cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <td className="px-3 py-2 truncate">
                  <p className="truncate font-semibold text-slate-900" title={emp.full_name}>{emp.full_name}</p>
                  <p className="truncate text-[10px] text-slate-400" title={emp.email}>{emp.email}</p>
                </td>
                <td className="px-3 py-2 truncate text-slate-500" title={emp.department_name || ''}>
                  {emp.department_name || '—'}
                </td>
                {/* Số giờ viết liền một dòng "13h / 208h · 6%" thay vì tách
                    2 đầu bằng justify-between — cách cũ để lại khoảng trống
                    lớn giữa ô hẹp, nhìn như 2 cột rời nhau. */}
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1 text-[11px] leading-none">
                      <span className="font-bold text-slate-800">{emp.month_hours}h</span>
                      <span className="text-slate-400">/ {emp.target_hours}h</span>
                      <span className="ml-auto shrink-0 font-semibold text-slate-500">
                        {emp.target_hours ? Math.round((emp.month_hours / emp.target_hours) * 100) : 0}%
                      </span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-1 rounded-full ${emp.status === 'OVER_LIMIT' ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{
                          width: `${emp.target_hours ? Math.min((emp.month_hours / emp.target_hours) * 100, 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-center font-semibold text-slate-700">{emp.avg_per_day}h</td>
                <td className="px-3 py-2 text-center">
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                    {emp.violations}
                  </span>
                </td>
                <td className="px-3 py-2 truncate">
                  <StatusPill status={emp.status} />
                </td>
                <td className="px-3 py-2 truncate text-[11px] text-slate-500">{emp.last_entry || '—'}</td>
                <td className="px-3 py-2 text-slate-300">
                  <ChevronRight className="h-3.5 w-3.5" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <PaginationBar
          page={page}
          totalPages={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
          onPageChange={setPage}
          totalItems={totalCount}
          pageSize={PAGE_SIZE}
        />
      </div>

      <SideDrawer
        isOpen={!!selectedEmployeeId}
        onClose={() => setSelectedEmployeeId(null)}
        title="Compliance Overview"
        subtitle={selectedEmployeeRow?.full_name}
        size="md"
      >
        {employeeDetail && selectedEmployeeRow && (
          <div className="space-y-5 text-slate-100">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700">
                <span className="text-slate-400 text-[10px] block">Monthly Hours</span>
                <span className="font-extrabold text-slate-100 text-sm">{employeeDetail.month_hours}h</span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700">
                <span className="text-slate-400 text-[10px] block">Working Days</span>
                <span className="font-extrabold text-slate-100 text-sm">{employeeDetail.working_days} Days</span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700">
                <span className="text-slate-400 text-[10px] block">Average / Day</span>
                <span className="font-extrabold text-slate-100 text-sm">{employeeDetail.avg_per_day}h</span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700">
                <span className="text-slate-400 text-[10px] block">Edited Records</span>
                <span className="font-extrabold text-amber-400 text-sm">{employeeDetail.edited_records}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Compliance Checks</h5>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-slate-800/60">
                  <span className="text-slate-300 font-medium">Daily hours over limit</span>
                  <span className={employeeDetail.daily_over_limit_count > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {employeeDetail.daily_over_limit_count} day(s)
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-800/60">
                  <span className="text-slate-300 font-medium">Daily 24h hard cap hit</span>
                  <span className={employeeDetail.daily_hard_limit_count > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {employeeDetail.daily_hard_limit_count} day(s)
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-800/60">
                  <span className="text-slate-300 font-medium">Locked period edits</span>
                  <span className={employeeDetail.locked_period_edits > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {employeeDetail.locked_period_edits > 0 ? employeeDetail.locked_period_edits : 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-800/60">
                  <span
                    className="text-slate-300 font-medium"
                    title="Working days that have passed with no logged hours. Leave and public holidays are not tracked yet, so days off are counted here too."
                  >
                    Working days without a log
                  </span>
                  <span className={employeeDetail.missing_days > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {employeeDetail.missing_days} day(s)
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-300">Period Lock Status</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    employeeDetail.global_lock?.is_locked
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {employeeDetail.global_lock?.is_locked ? 'LOCKED' : 'UNLOCKED'}
                </span>
              </div>
              <p className="text-[11px] text-purple-200">
                {employeeDetail.global_lock
                  ? `${employeeDetail.global_lock.is_locked ? 'Locked' : 'Unlocked'} by ${
                      employeeDetail.global_lock.is_locked
                        ? employeeDetail.global_lock.locked_by
                        : employeeDetail.global_lock.unlocked_by
                    } on ${format(
                      new Date(
                        employeeDetail.global_lock.is_locked
                          ? employeeDetail.global_lock.locked_at
                          : employeeDetail.global_lock.unlocked_at
                      ),
                      'HH:mm - yyyy-MM-dd'
                    )}.`
                  : 'This period has never been locked company-wide.'}
              </p>
            </div>
          </div>
        )}
      </SideDrawer>

      <BaseModal isOpen={lockModalOpen} onClose={() => setLockModalOpen(false)} title="Lock Timesheet Period">
        <form onSubmit={handleLockSubmit(onSubmitLock)} className="space-y-3">
          <p className="text-xs text-slate-500">
            This locks <strong>{format(new Date(year, month - 1), 'MMMM yyyy')}</strong> company-wide — every job's
            timesheet for this period becomes read-only until unlocked.
          </p>
          <InputField label="Reason (optional)" error={lockErrors.reason?.message} {...registerLock('reason')} />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setLockModalOpen(false)}
              className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={lockMutation.isPending}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {lockMutation.isPending ? 'Locking...' : 'Lock Period'}
            </button>
          </div>
        </form>
      </BaseModal>

      <BaseModal isOpen={unlockModalOpen} onClose={() => setUnlockModalOpen(false)} title="Unlock Timesheet Period">
        <form onSubmit={handleUnlockSubmit(onSubmitUnlock)} className="space-y-3">
          <p className="text-xs text-slate-500">
            This unlocks <strong>{format(new Date(year, month - 1), 'MMMM yyyy')}</strong> company-wide — timesheets
            become editable again for every job.
          </p>
          <InputField
            label="Reason (required)"
            error={unlockErrors.reason?.message}
            {...registerUnlock('reason')}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setUnlockModalOpen(false)}
              className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={unlockMutation.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {unlockMutation.isPending ? 'Unlocking...' : 'Unlock Period'}
            </button>
          </div>
        </form>
      </BaseModal>
    </div>
  );
}
