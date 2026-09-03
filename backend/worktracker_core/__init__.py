"""
Module: worktracker_core.__init__
Description: Package initialization module exposing Celery application instance for shared task execution.
"""

from .celery import app as celery_app

__all__ = ("celery_app",)
