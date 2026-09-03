"""
Module: worktracker_core.celery
Description: Celery distributed task queue configuration and task autodiscovery setup.
"""

import os
import redis
from celery import Celery

_orig_redis_conn_init = redis.Connection.__init__


def _patched_redis_conn_init(self, *args, **kwargs):
    """Enforce RESP2 protocol on Redis connection for Windows server compatibility."""
    kwargs.setdefault("protocol", 2)
    kwargs["maint_notifications_config"] = None
    _orig_redis_conn_init(self, *args, **kwargs)


redis.Connection.__init__ = _patched_redis_conn_init

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "worktracker_core.settings")

app = Celery("worktracker_core")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
