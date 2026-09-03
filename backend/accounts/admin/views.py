"""
Module: accounts.admin.views
Description: Admin viewsets for user lifecycle management, role queries, and department administration.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.db.models import Q, RestrictedError
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from system.security.permissions_manager import IsAdminRole
from system.pagination import AdminPageNumberPagination

from ..models import (
    CustomUser,
    Role,
    Department,
    EmployeeProfile,
)
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    RoleSerializer,
    DepartmentSerializer,
)
from ..permissions import HasPermission
from ..authentication import set_user_active_status, require_reauth
from system.models import AuditLog, Notification
from system.utils import log_audit_event
from system.services.notification_manager_service import notify
from accounts.services.account_email_service import send_welcome_email
from system.services.admin_report_export_service import (
    build_xlsx_response,
    USER_HEADERS,
    user_rows,
    DEPARTMENT_HEADERS,
    department_rows,
)


def notify_other_admins(actor, title, content=None, related_url=None):
    """Send in-app notification to all other active administrators for sensitive IAM actions."""
    other_admins = CustomUser.objects.filter(role__code="ADMIN").exclude(id=actor.id)
    notify(
        recipients=other_admins,
        event_type=Notification.EventType.ACCOUNT_OR_PERMISSION_CHANGED,
        title=title,
        content=content,
        related_url=related_url,
    )


def assert_not_self(actor, target, what):
    """Prevent administrators from performing destructive or lock actions on their own account."""
    if actor.id == target.id:
        raise ValidationError(
            f"You cannot {what} your own account. "
            "Ask another Admin to do it if it is really needed."
        )


def assert_not_last_admin(target, what):
    """Prevent locking or demoting the last remaining active administrator account."""
    target_is_admin = getattr(target.role, "code", None) == "ADMIN"
    if not target_is_admin or not target.is_active:
        return
    remaining = (
        CustomUser.objects.filter(role__code="ADMIN", is_active=True)
        .exclude(id=target.id)
        .count()
    )
    if remaining == 0:
        raise ValidationError(
            f"Cannot {what} the last active Admin. "
            "Create or unlock another Admin first."
        )


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet managing user account lifecycle, role assignment, and administrative locks."""

    serializer_class = UserSerializer
    pagination_class = AdminPageNumberPagination
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['email', 'role__code', 'is_active', 'profile__department__name', 'profile__manager__email']

    def get_queryset(self):
        """Retrieve paginated and filtered list of user accounts."""
        qs = CustomUser.objects.select_related(
            "role", "profile", "profile__department", "profile__manager"
        ).order_by("id")
        params = self.request.query_params
        if email := params.get("email"):
            qs = qs.filter(email__icontains=email)
        if role := params.get("role"):
            qs = qs.filter(role__code=role)
        if department := params.get("department"):
            qs = qs.filter(profile__department_id=department)
        if manager := params.get("manager"):
            if manager.lower() == "none":
                qs = qs.filter(role__code="EMPLOYEE", profile__manager__isnull=True)
            else:
                qs = qs.filter(profile__manager_id=manager)
        if (is_active := params.get("is_active")) not in (None, ""):
            qs = qs.filter(is_active=is_active.lower() == "true")
        return qs

    def get_permissions(self):
        """Return permission classes configured for specific user management actions."""
        if self.action == "create":
            return [IsAdminRole(), HasPermission("user:create")]
        if self.action in ("list", "retrieve"):
            return [IsAdminRole(), HasPermission("user:view")]
        if self.action == "reset_password":
            return [IsAdminRole(), HasPermission("user:reset_password")]
        if self.action == "export":
            return [IsAdminRole(), HasPermission("user:view")]
        if self.action in ("lock", "unlock", "destroy"):
            return [IsAdminRole(), HasPermission("user:lock")]
        return [IsAdminRole(), HasPermission("user:update")]

    def get_serializer_class(self):
        """Return dedicated creation serializer for POST requests or default serializer."""
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        """Export filtered user list to an Excel spreadsheet."""
        queryset = self.filter_queryset(self.get_queryset())
        log_audit_event(
            actor=request.user,
            action="EXPORT",
            table_name="users",
            record_id=0,
            new_values={"filters": dict(request.query_params), "row_count": queryset.count()},
            request=request,
        )
        return build_xlsx_response(
            sheet_title="Users",
            headers=USER_HEADERS,
            rows=user_rows(queryset),
            filename="worktracker_users.xlsx",
        )

    @transaction.atomic
    def perform_create(self, serializer):
        """Persist new user account and dispatch welcome email on transaction commit."""
        raw_password = serializer.validated_data.get("password")
        instance = serializer.save()

        transaction.on_commit(
            lambda: send_welcome_email(instance, temp_password=raw_password)
        )

    @transaction.atomic
    def perform_update(self, serializer):
        """Update user record, enforce admin safeguards, and invalidate tokens on role change."""
        old_role_id = serializer.instance.role_id
        old_role_code = getattr(serializer.instance.role, "code", None)

        new_role = serializer.validated_data.get("role")
        if new_role is not None and new_role.id != old_role_id:
            assert_not_self(self.request.user, serializer.instance, "change the role of")
            assert_not_last_admin(serializer.instance, "change the role of")

        old_values = UserSerializer(serializer.instance).data
        instance = serializer.save()

        if instance.role_id != old_role_id:
            require_reauth(instance.id)

            new_role_code = getattr(instance.role, "code", None)
            if old_role_code == "MANAGER" and new_role_code != "MANAGER":
                orphaned = list(
                    EmployeeProfile.objects.filter(manager_id=instance.id).values_list(
                        "user_id", flat=True
                    )
                )
                if orphaned:
                    EmployeeProfile.objects.filter(manager_id=instance.id).update(manager=None)
                    log_audit_event(
                        actor=self.request.user,
                        action="UPDATE",
                        table_name="employee_profiles",
                        record_id=instance.id,
                        old_values={"manager_id": instance.id, "affected_user_ids": orphaned},
                        new_values={"manager_id": None, "affected_count": len(orphaned)},
                        request=self.request,
                        severity=AuditLog.Severity.WARNING,
                    )
                    notify_other_admins(
                        self.request.user,
                        title="Employees need a new Manager",
                        content=(
                            f"{instance.email} is no longer a Manager. "
                            f"{len(orphaned)} employee(s) were removed from that reporting "
                            f"line and are waiting to be reassigned."
                        ),
                        related_url="/admin/users/search?manager=none",
                    )
            log_audit_event(
                actor=self.request.user,
                action="ROLE_CHANGED",
                table_name="users",
                record_id=instance.id,
                old_values=old_values,
                new_values=UserSerializer(instance).data,
                request=self.request,
                severity=AuditLog.Severity.WARNING,
            )
            notify_other_admins(
                self.request.user,
                title="Role changed",
                content=f"{self.request.user.email} changed the role of {instance.email}.",
                related_url=f"/admin/users/search?edit={instance.id}",
            )

    @transaction.atomic
    def perform_destroy(self, instance):
        """Soft-deactivate account on destroy action and record audit log."""
        assert_not_self(self.request.user, instance, "delete")
        assert_not_last_admin(instance, "delete")

        old_values = UserSerializer(instance).data
        instance.is_active = False
        instance.save()
        set_user_active_status(instance.id, False)
        log_audit_event(
            actor=self.request.user,
            action="LOCK_ACCOUNT",
            table_name="users",
            record_id=instance.id,
            old_values=old_values,
            severity=AuditLog.Severity.WARNING,
            request=self.request,
        )
        notify_other_admins(
            self.request.user,
            title="Account locked",
            content=f"{self.request.user.email} locked the account {instance.email}.",
            related_url=f"/admin/users/search?edit={instance.id}",
        )

    @transaction.atomic
    @action(detail=True, methods=["patch"], url_path="lock")
    def lock(self, request, pk=None):
        """Deactivate account and update cache status."""
        user = self.get_object()
        assert_not_self(request.user, user, "lock")
        assert_not_last_admin(user, "lock")

        old_values = UserSerializer(user).data
        user.is_active = False
        user.save()
        set_user_active_status(user.id, False)
        log_audit_event(
            actor=request.user,
            action="LOCK_ACCOUNT",
            table_name="users",
            record_id=user.id,
            old_values=old_values,
            new_values={"is_active": False},
            request=request,
            severity=AuditLog.Severity.WARNING,
        )
        notify_other_admins(
            request.user,
            title="Account locked",
            content=f"{request.user.email} locked the account {user.email}.",
            related_url=f"/admin/users/search?edit={user.id}",
        )
        return Response({"detail": "User locked."}, status=status.HTTP_200_OK)

    @transaction.atomic
    @action(detail=True, methods=["patch"], url_path="unlock")
    def unlock(self, request, pk=None):
        """Reactivate account and refresh cache status."""
        user = self.get_object()
        user.is_active = True
        user.save()
        set_user_active_status(user.id, True)
        log_audit_event(
            actor=request.user,
            action="UNLOCK_ACCOUNT",
            table_name="users",
            record_id=user.id,
            new_values={"is_active": True},
            request=request,
            severity=AuditLog.Severity.WARNING,
        )
        notify_other_admins(
            request.user,
            title="Account unlocked",
            content=f"{request.user.email} unlocked the account {user.email}.",
            related_url=f"/admin/users/search?edit={user.id}",
        )
        return Response({"detail": "User unlocked."}, status=status.HTTP_200_OK)

    @transaction.atomic
    @action(detail=True, methods=["patch"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        """Directly set new user password by admin with mandatory change flag."""
        user = self.get_object()
        new_password = request.data.get("new_password")
        if not new_password:
            return Response(
                {"new_password": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user)
        except DjangoValidationError as exc:
            return Response({"new_password": exc.messages}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.must_change_password = True
        user.save()
        log_audit_event(
            actor=request.user,
            action="RESET_PASSWORD",
            table_name="users",
            record_id=user.id,
            new_values={"must_change_password": True},
            request=request,
            severity=AuditLog.Severity.WARNING,
        )
        notify_other_admins(
            request.user,
            title="Password reset",
            content=f"{request.user.email} reset the password for {user.email}.",
            related_url=f"/admin/users/search?edit={user.id}",
        )
        return Response({"detail": "Password reset."}, status=status.HTTP_200_OK)

    @transaction.atomic
    @action(detail=True, methods=["patch"], url_path="assign-department")
    def assign_department(self, request, pk=None):
        """Assign employee to a specific department and record audit update."""
        user = self.get_object()
        department_id = request.data.get("department")

        try:
            old_dept_id = user.profile.department_id
        except EmployeeProfile.DoesNotExist:
            old_dept_id = None
        profile, _ = EmployeeProfile.objects.get_or_create(
            user=user, defaults={"full_name": user.email}
        )
        profile.department_id = department_id
        profile.save()

        log_audit_event(
            actor=request.user,
            action="UPDATE",
            table_name="employee_profiles",
            record_id=user.id,
            old_values={"department_id": old_dept_id},
            new_values={"department_id": department_id},
            request=request,
        )
        return Response({"detail": "Department assigned."}, status=status.HTTP_200_OK)

    @transaction.atomic
    @action(detail=True, methods=["patch"], url_path="assign-manager")
    def assign_manager(self, request, pk=None):
        """Assign employee reporting manager and record audit log."""
        user = self.get_object()
        manager_id = request.data.get("manager")

        if user.role and user.role.code != "EMPLOYEE":
            raise ValidationError("Only EMPLOYEE accounts can have an assigned Manager.")

        if manager_id is not None:
            manager = CustomUser.objects.filter(id=manager_id).select_related("role").first()
            if manager is None:
                raise ValidationError("Manager does not exist.")
            if not manager.is_active:
                raise ValidationError("Cannot assign to a locked Manager.")
            if not manager.role or manager.role.code != "MANAGER":
                raise ValidationError("The assigned user must have the MANAGER role.")

        try:
            old_manager_id = user.profile.manager_id
        except EmployeeProfile.DoesNotExist:
            old_manager_id = None
        profile, _ = EmployeeProfile.objects.get_or_create(
            user=user, defaults={"full_name": user.email}
        )
        profile.manager_id = manager_id
        profile.save()

        log_audit_event(
            actor=request.user,
            action="UPDATE",
            table_name="employee_profiles",
            record_id=user.id,
            old_values={"manager_id": old_manager_id},
            new_values={"manager_id": manager_id},
            request=request,
            severity=AuditLog.Severity.WARNING,
        )
        return Response({"detail": "Manager assigned."}, status=status.HTTP_200_OK)


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset listing available system roles for admin interfaces."""

    queryset = Role.objects.all()
    serializer_class = RoleSerializer

    def get_permissions(self):
        """Return required permissions for role queries."""
        return [IsAdminRole(), HasPermission("user:view")]


class DepartmentViewSet(viewsets.ModelViewSet):
    """ViewSet managing organizational departments and employee group assignments."""

    serializer_class = DepartmentSerializer
    pagination_class = AdminPageNumberPagination
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['name', 'description', 'manager__email']

    def get_queryset(self):
        """Retrieve ordered and search-filtered department list."""
        qs = Department.objects.select_related("manager").order_by("-created_at")
        if search := self.request.query_params.get("search"):
            qs = qs.filter(
                Q(name__icontains=search) | Q(manager__email__icontains=search)
            )
        return qs

    def get_permissions(self):
        """Configure permissions per department action."""
        if self.action == "create":
            return [IsAdminRole(), HasPermission("department:create")]
        if self.action in ("list", "retrieve"):
            return [IsAdminRole(), HasPermission("department:view")]
        if self.action == "destroy":
            return [IsAdminRole(), HasPermission("department:delete")]
        if self.action == "export":
            return [IsAdminRole(), HasPermission("department:view")]
        return [IsAdminRole(), HasPermission("department:update")]

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        """Export department list to an Excel spreadsheet."""
        queryset = self.filter_queryset(self.get_queryset())
        log_audit_event(
            actor=request.user,
            action="EXPORT",
            table_name="departments",
            record_id=0,
            new_values={"filters": dict(request.query_params), "row_count": queryset.count()},
            request=request,
        )
        return build_xlsx_response(
            sheet_title="Departments",
            headers=DEPARTMENT_HEADERS,
            rows=department_rows(queryset),
            filename="worktracker_departments.xlsx",
        )

    @transaction.atomic
    def perform_create(self, serializer):
        """Save new department record and write audit log."""
        instance = serializer.save()
        log_audit_event(
            actor=self.request.user,
            action="CREATE",
            table_name="departments",
            record_id=instance.id,
            new_values=DepartmentSerializer(instance).data,
            request=self.request,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        """Update department record and record old versus new values in audit log."""
        old_values = DepartmentSerializer(self.get_object()).data
        instance = serializer.save()
        log_audit_event(
            actor=self.request.user,
            action="UPDATE",
            table_name="departments",
            record_id=instance.id,
            old_values=old_values,
            new_values=DepartmentSerializer(instance).data,
            request=self.request,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        """Delete department if no employees are assigned, logging the audit event."""
        old_values = DepartmentSerializer(instance).data
        record_id = instance.id

        try:
            instance.delete()
        except RestrictedError:
            employee_count = instance.employees.count()
            raise ValidationError(
                {"detail": f"Cannot delete department: {employee_count} employee(s) are still assigned to it."}
            )

        log_audit_event(
            actor=self.request.user,
            action="DELETE",
            table_name="departments",
            record_id=record_id,
            old_values=old_values,
            request=self.request,
        )
