import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import managerTeamService from '../../../services/manager/managerTeamService';
import { getErrorMessage } from '../../../utils/errorMessages';

/**
 * Query Key Factory for Manager Team
 */
export const managerTeamKeys = {
  all: ['manager-team'],
  employees: (params = {}) => [...managerTeamKeys.all, 'employees', { params }],
};

/**
 * Fetch list of employees with workload utilization summary
 */
export function useManagerEmployees(params = {}) {
  return useQuery({
    queryKey: managerTeamKeys.employees(params),
    queryFn: () => managerTeamService.getEmployees(params),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000, // 2 minutes cache
  });
}

/**
 * Mutation: Assign employee to department
 */
export function useAssignDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, departmentId }) => managerTeamService.assignDepartment(userId, departmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managerTeamKeys.all });
      toast.success('Department assigned successfully!');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to assign department'));
    },
  });
}
