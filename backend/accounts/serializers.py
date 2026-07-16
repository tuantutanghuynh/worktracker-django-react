from rest_framework import serializers
from .models import Role,Permission,CustomUser,Department,EmployeeProfile

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'code', 'name', 'description']
    #Serialize Role - chỉ trả về 4 field

class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'code', 'name']
# Serialize Permission — dùng để hiển thị danh sách quyền

class EmployeeProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeProfile
        fields = ['full_name', 'phone_number', 'department', 'avatar_url']
#serializer pro5 cá nhân

class UserSerializer(serializers.ModelSerializer):
    profile = EmployeeProfileSerializer(read_only=True)
    #trả về user kèm pro5 -> nested serializer
    role_detail = RoleSerializer(source='role', read_only=True)
    #trả thông tin role (code + name) - source = role: lấy dữ liệu từ field role
        
    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'role', 'role_detail', 'is_active', 'profile']
        extra_kwargs = {
            'role': {'write_only': True},
            #role: tạo & sửa
            #role_detail: trả ttin đọc (read)
        }

class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    #write_only=True: chỉ write - không response

    class Meta: 
        model = CustomUser
        fields = ['email', 'password', 'role', 'is_active']
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        #tách password ra khỏi data trước khi tạo user
        user = CustomUser(**validated_data)
        user.set_password(password)
        #set_password(): hash mật khẩu
        user.save()
        return user
    
class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id','manager', 'name', 'description','created_at']
    #Serialize Department