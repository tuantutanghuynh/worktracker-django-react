from django.urls import include, path

urlpatterns = [
    path('', include('system.admin.urls')),
]
