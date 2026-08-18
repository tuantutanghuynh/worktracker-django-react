import { useQuery } from '@tanstack/react-query'
import { getPersonalKPI } from '../../../api/dashboardApi'

// Query Key Factory for Employee Dashboard
export const dashboardKeys = {
    all: ['employee-dashboard'],
    kpi: () => [...dashboardKeys.all, 'kpi'],
}

// Employee dashboard summary — Personal KPI, cached 1 minute (matches
// Manager's useManagerDashboard.js pattern for a similar summary query).
export function useDashboard() {
    return useQuery({
        queryKey: dashboardKeys.kpi(),
        queryFn: getPersonalKPI,
        staleTime: 60 * 1000,
    })
}
