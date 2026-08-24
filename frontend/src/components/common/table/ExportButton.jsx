import { Download } from 'lucide-react';
import { useAdminExport } from '../../../hooks/queries/admin/useAdminExport';

/**
 * Exports the current admin table to Excel. Pass the same filter params the
 * page is already sending to its list endpoint so the file matches what's
 * on screen.
 */
export default function ExportButton({ url, params, filename, label = 'Export' }) {
  const exportMutation = useAdminExport();

  return (
    <button
      type="button"
      onClick={() => exportMutation.mutate({ url, params, filename })}
      disabled={exportMutation.isPending}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
    >
      <Download className="h-4 w-4" />
      {exportMutation.isPending ? 'Exporting...' : label}
    </button>
  );
}
