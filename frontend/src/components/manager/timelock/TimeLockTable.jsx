import React, { useState, useMemo } from 'react';
import {
  Lock,
  Unlock,
  Calendar,
  Clock,
  FileText,
  User,
  ShieldCheck,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import DataTable from '../../common/table/DataTable';

function formatDateSafe(dateStr, pattern = 'dd/MM/yyyy HH:mm') {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

export default function TimeLockTable({
  jobRows = [],
  isLoading = false,
  isCurrentPeriod = false,
  isGloballyLocked = false,
  onOpenUnlockModal,
  onDirectLock,
  isLocking = false,
  onNavigateTimesheet,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalItems = jobRows.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return jobRows.slice(start, start + pageSize);
  }, [jobRows, currentPage, pageSize]);
  const columns = [
    {
      header: 'Project / Job',
      accessorKey: 'job_code',
      className: 'w-[32%] min-w-[200px]',
      cell: (row) => {
        const month = String(row.lock_month).padStart(2, '0');
        const year = row.lock_year;
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
                {row.job_code}
              </span>
              <span className="text-xs font-bold text-slate-900 truncate">
                {row.job_name}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Period: {month}/{year}</span>
              </span>
              {row.client_name && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[120px]">Client: {row.client_name}</span>
                </>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Lock Status',
      accessorKey: 'is_locked',
      className: 'w-[20%] min-w-[150px]',
      cell: (row) => {
        if (row.lock_type === 'GLOBAL_LOCKED') {
          return (
            <div className="whitespace-nowrap">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300 shadow-2xs"
                title="Locked company-wide by Admin for payroll"
              >
                <Lock className="w-3 h-3 text-purple-700" /> GLOBALLY LOCKED
              </span>
            </div>
          );
        }
        if (row.lock_type === 'MANUAL_LOCKED' || row.is_locked) {
          return (
            <div className="whitespace-nowrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                <Lock className="w-3 h-3" /> LOCKED
              </span>
            </div>
          );
        }
        if (row.lock_type === 'GRACE_UNLOCKED') {
          return (
            <div className="whitespace-nowrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                <Unlock className="w-3 h-3" /> GRACE UNLOCKED
              </span>
            </div>
          );
        }
        return (
          <div className="whitespace-nowrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Unlock className="w-3 h-3" /> OPEN
            </span>
          </div>
        );
      },
    },
    {
      header: 'Lock Audit Trail',
      accessorKey: 'lock_reason',
      className: 'w-[30%] min-w-[200px]',
      cell: (row) => {
        const actorName = row.locked_by?.full_name || row.locked_by?.email || (row.lock_type === 'GLOBAL_LOCKED' ? 'System Admin' : 'Manager');
        const lockedTimeStr = row.locked_at ? formatDateSafe(row.locked_at) : (row.lock_type === 'GLOBAL_LOCKED' ? 'Active Policy' : 'Open');
        const reasonText = row.lock_reason || (row.lock_type === 'GLOBAL_LOCKED' ? 'Company-wide payroll lock by Admin' : 'Open for timesheet submissions');

        return (
          <div className="space-y-0.5 text-xs">
            <div className="flex items-center gap-1.5 text-slate-700 font-semibold truncate">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{actorName}</span>
              <span className="text-slate-400 font-normal font-mono text-[11px] shrink-0">
                • {lockedTimeStr}
              </span>
            </div>
            <p
              className="text-[11px] text-slate-500 italic truncate"
              title={row.unlocked_reason ? `Unlocked note: ${row.unlocked_reason}` : reasonText}
            >
              {row.unlocked_reason ? `Unlocked: ${row.unlocked_reason}` : reasonText}
            </p>
          </div>
        );
      },
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      className: 'w-[18%] min-w-[130px]',
      cell: (row) => {
        // TRƯỜNG HỢP 1: BỊ KHÓA TOÀN CỤC BỞI ADMIN
        if (row.lock_type === 'GLOBAL_LOCKED') {
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateTimesheet(row.job_id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                title="View timesheets for this project (Read-only)"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Timesheet</span>
              </button>
            </div>
          );
        }

        // TRƯỜNG HỢP 2: ĐÃ KHÓA BỞI MANAGER -> CHO PHÉP MỞ KHÓA
        if (row.is_locked) {
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenUnlockModal(row)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Unlock this period to allow time adjustments"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Unlock</span>
              </button>
              <button
                onClick={() => onNavigateTimesheet(row.job_id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                title="Review timesheets"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Timesheet</span>
              </button>
            </div>
          );
        }

        // TRƯỜNG HỢP 3: THÁNG HIỆN TẠI ĐANG DIỄN RA
        if (isCurrentPeriod) {
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateTimesheet(row.job_id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                title="Review timesheet entries in progress"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Timesheet</span>
              </button>
            </div>
          );
        }

        // TRƯỜNG HỢP 4: THÁNG ĐÃ QUA & CHƯA KHÓA -> CHO PHÉP MANAGER KHÓA
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDirectLock(row)}
              disabled={isLocking}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
              title={row.unlocked_reason ? "Re-lock this period after adjustments" : "Lock this project for this period"}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Re-lock</span>
            </button>

            <button
              onClick={() => onNavigateTimesheet(row.job_id)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
              title="Review pending timesheets before locking"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Timesheet</span>
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={paginatedRows}
      isLoading={isLoading}
      emptyMessage="No managed projects found matching your filter."
      pagination={{
        currentPage,
        totalPages,
        totalItems,
        pageSize,
        pageSizeOptions: [10, 25, 50],
        onPageChange: setCurrentPage,
        onPageSizeChange: (size) => {
          setPageSize(size);
          setCurrentPage(1);
        },
      }}
    />
  );
}
