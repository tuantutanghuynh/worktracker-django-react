from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import serializers
from ..models import Client, Job
from tasks.models import Task


class ClientSerializer(serializers.ModelSerializer):
    # Khai bao tay de BO UniqueValidator ma DRF tu them tu model
    # (tax_code co unique=True). Validator mac dinh tra ve cau chung chung
    # "client with this tax code already exists." — khong cho Admin biet ho
    # dang dung ma so thue cua ai, va cang khong biet ban ghi do da bi khoa.
    tax_code = serializers.CharField(max_length=50, validators=[])

    class Meta:
        model = Client
        fields = '__all__'

    def _khac_chinh_no(self, queryset):
        """Bo chinh ban ghi dang sua ra khoi phep kiem tra trung.

        Khong co buoc nay thi moi lan sua mot client ma giu nguyen ten se bi
        bao "ten da ton tai" — chinh no dung do.
        """
        if self.instance is not None:
            return queryset.exclude(pk=self.instance.pk)
        return queryset

    def validate_client_name(self, value):
        """
        Ten khach hang khong duoc trung.

        So sanh khong phan biet hoa thuong va da cat khoang trang: "ABC Corp",
        "abc corp" va " ABC Corp " la cung mot cong ty. Neu chi so chuoi thuan
        thi Admin van tao duoc 3 ban ghi trong danh sach nhin y het nhau.
        """
        ten = (value or "").strip()
        if not ten:
            raise serializers.ValidationError("Client name is required.")

        trung = (
            self._khac_chinh_no(Client.objects.filter(client_name__iexact=ten))
            .order_by("-is_active", "id")
            .first()
        )
        if trung is not None:
            if not trung.is_active:
                # Bao ro la ban ghi da khoa, neu khong Admin se boi roi vi
                # tim trong danh sach khong thay client nao ten nhu vay.
                raise serializers.ValidationError(
                    f"A deactivated client named '{trung.client_name}' already exists "
                    f"(tax code {trung.tax_code}). Reactivate that client instead of "
                    f"creating a duplicate."
                )
            raise serializers.ValidationError(
                f"A client named '{trung.client_name}' already exists "
                f"(tax code {trung.tax_code}). Client names must be unique."
            )
        return ten

    def validate_tax_code(self, value):
        """
        Ma so thue la dinh danh phap ly cua doanh nghiep — moi ma chi thuoc ve
        dung mot cong ty. Trung ma so thue nhung khac ten nghia la mot trong
        hai ban ghi nhap sai, phai chi ro ben kia la ai de Admin doi chieu.
        """
        ma = (value or "").strip()
        if not ma:
            raise serializers.ValidationError("Tax code is required.")

        trung = (
            self._khac_chinh_no(Client.objects.filter(tax_code__iexact=ma))
            .order_by("-is_active", "id")
            .first()
        )
        if trung is not None:
            trang_thai = "" if trung.is_active else " (deactivated)"
            raise serializers.ValidationError(
                f"Tax code '{ma}' is already used by '{trung.client_name}'{trang_thai}. "
                f"A tax code identifies one single company - check the code again, or "
                f"update the existing client instead."
            )
        return ma


