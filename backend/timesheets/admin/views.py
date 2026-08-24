from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from accounts.permissions import HasPermission
from system.pagination import AdminPageNumberPagination
from system.security.permissions_manager import IsAdminRole
from timesheets.models import TimeLock
from timesheets.services.timelock_manager_service import (
    TimeLockError,
    lock_global_period,
    unlock_global_period,
)
from timesheets.services.admin_timesheet_service import (
    get_admin_timesheet_summary,
    get_admin_employee_timesheet_list,
    get_admin_employee_timesheet_detail,
)
from system.utils import log_audit_event
from system.services.admin_report_export_service import (
    build_xlsx_response,
    TIMESHEET_HEADERS,
    timesheet_rows,
)
from .serializers import GlobalTimeLockSerializer


def _parse_month_year(params):
    month = params.get("month")
    year = params.get("year")
    if not month or not year:
        raise ValidationError({"detail": "month and year query params are required."})
    try:
        return int(month), int(year)
    except (TypeError, ValueError):
        raise ValidationError({"detail": "month and year must be integers."})


class AdminTimeLockViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GLOBAL-scope TimeLock records only — JOB-scope locks belong to Manager
    (timesheets/manager/) and aren't Admin's to list/toggle here.
    """
    serializer_class = GlobalTimeLockSerializer
    pagination_class = AdminPageNumberPagination

    def get_queryset(self):
        return (
            TimeLock.objects.filter(lock_scope=TimeLock.LockScope.GLOBAL, job__isnull=True)
            .select_related("locked_by", "unlocked_by")
            .order_by("-lock_year", "-lock_month")
        )

    def get_permissions(self):
        if self.action in ("lock", "unlock"):
            return [IsAdminRole(), HasPermission("timelock:global_manage")]
        return [IsAdminRole(), HasPermission("timesheet:view")]

    # POST /api/admin/timesheets/time-locks/lock/  { lock_month, lock_year, reason }
    @action(detail=False, methods=["post"], url_path="lock")
    def lock(self, request):
        month = request.data.get("lock_month")
        year = request.data.get("lock_year")
        if not month or not year:
            raise ValidationError({"detail": "lock_month and lock_year are required."})
        try:
            time_lock = lock_global_period(
                user=request.user,
                lock_month=int(month),
                lock_year=int(year),
                reason=request.data.get("reason"),
                request=request,
            )
        except TimeLockError as exc:
            return Response({"detail": str(exc.detail)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(GlobalTimeLockSerializer(time_lock).data, status=status.HTTP_200_OK)

    # POST /api/admin/timesheets/time-locks/{id}/unlock/  { reason }
    @action(detail=True, methods=["post"], url_path="unlock")
    def unlock(self, request, pk=None):
        time_lock = self.get_object()
        try:
            updated = unlock_global_period(
                user=request.user,
                time_lock=time_lock,
                reason=request.data.get("reason"),
                request=request,
            )
        except TimeLockError as exc:
            return Response({"detail": str(exc.detail)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(GlobalTimeLockSerializer(updated).data, status=status.HTTP_200_OK)


class AdminTimesheetSummaryView(APIView):
    """GET /api/admin/timesheets/summary/?month=&year= — 5 KPI card."""

    def get_permissions(self):
        return [IsAdminRole(), HasPermission("timesheet:view")]

    def get(self, request):
        month, year = _parse_month_year(request.query_params)
        return Response(get_admin_timesheet_summary(month, year))


ORDERING_FIELDS = {
    "full_name", "department_name", "month_hours", "avg_per_day",
    "violations", "status", "last_entry",
}


def get_filtered_employee_rows(params):
    """
    Shared by the list endpoint and the export so both always apply the same
    filters and ordering. Data is computed (not a plain QuerySet DRF can
    filter/sort at the SQL level), so ?ordering= — the same DRF-style
    "field"/"-field" string every other admin/ list page sends via
    useOrdering() — is applied with Python's sort() instead of OrderingFilter.
    """
    month, year = _parse_month_year(params)

    results = get_admin_employee_timesheet_list(
        month,
        year,
        department_id=params.get("department") or None,
        manager_id=params.get("manager") or None,
        search=params.get("search") or None,
    )

    if status_filter := params.get("status"):
        results = [r for r in results if r["status"] == status_filter]

    if ordering := params.get("ordering"):
        field = ordering.lstrip("-")
        if field in ORDERING_FIELDS:
            results.sort(
                key=lambda r: (r[field] is None, r[field]),
                reverse=ordering.startswith("-"),
            )

    return results


class AdminTimesheetEmployeeListView(APIView):
    """
    GET /api/admin/timesheets/employees/?month=&year=&department=&manager=&search=&status=&ordering=&page=
    """

    def get_permissions(self):
        return [IsAdminRole(), HasPermission("timesheet:view")]

    def get(self, request):
        results = get_filtered_employee_rows(request.query_params)
        paginator = AdminPageNumberPagination()
        page = paginator.paginate_queryset(results, request, view=self)
        return paginator.get_paginated_response(page)


class AdminTimesheetExportView(APIView):
    """
    GET /api/admin/timesheets/employees/export/ — same filter/ordering params
    as the employees list, so the file matches what's on screen.
    """

    def get_permissions(self):
        return [IsAdminRole(), HasPermission("timesheet:export")]

    def get(self, request):
        results = get_filtered_employee_rows(request.query_params)
        log_audit_event(
            actor=request.user,
            action="EXPORT",
            table_name="timesheets",
            record_id=0,
            new_values={"filters": dict(request.query_params), "row_count": len(results)},
            request=request,
        )
        return build_xlsx_response(
            sheet_title="Timesheet Summary",
            headers=TIMESHEET_HEADERS,
            rows=timesheet_rows(results),
            filename="worktracker_timesheets.xlsx",
        )


class AdminTimesheetEmployeeDetailView(APIView):
    """GET /api/admin/timesheets/employees/{user_id}/?month=&year= — compliance drill-down."""

    def get_permissions(self):
        return [IsAdminRole(), HasPermission("timesheet:view")]

    def get(self, request, user_id):
        month, year = _parse_month_year(request.query_params)
        return Response(get_admin_employee_timesheet_detail(user_id, month, year))
