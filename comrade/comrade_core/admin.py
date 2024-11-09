from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Task, Skill

class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'owner', 'state', 'lat', 'lon', 'respawn', 'respawn_time', 'base_value', 'criticality', 'contribution']
    list_filter = ['state', 'respawn', 'criticality']
    search_fields = ['title', 'description']


admin.site.register(User, UserAdmin)
admin.site.register(Task, TaskAdmin)
admin.site.register(Skill)