import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '../../../utils/cn';

/**
 * Hybrid PaginationBar Component
 * 
 * Supports both:
 * 1. Tu's prop names: page, totalPages, onPageChange
 * 2. User's extended props: currentPage, totalItems, pageSize, pageSizeOptions, onPageSizeChange
 * 
 * Compatible with both:
 * import { PaginationBar } from '...'
 * import PaginationBar from '...'
 */
export function PaginationBar({
  // Props từ nhóm Tú (Giữ tên prop `page` làm chuẩn)
  page,
  currentPage = 1,
  totalPages = 1,
  onPageChange,

  // Props mở rộng từ nhóm bạn
  totalItems,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  onPageSizeChange,
  showPageNumbers = true,
  className = '',
}) {
  // Alias `activePage` hoạt động mượt cho cả `page` (Tú) lẫn `currentPage` (Bạn)
  const activePage = page ?? currentPage ?? 1;
  const safeTotalPages = Math.max(1, totalPages || 1);

  const canGoPrev = activePage > 1;
  const canGoNext = activePage < safeTotalPages;

  const startItem = totalItems ? (activePage - 1) * pageSize + 1 : 0;
  const endItem = totalItems ? Math.min(activePage * pageSize, totalItems) : 0;

  // Thuật toán hiển thị dải số trang thông minh (Tối đa 5 nút số)
  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;
    let start = Math.max(1, activePage - Math.floor(maxButtons / 2));
    let end = Math.min(safeTotalPages, start + maxButtons - 1);

    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const handlePageClick = (pageNumber) => {
    if (onPageChange && pageNumber >= 1 && pageNumber <= safeTotalPages) {
      onPageChange(pageNumber);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border-t border-slate-200 text-xs sm:text-sm text-slate-600',
        className
      )}
    >
      {/* Left section: Total Items info & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {totalItems !== undefined && (
          <span>
            Showing <span className="font-semibold text-slate-900">{startItem}</span> -{' '}
            <span className="font-semibold text-slate-900">{endItem}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalItems}</span> results
          </span>
        )}

        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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

      {/* Right section: Page Number Buttons & Navigation Controls */}
      <div className="flex items-center space-x-1 text-xs">
        {/* First Page Button */}
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => handlePageClick(1)}
          title="First Page"
          className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Previous Page Button */}
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => handlePageClick(activePage - 1)}
          title="Previous Page"
          className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Numbered Page Buttons (Code Nhóm Tú) */}
        {showPageNumbers &&
          getPageNumbers().map((pageNumber) => {
            const isActive = pageNumber === activePage;
            return (
              <button
                key={pageNumber}
                type="button"
                onClick={() => handlePageClick(pageNumber)}
                className={
                  isActive
                    ? 'px-2.5 py-1 rounded bg-blue-600 text-white font-semibold shadow-xs cursor-pointer'
                    : 'px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer transition'
                }
              >
                {pageNumber}
              </button>
            );
          })}

        {/* Next Page Button */}
        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => handlePageClick(activePage + 1)}
          title="Next Page"
          className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page Button */}
        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => handlePageClick(safeTotalPages)}
          title="Last Page"
          className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default PaginationBar;