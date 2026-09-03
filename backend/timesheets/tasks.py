"""
Module: timesheets.tasks
Description: Asynchronous Celery background tasks for scheduled monthly timesheet period locking.
"""

import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="timesheets.auto_lock_previous_period")
def auto_lock_previous_period_task():
    """Execute scheduled daily auto-locking for elapsed monthly timesheet periods."""
    from timesheets.services.auto_lock_service import auto_lock_previous_period

    result = auto_lock_previous_period()
    logger.info("[Celery] auto_lock_previous_period -> %s", result)
    return result
