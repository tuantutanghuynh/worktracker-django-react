from django.contrib import admin
from .models import Client, Job
# Register your models here.

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('id','client_name', 'tax_code','contact_person','is_active')
    list_filter = ('is_active',)
    search_fields = ('client_name', 'tax_code')

@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ('id','job_name', 'client','manager','status', 'deadline')
    list_filter = ('status', 'client')
    search_fields = ('job_name',)