from django.urls import include, path

urlpatterns = [
    path('', include('projects.admin.urls')),
]
