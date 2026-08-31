import calendar
from datetime import date
from django.db.models import Count, Q
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import CustomUser, Department, EmployeeProfile
from accounts.manager.serializers_manager import (
    ManagerDepartmentMiniSerializer,
    ManagerEmployeeListSerializer,
)
from projects.models import Job
from tasks.models import Task
from system.security.permissions_manager import (
    IsActiveAuthenticated,
    IsManagerRole,
    HasPermissionCode,
)
from system.services.audit_manager_service import snapshot, log_action
from timesheets.services.manager_employee_utilization_service import (
    get_team_workload_summary,
)


class ManagerDepartmentListView(ListAPIView):
    """
    GET /api/manager/accounts/departments/
    Trả về danh sách phòng ban để Manager chọn khi gán phòng ban cho nhân viên.
    """
    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "team:view"
    serializer_class = ManagerDepartmentMiniSerializer
    pagination_class = None
    queryset = Department.objects.all().order_by("name")


class ManagerTeamEmployeeListView(ListAPIView):
    """
    GET /api/manager/accounts/employees/

    Trả về danh sách nhân viên kèm thông tin Workload Status và Utilization Rate.
    Manager dùng để theo dõi hiệu suất và tìm người để giao task.

    Query Params:
        - department_id (optional): Lọc theo phòng ban.
        - search (optional): Tìm theo email hoặc họ tên.
        - start_date (optional): Ngày bắt đầu tính hiệu suất (YYYY-MM-DD).
        - end_date (optional): Ngày kết thúc tính hiệu suất (YYYY-MM-DD).
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "team:view"

    serializer_class = ManagerEmployeeListSerializer

    def get_queryset(self):
        user = self.request.user
        role_code = getattr(getattr(user, "role", None), "code", None)

        qs = (
            CustomUser.objects.filter(
                role__code="EMPLOYEE",
                is_active=True,
            )
            .select_related("profile", "profile__department", "role")
            .annotate(
                active_tasks_count=Count(
                    "assigned_tasks",
                    filter=Q(
                        assigned_tasks__status__in=[
                            Task.Status.TODO,
                            Task.Status.IN_PROGRESS,
                            Task.Status.REVIEWING,
                        ]
                    ),
                    distinct=True,
                )
            )
            .order_by("profile__full_name")
        )

        job_id = self.request.query_params.get("job_id")
        if job_id:
            from chat.models import ChatParticipant
            task_assignee_ids = set(Task.objects.filter(job_id=job_id).values_list("assignee_id", flat=True).distinct())
            team_participant_ids = set(
                ChatParticipant.objects.filter(room__job_id=job_id, room__room_type='JOB')
                .values_list('user_id', flat=True)
                .distinct()
            )
            team_user_ids = task_assignee_ids | team_participant_ids
            qs = qs.filter(id__in=team_user_ids)
        elif role_code != "ADMIN":
            # Scoping chuẩn: Manager chỉ thấy các nhân viên thuộc các Job do mình quản lý
            from chat.models import ChatParticipant
            managed_job_ids = Job.objects.filter(manager_id=user.id).values_list("id", flat=True)
            task_assignee_ids = set(Task.objects.filter(job_id__in=managed_job_ids).values_list("assignee_id", flat=True).distinct())
            team_participant_ids = set(
                ChatParticipant.objects.filter(room__job_id__in=managed_job_ids, room__room_type='JOB')
                .values_list('user_id', flat=True)
                .distinct()
            )
            team_user_ids = task_assignee_ids | team_participant_ids
            qs = qs.filter(id__in=team_user_ids)

        department_id = self.request.query_params.get("department_id")
        if department_id:
            qs = qs.filter(profile__department_id=department_id)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(email__icontains=search) | Q(profile__full_name__icontains=search)
            )

        return qs

    def list(self, request, *args, **kwargs):
        # 1. Parse date range từ query params (mặc định là tháng hiện tại)
        today = date.today()
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        if start_date_str and end_date_str:
            try:
                start_date = date.fromisoformat(start_date_str)
                end_date = date.fromisoformat(end_date_str)
            except ValueError:
                start_date = date(today.year, today.month, 1)
                _, last_day = calendar.monthrange(today.year, today.month)
                end_date = date(today.year, today.month, last_day)
        else:
            start_date = date(today.year, today.month, 1)
            _, last_day = calendar.monthrange(today.year, today.month)
            end_date = date(today.year, today.month, last_day)

        # 2. Tính toán tổng hợp chỉ số workload của team bằng Service
        summary_data = get_team_workload_summary(request.user, start_date, end_date)
        workload_map = {emp["user_id"]: emp for emp in summary_data["employees"]}

        # 3. Nạp workload_map vào context của Serializer
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)

        serializer_context = self.get_serializer_context()
        serializer_context["workload_map"] = workload_map

        summary_header = {
            "total_team_logged_hours": summary_data["total_team_logged_hours"],
            "overloaded_count": summary_data["overloaded_count"],
            "team_members_count": summary_data["team_members_count"],
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        }

        if page is not None:
            serializer = self.get_serializer(
                page, many=True, context=serializer_context
            )
            response = self.get_paginated_response(serializer.data)
            response.data["summary"] = summary_header
            return response

        serializer = self.get_serializer(
            queryset, many=True, context=serializer_context
        )
        return Response({"summary": summary_header, "results": serializer.data})
