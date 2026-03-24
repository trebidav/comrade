from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserChangeForm

from .models import Skill, Task, User, LocationConfig, Rating, Review, TutorialTask, TutorialPart, TutorialQuestion, TutorialAnswer, TutorialProgress, Achievement, UserAchievement, ChatMessage


class UserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User


class UserAchievementInline(admin.TabularInline):
    model = UserAchievement
    extra = 0
    readonly_fields = ['achievement', 'datetime_earned', 'progress']
    can_delete = True


class ComradeUserAdmin(UserAdmin):
    form = UserChangeForm
    list_display = ['username', 'email', 'location_sharing_level', 'coins', 'xp', 'task_streak']
    inlines = [UserAchievementInline]
    list_filter = ['location_sharing_level', 'is_staff', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    
    # Define fieldsets explicitly, extending the default UserAdmin fieldsets
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'email', 'profile_picture')}),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
        ('Location', {
            'fields': (
                'latitude', 'longitude', 'location_sharing_level',
                'location_share_with'
            )
        }),
        ('Stats', {
            'fields': ('coins', 'xp', 'total_coins_earned', 'total_xp_earned', 'task_streak')
        }),
        ('Welcome', {
            'fields': ('welcome_accepted',)
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
        'respawn', 'respawn_time', 'respawn_offset', 'datetime_respawn', 'coins', 'criticality',
        'xp', 'minutes', 'require_photo', 'require_comment'
    ]
    list_filter = ['state', 'respawn', 'criticality', 'owner', 'assignee', 'require_photo', 'require_comment']
    search_fields = ['name', 'description']
    filter_horizontal = ('skill_read', 'skill_write', 'skill_execute')
    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'description', 'photo')
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
            'fields': ('respawn', 'respawn_time', 'respawn_offset', 'datetime_respawn')
        }),
        ('Values', {
            'fields': ('coins', 'criticality', 'xp', 'minutes')
        }),
        ('Completion Requirements', {
            'fields': ('require_photo', 'require_comment')
        }),
        ('Completion', {
            'fields': ('time_spent_minutes',)
        }),
        ('Time Tracking', {
            'fields': ('datetime_start', 'datetime_finish', 'datetime_paused')
        })
    )


class SkillAdmin(admin.ModelAdmin):
    list_display = ['name']
    search_fields = ['name']


class LocationConfigAdmin(admin.ModelAdmin):
    list_display = ['max_distance_km', 'task_proximity_km', 'coins_modifier', 'xp_modifier', 'time_modifier_minutes', 'criticality_percentage', 'pause_multiplier', 'level_modifier', 'last_updated']
    readonly_fields = ['last_updated']
    fieldsets = (
        ('Distance & Proximity', {'fields': ('max_distance_km', 'task_proximity_km')}),
        ('Reward Modifiers', {'fields': ('coins_modifier', 'xp_modifier', 'time_modifier_minutes', 'criticality_percentage', 'pause_multiplier', 'level_modifier')}),
        ('Welcome Message', {'fields': ('welcome_message',)}),
        ('Meta', {'fields': ('last_updated',)}),
    )


class RatingAdmin(admin.ModelAdmin):
    list_display = ['task', 'happiness', 'time']
    list_filter = ['task']
    search_fields = ['task__name']
    fields = ['task', 'happiness', 'time']


class ReviewAdmin(admin.ModelAdmin):
    list_display = ['task', 'status', 'comment', 'photo', 'created_at']
    list_filter = ['status']
    search_fields = ['task__name', 'comment']
    readonly_fields = ['created_at']
    fields = ['task', 'status', 'comment', 'photo', 'created_at']
    actions = ['accept_reviews', 'decline_reviews']

    @admin.action(description='Accept selected reviews')
    def accept_reviews(self, request, queryset):
        for review in queryset.filter(status='pending'):
            try:
                review.task.accept_review(request.user)
            except Exception:
                pass

    @admin.action(description='Decline selected reviews')
    def decline_reviews(self, request, queryset):
        for review in queryset.filter(status='pending'):
            try:
                review.task.decline_review(request.user)
            except Exception:
                pass


class TutorialAnswerInline(admin.TabularInline):
    model = TutorialAnswer
    extra = 2
    fields = ['order', 'text', 'is_correct']


class TutorialQuestionInline(admin.TabularInline):
    model = TutorialQuestion
    extra = 1
    fields = ['order', 'text']
    show_change_link = True


class TutorialPartInline(admin.TabularInline):
    model = TutorialPart
    extra = 1
    fields = ['order', 'type', 'title']
    show_change_link = True


class TutorialTaskAdmin(admin.ModelAdmin):
    list_display = ['name', 'reward_skill', 'lat', 'lon']
    search_fields = ['name']
    filter_horizontal = ['skill_execute']
    fields = ['name', 'description', 'lat', 'lon', 'reward_skill', 'skill_execute']
    inlines = [TutorialPartInline]


class TutorialPartAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'type', 'tutorial', 'order']
    list_filter = ['type', 'tutorial']
    fields = ['tutorial', 'order', 'type', 'title', 'text_content', 'video_url', 'password']
    inlines = [TutorialQuestionInline]


class TutorialQuestionAdmin(admin.ModelAdmin):
    list_display = ['text', 'part', 'order']
    fields = ['part', 'order', 'text']
    inlines = [TutorialAnswerInline]


class TutorialProgressAdmin(admin.ModelAdmin):
    list_display = ['user', 'tutorial', 'completed_count']
    filter_horizontal = ['completed_parts']

    def completed_count(self, obj):
        return f"{obj.completed_parts.count()} / {obj.tutorial.parts.count()}"
    completed_count.short_description = 'Progress'


class AchievementAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'condition_type', 'condition_value', 'reward_coins', 'reward_xp', 'reward_skill', 'is_secret', 'is_active', 'order']
    list_filter = ['condition_type', 'is_secret', 'is_active', 'reward_skill']
    list_editable = ['is_active', 'order']
    search_fields = ['name', 'description']
    fieldsets = (
        ('Identity', {'fields': ('name', 'description', 'icon', 'order', 'is_active', 'is_secret')}),
        ('Condition', {'fields': ('condition_type', 'condition_value', 'condition_filter')}),
        ('Rewards', {'fields': ('reward_coins', 'reward_xp', 'reward_skill')}),
    )


class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ['user', 'achievement', 'datetime_earned', 'progress']
    list_filter = ['achievement']
    search_fields = ['user__username', 'achievement__name']
    readonly_fields = ['datetime_earned']


class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['sender', 'text', 'created_at']
    list_filter = ['sender']
    search_fields = ['text', 'sender__username']
    readonly_fields = ['created_at']


admin.site.register(User, ComradeUserAdmin)
admin.site.register(Task, TaskAdmin)
admin.site.register(Skill, SkillAdmin)
admin.site.register(LocationConfig, LocationConfigAdmin)
admin.site.register(Rating, RatingAdmin)
admin.site.register(Review, ReviewAdmin)
admin.site.register(TutorialTask, TutorialTaskAdmin)
admin.site.register(TutorialPart, TutorialPartAdmin)
admin.site.register(TutorialQuestion, TutorialQuestionAdmin)
admin.site.register(TutorialProgress, TutorialProgressAdmin)
admin.site.register(Achievement, AchievementAdmin)
admin.site.register(UserAchievement, UserAchievementAdmin)
admin.site.register(ChatMessage, ChatMessageAdmin)
