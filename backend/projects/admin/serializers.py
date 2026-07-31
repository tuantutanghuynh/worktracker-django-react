from rest_framework import serializers
from ..models import Client, Job


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'


class JobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = '__all__'

    def validate_client(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Cannot assign job to an inactive client.")
        return value
