from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserChangeForm

from .models import Skill, Task, User, LocationConfig, Rating, Review


class UserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User


class ComradeUserAdmin(UserAdmin):
    form = UserChangeForm
    list_display = ['username', 'email', 'location_sharing_level']
    list_filter = ['location_sharing_level', 'is_staff', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    
    # Add custom fields to the default UserAdmin fieldsets
    fieldsets = UserAdmin.fieldsets + (
        ('Location', {
            'fields': (
                'latitude', 'longitude', 'location_sharing_level',
                'location_share_with'
            )
        }),
        ('Skills & Friends', {
            'fields': (
                'skills', 'friends', 'friend_requests_sent'
            )
        }),
    )
    filter_horizontal = ('skills', 'friends', 'friend_requests_sent', 'location_share_with')


class TaskAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'state', 'owner', 'assignee', 'lat', 'lon',
        'respawn', 'respawn_time', 'base_value', 'criticality',
        'contribution', 'minutes'
    ]
    list_filter = ['state', 'respawn', 'criticality', 'owner', 'assignee']
    search_fields = ['name', 'description']
    filter_horizontal = ('skill_read', 'skill_write', 'skill_execute')
    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'description')
        }),
        ('Permissions', {
            'fields': ('skill_read', 'skill_write', 'skill_execute')
        }),
        ('Task State', {
            'fields': ('state', 'owner', 'assignee')
        }),
        ('Location', {
            'fields': ('lat', 'lon')
        }),
        ('Respawn Settings', {
            'fields': ('respawn', 'respawn_time')
        }),
        ('Values', {
            'fields': ('base_value', 'criticality', 'contribution', 'minutes')
        }),
        ('Time Tracking', {
            'fields': ('datetime_start', 'datetime_finish')
        })
    )


class SkillAdmin(admin.ModelAdmin):
    list_display = ['name']
    search_fields = ['name']


class LocationConfigAdmin(admin.ModelAdmin):
    list_display = ['max_distance_km', 'last_updated']
    readonly_fields = ['last_updated']


class RatingAdmin(admin.ModelAdmin):
    list_display = ['task', 'happiness', 'time']
    list_filter = ['task']
    search_fields = ['task__name']
    fields = ['task', 'happiness', 'time']


class ReviewAdmin(admin.ModelAdmin):
    list_display = ['task', 'done']
    list_filter = ['task']
    search_fields = ['task__name']
    fields = ['task', 'done']


admin.site.register(User, ComradeUserAdmin)
admin.site.register(Task, TaskAdmin)
admin.site.register(Skill, SkillAdmin)
admin.site.register(LocationConfig, LocationConfigAdmin)
admin.site.register(Rating, RatingAdmin)
admin.site.register(Review, ReviewAdmin)
