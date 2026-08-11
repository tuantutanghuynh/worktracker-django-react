import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '../../../utils/cn';

export default function PaginationBar({
  currentPage = 1,
  totalPages = 1,
  totalItems,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  className = '',
}) {
  const startItem = totalItems ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = totalItems ? Math.min(currentPage * pageSize, totalItems) : 0;

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border-t border-slate-200 text-sm text-slate-600',
        className
      )}
    >
      {/* Left: Total Items info & Page Size Selector */}
      <div className="flex items-center gap-4 text-xs sm:text-sm">
        {totalItems !== undefined && (
          <span>
            Hiển thị <span className="font-semibold text-slate-900">{startItem}</span> -{' '}
            <span className="font-semibold text-slate-900">{endItem}</span> trên{' '}
            <span className="font-semibold text-slate-900">{totalItems}</span> kết quả
          </span>
        )}

        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Số dòng/trang:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Navigation Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange && onPageChange(1)}
          disabled={currentPage <= 1}
          title="Trang đầu"
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => onPageChange && onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Trang trước"
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="px-3 py-1 text-xs sm:text-sm font-medium text-slate-700">
          Trang <span className="font-semibold text-slate-900">{currentPage}</span> /{' '}
          <span className="font-semibold text-slate-900">{Math.max(1, totalPages)}</span>
        </span>

        <button
          onClick={() => onPageChange && onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Trang sau"
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => onPageChange && onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Trang cuối"
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
