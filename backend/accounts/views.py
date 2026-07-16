from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import CustomUser, EmployeeProfile, Role, Permission, Department
from .serializers import UserSerializer, UserCreateSerializer, RoleSerializer, PermissionSerializer, DepartmentSerializer
from .permissions import HasPermission
from .authentication import set_user_active_status
# Create your views here.

class UserViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.select_related('role', 'profile').all()
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [HasPermission('user:create')]
        return [HasPermission('user:update')]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer
    
    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()
        set_user_active_status(instance.id, False)

    @action(detail=True, methods=['patch'], url_path='lock')
    def lock(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save()
        set_user_active_status(user.id, False)
        return Response({ 'detail': 'User locked.'}, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['patch'], url_path='unlock')
    def unlock(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save()
        set_user_active_status(user.id, True)
        return Response({ 'detail': 'User unlocked.'}, status=status.HTTP_200_OK)
    
class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    
    def get_permissions(self):
        return [HasPermission('role:manage')]
    
class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    
    def get_permissions(self):
        return [HasPermission('role:manage')]
    
class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.select_related('manager').all() #lấy thông tin manager trong 1 query
    serializer_class = DepartmentSerializer
    
    def get_permissions(self):
        if self.action == 'create':
            return [HasPermission('department:create')]
        return [HasPermission('department:update')]
    #tạo phòng = request permission create, sửa/xóa = request permission update
    
    
    
    
    