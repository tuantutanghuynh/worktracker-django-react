import uuid
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.core.files.storage import default_storage
from django.db.models import Sum, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser
from rest_framework import status

from tasks.models import Task
from timesheets.models import LogWork

from accounts.models import EmployeeProfile
from accounts.employee.serializers_employee import (
    EmployeeProfileSerializer, AvatarUploadSerializer, PersonalKPIQuerySerializer,
)




# EmployeeProfile is only auto-created for accounts made through
# /api/auth/users/ — Admin/Manager accounts provisioned by createsuperuser
# or seed scripts have no profile row, and this endpoint is open to every
# authenticated role, so create it on first access instead of 404ing them
# out of their own profile page. full_name is NOT NULL, hence the default
# (same fallback used by UserViewSet.assign_department).
def get_or_create_own_profile(user):
    profile, _ = EmployeeProfile.objects.get_or_create(
        user=user, defaults={"full_name": user.email}
    )
    return profile


# Lets any logged-in user view and edit their own profile (full_name, phone_number only).
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = get_or_create_own_profile(request.user)
        serializer = EmployeeProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        profile = get_or_create_own_profile(request.user)
        serializer = EmployeeProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

# Lets the caller replace their own avatar image, saving it to MEDIA_ROOT
# and storing the resulting URL on their profile.
class AvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def patch(self, request):
        profile = get_or_create_own_profile(request.user)

        serializer = AvatarUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        avatar = serializer.validated_data["avatar"]

        extension = Path(avatar.name).suffix
        filename = f"avatars/{uuid.uuid4().hex}{extension}"
        saved_path = default_storage.save(filename, avatar)

        profile.avatar_url = default_storage.url(saved_path)
        profile.save(update_fields=["avatar_url"])

        return Response({"avatar_url": profile.avatar_url}, status=status.HTTP_200_OK)

# Employee's own KPI: overdue task count (as of now), hours logged this
# calendar week (Mon-Sun), and completion rate over an optional date range
# (defaults to all-time) — filtered by Task.deadline, not creation date.
class PersonalKPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = PersonalKPIQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        start_date = query.validated_data.get("start_date")
        end_date = query.validated_data.get("end_date")

        user = request.user
        today = timezone.localdate()

        overdue_tasks_count = Task.objects.filter(
            assignee=user,
            deadline__lt=today,
        ).exclude(
            status__in=[Task.Status.COMPLETED, Task.Status.CANCELLED],
        ).count()

        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        hours_this_week = LogWork.objects.filter(
            user=user,
            work_date__range=(week_start, week_end),
        ).exclude(
            review_status__in=[LogWork.ReviewStatus.VOIDED, LogWork.ReviewStatus.REJECTED],
        ).aggregate(total=Sum("hours_spent"))["total"] or Decimal("0.00")

        completion_tasks = Task.objects.filter(assignee=user).exclude(
            status=Task.Status.CANCELLED
        )
        if start_date:
            completion_tasks = completion_tasks.filter(deadline__gte=start_date)
        if end_date:
            completion_tasks = completion_tasks.filter(deadline__lte=end_date)

        total_count = completion_tasks.count()
        completed_count = completion_tasks.filter(status=Task.Status.COMPLETED).count()
        completion_rate = (completed_count / total_count) if total_count else None

                # Task status breakdown — how many of the user's own tasks sit in
        # each status. Excludes CANCELLED, same as completion_rate above,
        # so a cancelled task doesn't skew either metric.
        status_counts = (
            Task.objects.filter(assignee=user)
            .exclude(status=Task.Status.CANCELLED)
            .values("status")
            .annotate(count=Count("id"))
        )
        task_status_breakdown = {row["status"]: row["count"] for row in status_counts}

        # Hours by project — top 5 projects by hours logged, all-time.
        # LogWork -> task -> job is a read-only cross-app join (job/task
        # belong to Minh Anh/Long's apps); never writes to those tables.
        hours_by_project = list(
            LogWork.objects.filter(user=user)
            .exclude(review_status__in=[LogWork.ReviewStatus.VOIDED, LogWork.ReviewStatus.REJECTED])
            .values("task__job__job_name")
            .annotate(total_hours=Sum("hours_spent"))
            .order_by("-total_hours")[:5]
        )

        # Daily hours trend — last 14 days, including days with 0 hours
        # (the frontend line chart needs a continuous x-axis, not gaps).
        trend_start = today - timedelta(days=13)
        logged_by_day = {
            row["work_date"]: row["total"]
            for row in LogWork.objects.filter(
                user=user, work_date__range=(trend_start, today)
            )
            .exclude(review_status__in=[LogWork.ReviewStatus.VOIDED, LogWork.ReviewStatus.REJECTED])
            .values("work_date")
            .annotate(total=Sum("hours_spent"))
        }
        daily_hours_trend = [
            {
                "date": trend_start + timedelta(days=i),
                "hours": logged_by_day.get(trend_start + timedelta(days=i), Decimal("0.00")),
            }
            for i in range(14)
        ]



        return Response({
            "overdue_tasks_count": overdue_tasks_count,
            "hours_logged_this_week": hours_this_week,
            "week_start": week_start,
            "week_end": week_end,
            "completion_rate": {
                "start_date": start_date,
                "end_date": end_date,
                "completed": completed_count,
                "total": total_count,
                "rate": completion_rate,
            },
            "task_status_breakdown": task_status_breakdown,
            "hours_by_project": hours_by_project,
            "daily_hours_trend": daily_hours_trend,

        }, status=status.HTTP_200_OK)
