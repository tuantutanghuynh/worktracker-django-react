import { useQuery } from '@tanstack/react-query';
import employeeTeamService from '../../../services/employee/employeeTeamService';

export const myTeamKeys = {
  all: ['my-team'],
};

/**
 * Team roster ít đổi hơn KPI/task list -> staleTime dài hơn (5 phút).
 */
export function useMyTeam() {
  return useQuery({
    queryKey: myTeamKeys.all,
    queryFn: employeeTeamService.getMyTeam,
    staleTime: 5 * 60 * 1000,
  });
}
