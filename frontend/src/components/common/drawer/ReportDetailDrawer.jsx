import React from 'react';
import { 
  FileText, 
  Download, 
  Table, 
  Calendar, 
  User, 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet, 
  Printer,
  Sparkles
} from 'lucide-react';
import SideDrawer from './SideDrawer';
import { cn } from '../../../utils/cn';

/**
 * ReportDetailDrawer - Report Export & Summary Drawer Component
 * 
 * Props:
 * - isOpen (boolean): Drawer open state
 * - onClose (function): Close handler
 * - reportData (Object): {
 *     id, title, type, dateRange, generatedAt, generatedBy, status,
 *     summaryMetrics: [{ label, value, change }],
 *     filters: { department, jobName, userRole },
 *     previewData: [{ col1, col2, ... }]
 *   }
 * - onExport (function): Callback (format: 'pdf' | 'excel' | 'csv') => void
 * - isLoading (boolean): Exporting loading state
 */
export default function ReportDetailDrawer({
  isOpen = false,
  onClose,
  reportData,
  onExport,
  isLoading = false,
}) {
  if (!reportData) return null;

  const {
    title = 'Báo cáo tổng hợp',
    type = 'General Report',
    dateRange = 'Tháng này',
    generatedAt,
    generatedBy = 'Admin User',
    status = 'READY',
    summaryMetrics = [],
    filters = {},
    previewData = [],
  } = reportData;

  const handleExportClick = (format) => {
    if (onExport && !isLoading) {
      onExport(format);
    }
  };

  const footerActions = (
    <div className="flex flex-wrap items-center justify-between w-full gap-3">
      <span className="text-xs text-slate-400">
        Tự động bảo mật & ghi audit log khi trích xuất
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleExportClick('csv')}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <FileText className="w-4 h-4 text-blue-400" />
          CSV
        </button>
        <button
          type="button"
          onClick={() => handleExportClick('excel')}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white shadow-md shadow-emerald-900/30 transition"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Xuất Excel
        </button>
        <button
          type="button"
          onClick={() => handleExportClick('pdf')}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white shadow-md shadow-rose-900/30 transition"
        >
          <Printer className="w-4 h-4" />
          Tải PDF
        </button>
      </div>
    </div>
  );

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          <span>{title}</span>
        </div>
      }
      subtitle={`Phân loại: ${type} • Kỳ báo cáo: ${dateRange}`}
      size="xl"
      footer={footerActions}
    >
      {/* Overview Status Banner */}
      <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100">{title}</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Sẵn sàng xuất file
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Khởi tạo bởi <strong className="text-slate-200">{generatedBy}</strong> lúc {generatedAt || 'Hôm nay'}
            </p>
          </div>
        </div>

        {/* Applied Filters Badge List */}
        {Object.keys(filters).length > 0 && (
          <div className="flex items-center gap-2 text-xs bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-medium">Bộ lọc:</span>
            {Object.entries(filters).map(([k, v]) => (
              <span key={k} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[11px]">
                {k}: {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Summary KPI Cards Grid */}
      {summaryMetrics.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Chỉ số tóm tắt (KPI Summary)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {summaryMetrics.map((item, idx) => (
              <div key={idx} className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                <span className="text-xs font-medium text-slate-400 block">{item.label}</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-100">{item.value}</span>
                  {item.change && (
                    <span className={cn(
                      "text-xs font-semibold",
                      item.change.startsWith('+') ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {item.change}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Preview Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Xem trước bản ghi ({previewData.length} mẫu dữ liệu)
          </h4>
          <span className="text-xs text-slate-500 italic">
            Hiển thị tối đa 5 bản ghi xem trước
          </span>
        </div>

        {previewData.length === 0 ? (
          <div className="p-8 text-center border border-slate-800/80 rounded-xl bg-slate-950/40 text-xs text-slate-500">
            Chưa có xem trước bản ghi cho báo cáo này.
          </div>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-800">
                    {Object.keys(previewData[0]).map((colKey) => (
                      <th key={colKey} className="py-2.5 px-4 uppercase text-[10px] tracking-wider">
                        {colKey.replace('_', ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {previewData.slice(0, 5).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-800/30 transition">
                      {Object.values(row).map((val, cIdx) => (
                        <td key={cIdx} className="py-2.5 px-4 whitespace-nowrap">
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SideDrawer>
  );
}
