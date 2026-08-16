from rest_framework import serializers

from accounts.models import EmployeeProfile


class EmployeeProfileSerializer(serializers.ModelSerializer):
    department = serializers.SlugRelatedField(slug_field="name", read_only=True)

    class Meta:
        model = EmployeeProfile
        fields = ["full_name", "phone_number", "department", "avatar_url", "joined_date", "updated_at"]
        read_only_fields = ["department", "avatar_url", "joined_date", "updated_at"]

class AvatarUploadSerializer(serializers.Serializer):
    avatar = serializers.ImageField()

    def validate_avatar(self, value):
        max_size = 2 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("Avatar file must be 2MB or smaller.")
        return value

class PersonalKPIQuerySerializer(serializers.Serializer):
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
