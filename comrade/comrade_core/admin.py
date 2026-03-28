from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserChangeForm

from .models import Skill, Task, User, GlobalConfig, Rating, Review, TutorialTask, TutorialPart, TutorialQuestion, TutorialAnswer, TutorialProgress, Achievement, UserAchievement, ChatMessage, BugReport, BugReportScreenshot, OnboardingTemplate, UserOnboardingTutorial, UserOnboardingTask


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

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return False


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

    def has_module_permission(self, request):
        return request.user.is_staff or request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_staff or request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_staff or request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj and obj.owner != request.user:
            return False
        return request.user.is_staff

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj and obj.owner != request.user:
            return False
        return request.user.is_staff

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(owner=request.user)

    def save_model(self, request, obj, form, change):
        if not change and not obj.owner:
            obj.owner = request.user
        super().save_model(request, obj, form, change)


class SkillAdmin(admin.ModelAdmin):
    list_display = ['name']
    search_fields = ['name']

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return False


class GlobalConfigAdmin(admin.ModelAdmin):
    list_display = ['max_distance_km', 'task_proximity_km', 'coins_modifier', 'xp_modifier', 'time_modifier_minutes', 'criticality_percentage', 'pause_multiplier', 'level_modifier', 'last_updated']
    readonly_fields = ['last_updated']
    fieldsets = (
        ('Distance & Proximity', {'fields': ('max_distance_km', 'task_proximity_km')}),
        ('Reward Modifiers', {'fields': ('coins_modifier', 'xp_modifier', 'time_modifier_minutes', 'criticality_percentage', 'pause_multiplier', 'level_modifier')}),
        ('Welcome Message', {'fields': ('welcome_message',)}),
        ('Meta', {'fields': ('last_updated',)}),
    )

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return False


class RatingAdmin(admin.ModelAdmin):
    list_display = ['task', 'happiness', 'time']
    list_filter = ['task']
    search_fields = ['task__name']
    fields = ['task', 'happiness', 'time']

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return False


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

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return False


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
    list_display = ['name', 'reward_skill', 'owner', 'lat', 'lon']
    search_fields = ['name']
    filter_horizontal = ['skill_execute']
    fields = ['name', 'description', 'lat', 'lon', 'reward_skill', 'skill_execute', 'owner']
    inlines = [TutorialPartInline]

    def has_module_permission(self, request):
        return request.user.is_staff or request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_staff or request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_staff or request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj and obj.owner != request.user:
            return False
        return request.user.is_staff

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj and obj.owner != request.user:
            return False
        return request.user.is_staff

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(owner=request.user)

    def save_model(self, request, obj, form, change):
        if not change and not obj.owner:
            obj.owner = request.user
        super().save_model(request, obj, form, change)


class TutorialPartAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'type', 'tutorial', 'order']
    list_filter = ['type', 'tutorial']
    fields = ['tutorial', 'order', 'type', 'title', 'text_content', 'video_url', 'password', 'freetext_min_length', 'freetext_max_length']
    inlines = [TutorialQuestionInline]

    def has_module_permission(self, request):
        return request.user.is_staff or request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_staff or request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_staff or request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_staff or request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_staff or request.user.is_superuser

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(tutorial__owner=request.user)


class TutorialQuestionAdmin(admin.ModelAdmin):
    list_display = ['text', 'part', 'order']
    fields = ['part', 'order', 'text']
    inlines = [TutorialAnswerInline]

    def has_module_permission(self, request):
        return request.user.is_staff or request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_staff or request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_staff or request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_staff or request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_staff or request.user.is_superuser

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(part__tutorial__owner=request.user)


class TutorialProgressAdmin(admin.ModelAdmin):
    list_display = ['user', 'tutorial', 'completed_count', 'review_status']
    list_filter = ['review_status']
    filter_horizontal = ['completed_parts']

    def completed_count(self, obj):
        return f"{obj.completed_parts.count()} / {obj.tutorial.parts.count()}"
    completed_count.short_description = 'Progress'

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return False


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

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return False


class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ['user', 'achievement', 'datetime_earned', 'progress']
    list_filter = ['achievement']
    search_fields = ['user__username', 'achievement__name']
    readonly_fields = ['datetime_earned']

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return False


class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['sender', 'text', 'created_at']
    list_filter = ['sender']
    search_fields = ['text', 'sender__username']
    readonly_fields = ['created_at']

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return False


admin.site.register(User, ComradeUserAdmin)
admin.site.register(Task, TaskAdmin)
admin.site.register(Skill, SkillAdmin)
admin.site.register(GlobalConfig, GlobalConfigAdmin)
admin.site.register(Rating, RatingAdmin)
admin.site.register(Review, ReviewAdmin)
admin.site.register(TutorialTask, TutorialTaskAdmin)
admin.site.register(TutorialPart, TutorialPartAdmin)
admin.site.register(TutorialQuestion, TutorialQuestionAdmin)
admin.site.register(TutorialProgress, TutorialProgressAdmin)
admin.site.register(Achievement, AchievementAdmin)
admin.site.register(UserAchievement, UserAchievementAdmin)
admin.site.register(ChatMessage, ChatMessageAdmin)


class BugReportScreenshotInline(admin.TabularInline):
    model = BugReportScreenshot
    extra = 0
    readonly_fields = ['image', 'order']


class BugReportAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'description_short', 'screen_size', 'created_at']
    list_filter = ['created_at']
    search_fields = ['description', 'user__username']
    readonly_fields = ['user', 'description', 'user_agent', 'url', 'screen_size', 'location', 'created_at']
    inlines = [BugReportScreenshotInline]

    def description_short(self, obj):
        return obj.description[:80] + ('...' if len(obj.description) > 80 else '')
    description_short.short_description = 'Description'

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return False


admin.site.register(BugReport, BugReportAdmin)


class OnboardingTemplateAdmin(admin.ModelAdmin):
    list_display = ['order', 'tutorial', 'task', 'spawn_radius_meters', 'is_active']
    list_display_links = ['tutorial', 'task']
    list_editable = ['is_active', 'order']
    list_filter = ['is_active']

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return False


class UserOnboardingTutorialAdmin(admin.ModelAdmin):
    list_display = ['user', 'tutorial', 'lat', 'lon', 'created_at']
    list_filter = ['tutorial']
    search_fields = ['user__username']
    readonly_fields = ['user', 'tutorial', 'lat', 'lon', 'created_at']

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return False


class UserOnboardingTaskAdmin(admin.ModelAdmin):
    list_display = ['user', 'task', 'lat', 'lon', 'created_at']
    list_filter = ['task']
    search_fields = ['user__username']
    readonly_fields = ['user', 'task', 'lat', 'lon', 'created_at']

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return False


admin.site.register(OnboardingTemplate, OnboardingTemplateAdmin)
admin.site.register(UserOnboardingTutorial, UserOnboardingTutorialAdmin)
admin.site.register(UserOnboardingTask, UserOnboardingTaskAdmin)
