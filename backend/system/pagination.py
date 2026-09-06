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


class SelfServicePageNumberPagination(PageNumberPagination):
    """Bound the size of self-service history endpoints (notifications, own audit trail, own work logs)."""
    # Ba endpoint nay truoc day tra ve NGUYEN bang cua nguoi dung, khong gioi
    # han. Mot nhan vien lam mot nam co hang nghin dong log cong va thong bao —
    # moi lan mo trang la keo het chung ve, cham dan theo thoi gian su dung va
    # khong co diem dung.
    #
    # 50 chu khong phai 10 nhu ben Admin: cac trang nay tu loc va tu phan trang
    # o phia trinh duyet tren mang nhan duoc, nen trang dau phai du day de van
    # dung duoc ngay. Muon xem xa hon thi truyen ?page=.
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200
