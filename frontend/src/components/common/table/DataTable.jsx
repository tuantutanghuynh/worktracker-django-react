import React, { useMemo } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox } from 'lucide-react';
import PaginationBar from './PaginationBar';
import { cn } from '../../../utils/cn';

/**
 * Hybrid DataTable Component - Combines TanStack Table (v8) headless engine
 * with WorkTracker Design System extended features (Skeleton, Empty State, Pagination, Selectable).
 * 
 * Compatible with both Named Import: import { DataTable } from '...'
 * and Default Import: import DataTable from '...'
 */
export function DataTable({
  columns = [],
  data = [],
  isLoading = false,
  pagination,
  onRowClick,
  emptyMessage = 'No data',
  sorting,
  onSortChange,
  selectable = false,
  selectedRowIds = [],
  onSelectAll,
  onSelectRow,
  className = '',
}) {
  // Chuẩn hóa columns để hỗ trợ song song cả kiểu (info) TanStack và (row, index) Custom
  const normalizedColumns = useMemo(() => {
    return columns.map((col, idx) => {
      const colKey = col.accessorKey || col.id || col.key || `col_${idx}`;

      return {
        ...col,
        id: colKey,
        header: col.header,
        accessorKey: col.accessorKey,
        cell: (info) => {
          if (typeof col.cell === 'function') {
            const rowData = info.row?.original || {};
            // Proxy hỗ trợ cả info.getValue() lẫn row.field trực tiếp
            const dualContext = new Proxy(info, {
              get(target, prop) {
                if (prop in target) return target[prop];
                if (prop in rowData) return rowData[prop];
                return undefined;
              },
            });
            return col.cell(dualContext, info.row?.index);
          }
          return flexRender(col.cell ?? info.getValue(), info);
        },
      };
    });
  }, [columns]);

  // Khởi tạo lõi TanStack Table theo đúng thiết kế của Nhóm Tú
  const table = useReactTable({
    data,
    columns: normalizedColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const isAllSelected = data.length > 0 && selectedRowIds.length === data.length;

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col', className)}>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-sm">
          {/* Table Header */}
          <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
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

                {headerGroup.headers.map((header) => {
                  const rawCol = columns.find(
                    (c, i) => (c.accessorKey || c.id || c.key || `col_${i}`) === header.id
                  ) || {};

                  const colKey = header.id;
                  const isSortable = rawCol.sortable && onSortChange;
                  const isSorted = sorting?.key === colKey;
                  const sortDir = isSorted ? sorting?.direction : null;

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'px-4 py-3.5 whitespace-nowrap',
                        isSortable && 'cursor-pointer select-none hover:text-slate-900',
                        rawCol.className
                      )}
                      onClick={() => isSortable && onSortChange(colKey)}
                    >
                      <div className="flex items-center gap-1.5">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}

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
            ))}
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200/80 text-slate-700 text-xs sm:text-sm font-medium">
            {isLoading ? (
              // 1. Skeleton Loading State (Dự phòng khi nạp API)
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={`skeleton-${rIdx}`} className="animate-pulse">
                  {selectable && (
                    <td className="px-4 py-4 text-center">
                      <div className="w-4 h-4 bg-slate-200 rounded mx-auto" />
                    </td>
                  )}
                  {columns.map((_, cIdx) => (
                    <td key={`sk-cell-${cIdx}`} className="px-4 py-4">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              // 2. Custom Empty State
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center text-slate-400"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                    <p className="text-xs font-normal text-slate-500">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              // 3. Real Data Rows (TanStack Core Model)
              table.getRowModel().rows.map((row) => {
                const rowData = row.original;
                const rowId = rowData?.id || row.id;
                const isSelected = selectedRowIds.includes(rowId);

                return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick && onRowClick(rowData)}
                    className={cn(
                      'transition-colors duration-150 hover:bg-slate-50/80',
                      onRowClick && 'cursor-pointer',
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

                    {row.getVisibleCells().map((cell) => {
                      const rawCol = columns.find(
                        (c, i) => (c.accessorKey || c.id || c.key || `col_${i}`) === cell.column.id
                      ) || {};

                      return (
                        <td
                          key={cell.id}
                          className={cn('px-4 py-3.5 whitespace-nowrap', rawCol.className)}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
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

export default DataTable;