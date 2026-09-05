"""
Module: accounts.employee.views_employee
Description: Employee self-service views for profile management, avatar uploads, and personal KPI analytics.
"""

import uuid
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.core.files.storage import default_storage
from django.db.models import Sum, Count, F
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


def get_or_create_own_profile(user):
    """Retrieve existing employee profile or initialize a new profile record on first access."""
    profile, _ = EmployeeProfile.objects.get_or_create(
        user=user, defaults={"full_name": user.email}
    )
    return profile


class ProfileView(APIView):
    """Endpoint allowing authenticated users to view and update their personal profile data."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve personal profile details for the authenticated user."""
        profile = get_or_create_own_profile(request.user)
        serializer = EmployeeProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        """Update personal profile fields for the authenticated user."""
        profile = get_or_create_own_profile(request.user)
        serializer = EmployeeProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class AvatarUploadView(APIView):
    """Endpoint enabling authenticated users to upload and update their profile avatar image."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def patch(self, request):
        """Save uploaded avatar image to storage and update profile avatar URL."""
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


class PersonalKPIView(APIView):
    """Endpoint computing personal performance metrics, on-time rates, and logged hours trends."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Calculate and return aggregated personal KPI metrics for authenticated user."""
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

        completed_with_date_qs = completion_tasks.filter(
            status=Task.Status.COMPLETED, completed_at__isnull=False
        )
        completed_with_date_count = completed_with_date_qs.count()
        on_time_count = completed_with_date_qs.filter(
            completed_at__date__lte=F("deadline")
        ).count()
        on_time_rate = (
            (on_time_count / completed_with_date_count) if completed_with_date_count else None
        )

        hours_logged_total = LogWork.objects.filter(user=user).exclude(
            review_status__in=[LogWork.ReviewStatus.VOIDED, LogWork.ReviewStatus.REJECTED]
        ).aggregate(total=Sum("hours_spent"))["total"] or Decimal("0.00")
        productivity_rate = (
            (completed_count / float(hours_logged_total)) if hours_logged_total > 0 else None
        )

        # Reuse completion_tasks (already scoped by start_date/end_date above)
        # instead of a fresh unfiltered queryset — otherwise this breakdown
        # would silently drift out of sync with completion_rate whenever the
        # date-range filter changes (same base filter, defined once).
        status_counts = completion_tasks.values("status").annotate(count=Count("id"))
        task_status_breakdown = {row["status"]: row["count"] for row in status_counts}

        hours_by_project = list(
            LogWork.objects.filter(user=user)
            .exclude(review_status__in=[LogWork.ReviewStatus.VOIDED, LogWork.ReviewStatus.REJECTED])
            .values("task__job__job_name")
            .annotate(total_hours=Sum("hours_spent"))
            .order_by("-total_hours")[:5]
        )

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
            "on_time_rate": {
                "on_time": on_time_count,
                "completed_with_date": completed_with_date_count,
                "rate": on_time_rate,
            },
            "productivity": {
                "tasks_completed": completed_count,
                "hours_logged": float(hours_logged_total),
                "tasks_per_hour": productivity_rate,
            },
            "task_status_breakdown": task_status_breakdown,
            "hours_by_project": hours_by_project,
            "daily_hours_trend": daily_hours_trend,
        }, status=status.HTTP_200_OK)
