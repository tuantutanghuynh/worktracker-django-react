import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox } from 'lucide-react';
import PaginationBar from './PaginationBar';
import { cn } from '../../../utils/cn';

export default function DataTable({
  columns = [],
  data = [],
  isLoading = false,
  pagination,
  onRowClick,
  emptyMessage = 'Không tìm thấy dữ liệu phù hợp',
  sorting,
  onSortChange,
  selectable = false,
  selectedRowIds = [],
  onSelectAll,
  onSelectRow,
  className = '',
}) {
  const isAllSelected =
    data.length > 0 && selectedRowIds.length === data.length;

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col', className)}>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-sm">
          {/* Table Header */}
          <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              {selectable && (
                <th className="px-4 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={onSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
              )}

              {columns.map((col, idx) => {
                const colKey = col.accessorKey || col.key || idx;
                const isSortable = col.sortable && onSortChange;
                const isSorted = sorting?.key === colKey;
                const sortDir = isSorted ? sorting?.direction : null;

                return (
                  <th
                    key={colKey}
                    className={cn(
                      'px-4 py-3.5 whitespace-nowrap',
                      isSortable && 'cursor-pointer select-none hover:text-slate-900',
                      col.className
                    )}
                    onClick={() => isSortable && onSortChange(colKey)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {isSortable && (
                        <span className="text-slate-400">
                          {sortDir === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                          ) : sortDir === 'desc' ? (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200/80 text-slate-700 font-medium">
            {isLoading ? (
              // Skeleton rows loading state
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={`skeleton-${rIdx}`} className="animate-pulse">
                  {selectable && (
                    <td className="px-4 py-4 text-center">
                      <div className="w-4 h-4 bg-slate-200 rounded mx-auto" />
                    </td>
                  )}
                  {columns.map((col, cIdx) => (
                    <td key={`sk-cell-${cIdx}`} className="px-4 py-4">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center text-slate-400"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                    <p className="text-sm font-normal text-slate-500">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              // Real Data Rows
              data.map((row, rIdx) => {
                const rowId = row.id || rIdx;
                const isSelected = selectedRowIds.includes(rowId);

                return (
                  <tr
                    key={rowId}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={cn(
                      'transition-colors duration-150',
                      onRowClick && 'cursor-pointer hover:bg-slate-50/90',
                      isSelected && 'bg-blue-50/50'
                    )}
                  >
                    {selectable && (
                      <td
                        className="px-4 py-3.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onSelectRow && onSelectRow(rowId)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    )}

                    {columns.map((col, cIdx) => {
                      const value = col.accessorKey
                        ? row[col.accessorKey]
                        : undefined;

                      return (
                        <td
                          key={col.accessorKey || col.key || cIdx}
                          className={cn('px-4 py-3.5 whitespace-nowrap text-xs sm:text-sm', col.className)}
                        >
                          {col.cell ? col.cell(row, rIdx) : value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && (
        <PaginationBar
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}
    </div>
  );
}
