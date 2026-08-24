import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getDashboard, getAdminReport } from '../../../api/admin/dashboard';
import { getErrorMessage } from '../../../utils/errorMessages';

// GET /api/admin/dashboard/ is cached server-side for 30s (DashboardView),
// so this doesn't need its own aggressive polling on top of that.
export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getDashboard,
  });
}

// Downloads the Clients/Jobs/Users Excel workbook straight to the browser —
// there's nothing to cache or invalidate, so this is a mutation (an
// on-demand action) rather than a query.
export function useExportAdminReport() {
  return useMutation({
    mutationFn: (params) => getAdminReport(params),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'worktracker_report.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to export report.')),
  });
}
