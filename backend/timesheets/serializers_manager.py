# timesheets/serializers.py
from rest_framework import serializers
from timesheets.models import TimeLock

class TimeLockSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeLock
        fields = '__all__'
        read_only_fields = ('locked_by', 'locked_at')

    def validate(self, attrs):
        month = attrs.get('lock_month')
        year = attrs.get('lock_year')
        # BR-22, FR-66: Chặn tạo trùng lặp kỳ khóa của cùng 1 tháng/năm
        if TimeLock.objects.filter(lock_month=month, lock_year=year).exists():
            raise serializers.ValidationError("Kỳ báo cáo của tháng này đã được thiết lập.")
        return attrs