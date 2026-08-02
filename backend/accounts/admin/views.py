from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import CustomUser, Role, Permission, RolePermission, Department, EmployeeProfile
from .serializers import (
    UserSerializer, UserCreateSerializer,
    RoleSerializer, PermissionSerializer, DepartmentSerializer,
)
from ..permissions import HasPermission
from ..authentication import set_user_active_status
from system.utils import log_audit_event

class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    
    def get_queryset(self):
        qs = CustomUser.objects.select_related('role', 'profile').all()
        params = self.request.query_params
        if email := params.get('email'):
            qs = qs.filter(email__icontains=email)
        if role := params.get('role'):
            qs = qs.filter(role__code=role)
        if department := params.get('department'):
            qs = qs.filter(profile__department_id=department)
        if (is_active := params.get('is_active')) is not None:
            qs = qs.filter(is_active=is_active.lower()=='true')
        return qs
        
    def get_permissions(self):
        if self.action == 'create':
            return [HasPermission('user:create')]
        return [HasPermission('user:update')]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    @transaction.atomic
    def perform_destroy(self, instance):
        old_values = UserSerializer(instance).data
        instance.is_active = False
        instance.save()
        set_user_active_status(instance.id, False)
        log_audit_event(
            actor=self.request.user,
            action='DELETE',
            table_name='users',
            record_id=instance.id,
            old_values=old_values,
            request=self.request,
        )

    @transaction.atomic
    @action(detail=True, methods=['patch'], url_path='lock')
    def lock(self, request, pk=None):
        user = self.get_object()
        old_values = UserSerializer(user).data
        user.is_active = False
        user.save()
        set_user_active_status(user.id, False)
        log_audit_event(
            actor=request.user,
            action='LOCK_ACCOUNT',
            table_name='users',
            record_id=user.id,
            old_values=old_values,
            new_values={'is_active': False},
            request=request,
        )
        return Response({'detail': 'User locked.'}, status=status.HTTP_200_OK)

    @transaction.atomic
    @action(detail=True, methods=['patch'], url_path='unlock')
    def unlock(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save()
        set_user_active_status(user.id, True)
        log_audit_event(
            actor=request.user,
            action='UNLOCK_ACCOUNT',
            table_name='users',
            record_id=user.id,
            new_values={'is_active': True},
            request=request,
        )
        return Response({'detail': 'User unlocked.'}, status=status.HTTP_200_OK)

    @transaction.atomic
    @action(detail=True, methods=['patch'], url_path='assign-department')
    def assign_department(self, request, pk=None):
        user = self.get_object()
        department_id = request.data.get('department')
        old_dept_id = user.profile.department_id if hasattr(user, 'profile') else None
        profile, _ = EmployeeProfile.objects.get_or_create(user=user)
        profile.department_id = department_id
        profile.save()
        log_audit_event(
            actor=request.user,
            action='UPDATE',
            table_name='employee_profiles',
            record_id=user.id,
            old_values={'department_id': old_dept_id},
            new_values={'department_id': department_id},
            request=request,
        )
        return Response({'detail': 'Department assigned.'}, status=status.HTTP_200_OK)



class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer

    def get_permissions(self):
        return [HasPermission('role:manage')]
    
    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        log_audit_event(
            actor=self.request.user,
            action='CREATE',
            table_name='roles',
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
            action='UPDATE',
            table_name='roles',
            record_id=instance.id,
            old_values=old_values,
            new_values=RoleSerializer(instance).data,
            request=self.request,
        )

    @transaction.atomic
    @action(detail=True, methods=['post'], url_path='assign-permissions')
    def assign_permissions(self, request, pk=None):
        role = self.get_object()
        permission_ids = request.data.get('permission_ids', [])
        old_ids = list(role.role_permissions.values_list('permission_id', flat=True))
        role.role_permissions.all().delete()
        RolePermission.objects.bulk_create([
            RolePermission(role=role, permission_id=pid) for pid in permission_ids
        ])
        log_audit_event(
            actor=request.user,
            action='ASSIGN_ROLE',
            table_name='role_permissions',
            record_id=role.id,
            old_values={'permission_ids': old_ids},
            new_values={'permission_ids': permission_ids},
            request=request,
        )
        return Response({'detail': 'Permissions assigned.'}, status=status.HTTP_200_OK)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer

    def get_permissions(self):
        return [HasPermission('role:manage')]


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.select_related('manager').all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [HasPermission('department:create')]
        return [HasPermission('department:update')]

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        log_audit_event(
            actor=self.request.user,
            action='CREATE',
            table_name='departments',
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
            action='UPDATE',
            table_name='departments',
            record_id=instance.id,
            old_values=old_values,
            new_values=DepartmentSerializer(instance).data,
            request=self.request,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        old_values = DepartmentSerializer(instance).data
        record_id = instance.id
        instance.delete()
        log_audit_event(
            actor=self.request.user,
            action='DELETE',
            table_name='departments',
            record_id=record_id,
            old_values=old_values,
            request=self.request,
        )
