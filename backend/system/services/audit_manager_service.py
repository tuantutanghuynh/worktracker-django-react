import json

from django.core.serializers.json import DjangoJSONEncoder

from system.models import AuditLog


def json_safe(value):
    """
    Chuyển dữ liệu Python/Django sang dạng JSON-safe.

    Xử lý được:
    - date/datetime
    - Decimal
    - UUID
    - các kiểu DjangoJSONEncoder hỗ trợ
    """
    return json.loads(
        json.dumps(value, cls=DjangoJSONEncoder)
    )


def snapshot(instance, fields=None):
    """
    Chụp trạng thái hiện tại của model instance.

    Nếu fields=None:
        chụp toàn bộ concrete fields.

    Nếu field là ForeignKey:
        lưu dạng <field>_id thay vì serialize object.
    """
    if instance is None:
        return None

    model_fields = {
        field.name: field
        for field in instance._meta.fields
    }

    if fields is None:
        fields = list(model_fields.keys())

    data = {}

    for field_name in fields:
        field = model_fields.get(field_name)

        if field is not None and field.is_relation:
            data[f"{field_name}_id"] = getattr(
                instance,
                f"{field_name}_id",
                None,
            )
        else:
            data[field_name] = getattr(instance, field_name, None)

    return json_safe(data)


def extract_ip_address(request):
    """
    Lấy IP từ request.

    ip_address trong AuditLog cho phép null,
    nên nếu không có request thì trả None.
    """
    if request is None:
        return None

    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    return request.META.get("REMOTE_ADDR")


def log_action(
    *,
    user,
    action,
    table_name,
    record_id,
    old_values=None,
    new_values=None,
    request=None,
):
    """
    Ghi audit log.

    Lưu ý:
    - Hàm này KHÔNG tự mở transaction.atomic().
    - View/service gọi hàm này phải đặt bên trong cùng transaction
      với thao tác chính.
    """
    if not action:
        raise ValueError("action is required.")

    if not table_name:
        raise ValueError("table_name is required.")

    if record_id is None:
        raise ValueError("record_id is required.")

    return AuditLog.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=json_safe(old_values) if old_values is not None else None,
        new_values=json_safe(new_values) if new_values is not None else None,
        ip_address=extract_ip_address(request),
    )