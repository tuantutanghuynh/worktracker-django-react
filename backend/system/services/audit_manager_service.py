"""
Module: system.services.audit_manager_service
Description: Service functions for capturing object state snapshots and writing immutable audit logs.
"""

import json
from django.core.serializers.json import DjangoJSONEncoder
from system.models import AuditLog


def json_safe(value):
    """Serialize Python and Django values into JSON-compatible primitives."""
    return json.loads(
        json.dumps(value, cls=DjangoJSONEncoder)
    )


def snapshot(instance, fields=None):
    """Capture a serializable dictionary snapshot of model instance field values."""
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
    """Extract client IP address from request headers or remote address."""
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
    severity=AuditLog.Severity.NORMAL,
    summary=None,
):
    """Persist an audit log entry recording database mutations and change diffs."""
    if not action:
        raise ValueError("action is required.")

    if not table_name:
        raise ValueError("table_name is required.")

    if record_id is None:
        raise ValueError("record_id is required.")

    return AuditLog.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
        action=action,
        severity=severity,
        summary=summary,
        table_name=table_name,
        record_id=record_id,
        old_values=json_safe(old_values) if old_values is not None else None,
        new_values=json_safe(new_values) if new_values is not None else None,
        ip_address=extract_ip_address(request),
    )