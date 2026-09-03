"""
Module: system.utils
Description: Utility helpers for recording audit log events across system modules.
"""

from system.models import AuditLog


def log_audit_event(actor, action, table_name, record_id, old_values=None, new_values=None, request=None, severity=None):
    """Create an immutable audit log entry recording database mutations and request metadata."""
    ip_address = None
    if request is not None:
        ip_address = request.META.get('REMOTE_ADDR')

    AuditLog.objects.create(
        user=actor,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        severity=severity or AuditLog.Severity.NORMAL,
    )