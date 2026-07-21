from django.urls import include, path

urlpatterns = [
    path('', include('accounts.admin.urls')),
]
