import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"

// Generic data table — wraps TanStack Table's headless logic with the
// project's visual style (frontend-design-system.md Mục 7). Takes
// `columns` (TanStack column defs) and `data` via props; never fetches
// anything itself — the page/hook that owns the data passes it in.
export function DataTable({ columns, data }) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
                <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr
                            key={headerGroup.id}
                            className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200"
                        >
                            {headerGroup.headers.map((header) => (
                                <th key={header.id} className="py-3 px-4">
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.length === 0 && (
                        <tr>
                            <td colSpan={columns.length} className="py-8 text-center text-xs text-slate-400">
                                No data
                            </td>
                        </tr>
                    )}
                    {table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/60 transition">
                            {row.getVisibleCells().map((cell) => (
                                <td key={cell.id} className="py-3 px-4 text-xs text-slate-700">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
