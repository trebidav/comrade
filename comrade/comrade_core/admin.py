from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserChangeForm

from .models import Skill, Task, User


class UserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User


class ComradeUserAdmin(UserAdmin):
    form = UserChangeForm
    fieldsets = UserAdmin.fieldsets + ((None, {"fields": ("skills",)}),)


class TaskAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "owner",
        "state",
        "lat",
        "lon",
        "respawn",
        "respawn_time",
        "base_value",
        "criticality",
        "contribution",
    ]
    list_filter = ["state", "respawn", "criticality"]
    search_fields = ["name", "description"]


class SkillInline(admin.StackedInline):
    model = Skill


admin.site.register(User, ComradeUserAdmin)
admin.site.register(Task, TaskAdmin)
admin.site.register(Skill)
