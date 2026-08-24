from rest_framework.pagination import PageNumberPagination


# Shared by every Admin ViewSet (accounts/admin, projects/admin, system/admin)
# so list endpoints stop returning the entire table in one response as the
# data grows — 15 rows/page to match the frontend's PaginationBar default.
class AdminPageNumberPagination(PageNumberPagination):
    page_size = 15
    # Lets dropdown/lookup queries (e.g. "all managers for this select box")
    # opt out of the default 15/page via ?page_size=, capped so it can't be
    # abused to pull the whole table in one request.
    page_size_query_param = 'page_size'
    max_page_size = 500
