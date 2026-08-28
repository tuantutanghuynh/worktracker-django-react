import { useQuery } from '@tanstack/react-query'
import { getMyAuditLogs } from "../../../api/auditLogApi"

export const auditLogKeys = {
    all: ['employee-audit-log'],
    list: () => [...auditLogKeys.all, 'list'],
}

export function useAuditLog() {
    return useQuery({
        queryKey: auditLogKeys.list(),
        queryFn: getMyAuditLogs,
    })
}
