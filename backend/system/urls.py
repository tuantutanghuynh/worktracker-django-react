"""
Module: system.urls
Description: Root URL patterns routing requests to system administration sub-endpoints.
"""

from django.urls import include, path

urlpatterns = [
    path('', include('system.admin.urls')),
]
