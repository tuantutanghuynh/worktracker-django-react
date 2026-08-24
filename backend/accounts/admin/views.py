from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.db.models import Q, RestrictedError
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from system.security.permissions_manager import ROLE_PERMISSION_CACHE_KEY, IsAdminRole
from system.pagination import AdminPageNumberPagination

from ..models import (
    CustomUser,
    Role,
    Permission,
    RolePermission,
    Department,
    EmployeeProfile,
)
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    RoleSerializer,
    PermissionSerializer,
    DepartmentSerializer,
)
from ..permissions import HasPermission
from ..authentication import set_user_active_status, require_reauth
from system.models import AuditLog, Notification
from system.utils import log_audit_event
from system.services.notification_manager_service import notify


# Sends an in-app notification to every OTHER admin when one admin performs
# a sensitive IAM action (role change, lock/unlock, reset password) — so
# admins stay aware of each other's changes without having to poll the
# Audit Logs page. Deliberately scoped to the same actions already flagged
# severity=WARNING/CRITICAL (see the log_audit_event calls below), not every
# CRUD write, to avoid flooding the bell with routine edits.
def notify_other_admins(actor, title, content=None, related_url=None):
    other_admins = CustomUser.objects.filter(role__code="ADMIN").exclude(id=actor.id)
    notify(
        recipients=other_admins,
        event_type=Notification.EventType.ACCOUNT_OR_PERMISSION_CHANGED,
        title=title,
        content=content,
        related_url=related_url,
    )


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    pagination_class = AdminPageNumberPagination
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['email', 'role__code', 'is_active', 'profile__department__name']

    def get_queryset(self):
        # Explicit default order for stable pagination — CustomUser has no
        # created_at field, so id is the simplest always-present tiebreaker.
        qs = CustomUser.objects.select_related("role", "profile", "profile__department").order_by("id")
        params = self.request.query_params
        if email := params.get("email"):
            qs = qs.filter(email__icontains=email)
        if role := params.get("role"):
            qs = qs.filter(role__code=role)
        if department := params.get("department"):
            qs = qs.filter(profile__department_id=department)
        if (is_active := params.get("is_active")) not in (None, ""):
            qs = qs.filter(is_active=is_active.lower() == "true")
        return qs

    def get_permissions(self):
        if self.action == "create":
            return [IsAdminRole(), HasPermission("user:create")]
        if self.action in ("list", "retrieve"):
            return [IsAdminRole(), HasPermission("user:view")]
        if self.action == "reset_password":
            return [IsAdminRole(), HasPermission("user:reset_password")]
        # destroy is grouped with lock/unlock, not update: perform_destroy
        # below doesn't actually delete the row, it deactivates the account
        # exactly like lock() does (see its docstring comment).
        if self.action in ("lock", "unlock", "destroy"):
            return [IsAdminRole(), HasPermission("user:lock")]
        return [IsAdminRole(), HasPermission("user:update")]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    # Forces any already-issued token to re-authenticate the moment the
    # role actually changes — without this, a demoted admin's existing
    # session keeps rendering the Admin UI (client-side `user.role` is only
    # refreshed at login) even though every write action already 403s on
    # the backend, since HasPermission re-checks role live from the DB.
    @transaction.atomic
    def perform_update(self, serializer):
        old_role_id = serializer.instance.role_id
        old_values = UserSerializer(serializer.instance).data
        instance = serializer.save()

        if instance.role_id != old_role_id:
            require_reauth(instance.id)
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

    # DRF's standard DELETE verb — deliberately doesn't remove the row (same
    # effect as lock(), just reachable through the generic REST endpoint
    # instead of the dedicated /lock/ action). Logged as LOCK_ACCOUNT, not
    # DELETE, so Audit Logs reflects what actually happened to the record.
    @transaction.atomic
    def perform_destroy(self, instance):
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
        user = self.get_object()
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
        user = self.get_object()
        department_id = request.data.get("department")

        # old_dept_id = user.profile.department_id if hasattr(user, 'profile') else None
        # profile, _ = EmployeeProfile.objects.get_or_create(user=user)
        # profile.department_id = department_id
        # profile.save()

        # Code mới đã sửa : 
        # hasattr(user, 'profile') không bắt được lỗi DoesNotExist trong Django
        # chỉ bắt được lỗi AttributeErrort nên khi ném lỗi DoesNotExist sẽ lỗi HTTP 500 Internal Server Error.
        # full_name trong models not null nên khi tạo profile mới mà không có full_name 
        # sẽ ném lỗi IntegrityError => HTTP 500 Internal Server Error.

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


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer

    def get_permissions(self):
        return [IsAdminRole(), HasPermission("role:manage")]

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        log_audit_event(
            actor=self.request.user,
            action="CREATE",
            table_name="roles",
            record_id=instance.id,
            new_values=RoleSerializer(instance).data,
            request=self.request,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        old_values = RoleSerializer(self.get_object()).data
        instance = serializer.save()
        log_audit_event(
            actor=self.request.user,
            action="UPDATE",
            table_name="roles",
            record_id=instance.id,
            old_values=old_values,
            new_values=RoleSerializer(instance).data,
            request=self.request,
        )

    @transaction.atomic
    @action(detail=True, methods=["post"], url_path="assign-permissions")
    def assign_permissions(self, request, pk=None):
        role = self.get_object()
        permission_ids = request.data.get("permission_ids", [])
        old_ids = list(role.role_permissions.values_list("permission_id", flat=True))
        role.role_permissions.all().delete()
        RolePermission.objects.bulk_create(
            [RolePermission(role=role, permission_id=pid) for pid in permission_ids]
        )
        cache.delete(ROLE_PERMISSION_CACHE_KEY.format(role_id=role.id))
        log_audit_event(
            actor=request.user,
            action="ASSIGN_ROLE",
            table_name="role_permissions",
            record_id=role.id,
            old_values={"permission_ids": old_ids},
            new_values={"permission_ids": permission_ids},
            request=request,
        )
        return Response({"detail": "Permissions assigned."}, status=status.HTTP_200_OK)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer

    def get_permissions(self):
        return [IsAdminRole(), HasPermission("role:manage")]


class DepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer
    pagination_class = AdminPageNumberPagination
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['name', 'description', 'manager__email']

    def get_queryset(self):
        # See UserViewSet.get_queryset() — explicit order needed for stable pagination.
        qs = Department.objects.select_related("manager").order_by("-created_at")
        if search := self.request.query_params.get("search"):
            qs = qs.filter(
                Q(name__icontains=search) | Q(manager__email__icontains=search)
            )
        return qs

    def get_permissions(self):
        if self.action == "create":
            return [IsAdminRole(), HasPermission("department:create")]
        if self.action in ("list", "retrieve"):
            return [IsAdminRole(), HasPermission("department:view")]
        if self.action == "destroy":
            return [IsAdminRole(), HasPermission("department:delete")]
        return [IsAdminRole(), HasPermission("department:update")]

    @transaction.atomic
    def perform_create(self, serializer):
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
        old_values = DepartmentSerializer(instance).data
        record_id = instance.id

        # EmployeeProfile.department is on_delete=RESTRICT (accounts/models.py)
        # — deleting a department that still has employees assigned raises
        # this instead of silently cascading, so surface it as a proper 400
        # instead of letting it bubble up as an unhandled 500.
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