class JobSerializer(serializers.ModelSerializer):
    # Admin KHONG gan nhan vien vao Job. Quy trinh: Admin tao Job rong roi
    # giao cho mot Manager phu trach; Manager moi la nguoi chon nhan vien
    # trong tuyen bao cao cua minh vao du an (xem
    # projects/manager/serializers_manager.py).
    #
    # `project_team` van tra ve de Admin XEM duoc thanh vien, nhung chi doc.
    project_team = serializers.SerializerMethodField(read_only=True)
    team_size = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Job
        fields = '__all__'

    def get_team_size(self, obj):
        from chat.models import ChatParticipant
        task_assignee_ids = set(obj.tasks.values_list('assignee_id', flat=True).distinct())
        team_participant_ids = set(
            ChatParticipant.objects.filter(room__job=obj, room__room_type='JOB')
            .exclude(user=obj.manager)
            .values_list('user_id', flat=True)
            .distinct()
        )
        return len(task_assignee_ids | team_participant_ids)

    def get_project_team(self, obj):
        from chat.models import ChatParticipant
        User = get_user_model()
        task_assignee_ids = set(obj.tasks.values_list('assignee_id', flat=True).distinct())
        team_participant_ids = set(
            ChatParticipant.objects.filter(room__job=obj, room__room_type='JOB')
            .exclude(user=obj.manager)
            .values_list('user_id', flat=True)
            .distinct()
        )
        all_member_ids = task_assignee_ids | team_participant_ids
        users = User.objects.filter(id__in=all_member_ids, is_active=True).select_related('profile', 'profile__department')
        return [
            {
                'id': u.id,
                'email': u.email,
                'full_name': getattr(getattr(u, 'profile', None), 'full_name', '') or u.email,
                'department_name': getattr(getattr(getattr(u, 'profile', None), 'department', None), 'name', 'General'),
            }
            for u in users
        ]

    def validate_client(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Cannot assign job to an inactive client.")
        return value

    def validate_manager(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Cannot assign an inactive user as project manager.")
        role_code = getattr(getattr(value, 'role', None), 'code', None)
        if role_code not in ['MANAGER', 'ADMIN']:
            raise serializers.ValidationError("Project manager must have an active MANAGER or ADMIN role.")
        return value
    
    ALLOWED_TRANSITIONS = {
        'PLANNING': ['ACTIVE', 'CANCELLED'],
        'ACTIVE': ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
        'ON_HOLD': ['ACTIVE', 'CANCELLED'],
        'COMPLETED': ['ACTIVE'],
        'CANCELLED': ['ACTIVE']
    }      
    
    def validate_status(self, value):
        if self.instance:
            current = self.instance.status
            allowed = self.ALLOWED_TRANSITIONS.get(current, [])
            if value != current and value not in allowed:
                raise serializers.ValidationError(
                f"Cannot transition from '{current}' to '{value}'."
            )
        return value
        
    def validate(self, data):
        start_date = data.get('start_date', self.instance.start_date if self.instance else None)
        deadline = data.get('deadline', self.instance.deadline if self.instance else None)
        today = timezone.localdate()

        # When creating a new job, deadline cannot be in the past
        if not self.instance and deadline and deadline < today:
            raise serializers.ValidationError({'deadline': f'Deadline cannot be in the past (must be on or after {today}).'})

        if start_date and deadline and deadline < start_date:
            raise serializers.ValidationError({'deadline': 'Deadline must be on or after start date.'})
        return data

    def create(self, validated_data):
        job = super().create(validated_data)

        # Khởi tạo Kênh Chat Dự án và gán Project Team (KHÔNG tạo task rác)
        from chat.models import ChatRoom, ChatParticipant
        room_name = f"#{job.job_code or f'JOB-{job.id}'}: {job.job_name}"
        room, _ = ChatRoom.objects.get_or_create(
            room_type=ChatRoom.RoomType.JOB,
            job=job,
            defaults={"name": room_name},
        )
        if job.manager:
            ChatParticipant.objects.get_or_create(room=room, user=job.manager)

        return job

    def update(self, instance, validated_data):
        job = super().update(instance, validated_data)

        # Cập nhật Project Team qua ChatParticipant của Job (KHÔNG tạo task rác)
        from chat.models import ChatRoom, ChatParticipant
        room_name = f"#{job.job_code or f'JOB-{job.id}'}: {job.job_name}"
        room, _ = ChatRoom.objects.get_or_create(
            room_type=ChatRoom.RoomType.JOB,
            job=job,
            defaults={"name": room_name},
        )
        if job.manager:
            ChatParticipant.objects.get_or_create(room=room, user=job.manager)

        return job

