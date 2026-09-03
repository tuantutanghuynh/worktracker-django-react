"""
Module: projects.urls
Description: Root URL router including administrative project endpoints.
"""

from django.urls import include, path

urlpatterns = [
    path('', include('projects.admin.urls')),
]
