"""
Module: system.pagination
Description: Pagination classes enforcing consistent page limits across administration data tables.
"""

from rest_framework.pagination import PageNumberPagination


class AdminPageNumberPagination(PageNumberPagination):
    """Provides standard 10-row page pagination with configurable page size parameter for admin interfaces."""
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 500
