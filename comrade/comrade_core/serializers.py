import datetime

from comrade_core.models import Task, User, Review, Skill, TutorialTask, TutorialPart, TutorialQuestion, TutorialAnswer, TutorialProgress, TutorialPartSubmission, OnboardingTemplate
from rest_framework import serializers


class UserDetailSerializer(serializers.ModelSerializer):
    skills = serializers.SerializerMethodField()
    level = serializers.IntegerField(read_only=True)
    level_progress = serializers.DictField(read_only=True)

    def get_skills(self, obj):
        """Return skill names, hiding onboarding reward skills only after all onboarding tutorials are complete.

        Only tutorials gate onboarding completion — tasks may respawn and shouldn't
        re-trigger onboarding mode.
        """
        from comrade_core.models import UserOnboardingTutorial, UserOnboardingTask

        onboarding_tutorial_ids = set(
            UserOnboardingTutorial.objects.filter(user=obj).values_list('tutorial_id', flat=True)
        )
        onboarding_task_ids = set(
            UserOnboardingTask.objects.filter(user=obj).values_list('task_id', flat=True)
        )

        if not onboarding_tutorial_ids and not onboarding_task_ids:
            return [s.name for s in obj.skills.all()]

        completed_tutorial_ids = set(
            TutorialProgress.objects.filter(
                user=obj, state=TutorialProgress.State.DONE,
                tutorial_id__in=onboarding_tutorial_ids,
            ).values_list('tutorial_id', flat=True)
        ) if onboarding_tutorial_ids else set()
        completed_task_ids = set(
            UserOnboardingTask.objects.filter(
                user=obj, completed=True,
                task_id__in=onboarding_task_ids,
            ).values_list('task_id', flat=True)
        ) if onboarding_task_ids else set()

        all_done = (
            onboarding_tutorial_ids == completed_tutorial_ids
            and onboarding_task_ids == completed_task_ids
        )

        if not all_done:
            # Still in onboarding — show all skills (needed for gating)
            return [s.name for s in obj.skills.all()]

        # All onboarding tutorials complete — hide onboarding reward skills
        hide_skill_ids = set(
            OnboardingTemplate.objects.filter(
                is_active=True, tutorial__isnull=False,
            ).values_list('tutorial__reward_skill_id', flat=True)
        )
        return [s.name for s in obj.skills.all() if s.id not in hide_skill_ids]

    class Meta:
        model = User
        fields = ["id", "username", "email", "latitude", "longitude", "skills", "is_superuser", "is_staff", "coins", "xp", "total_coins_earned", "total_xp_earned", "task_streak", "level", "level_progress", "profile_picture"]


class PendingReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ['id', 'comment', 'photo', 'status', 'created_at']


class TaskSerializer(serializers.ModelSerializer):
    skill_execute_names = serializers.SerializerMethodField()
    skill_read_names = serializers.SerializerMethodField()
    skill_write_names = serializers.SerializerMethodField()
    assignee_name = serializers.SerializerMethodField()
    pending_review = serializers.SerializerMethodField()
    is_tutorial = serializers.SerializerMethodField()
    lat = serializers.SerializerMethodField()
    lon = serializers.SerializerMethodField()

    def get_skill_execute_names(self, obj):
        return [skill.name for skill in obj.skill_execute.all()]

    def get_skill_read_names(self, obj):
        return [skill.name for skill in obj.skill_read.all()]

    def get_skill_write_names(self, obj):
        return [skill.name for skill in obj.skill_write.all()]

    def get_assignee_name(self, obj):
        if obj.assignee:
            return f"{obj.assignee.first_name} {obj.assignee.last_name}".strip() or obj.assignee.username
        return None

    def get_lat(self, obj):
        return getattr(obj, '_user_lat', obj.lat)

    def get_lon(self, obj):
        return getattr(obj, '_user_lon', obj.lon)

    def get_is_tutorial(self, obj):
        return False

    def get_pending_review(self, obj):
        # Filter in Python over prefetched reviews to avoid extra queries
        pending = [r for r in obj.reviews.all() if r.status == 'pending']
        if pending:
            pending.sort(key=lambda r: r.created_at, reverse=True)
            return PendingReviewSerializer(pending[0], context=self.context).data
        return None

    class Meta:
        model = Task
        fields = [
            'id', 'name', 'description', 'lat', 'lon',
            'state', 'criticality', 'minutes', 'coins', 'xp',
            'owner', 'assignee', 'photo',
            'require_photo', 'require_comment',
            'datetime_start', 'datetime_finish', 'datetime_paused',
            'respawn', 'respawn_time', 'respawn_offset', 'datetime_respawn',
            'time_spent_minutes',
            # SerializerMethodFields
            'skill_execute_names', 'skill_read_names', 'skill_write_names',
            'assignee_name', 'pending_review', 'is_tutorial',
        ]
        # NOTE: New Task model fields must be added here to appear in API responses.


class TaskCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=True)
    description = serializers.CharField(max_length=200, required=False, default='', allow_blank=True)
    lat = serializers.FloatField(required=False, allow_null=True, default=None)
    lon = serializers.FloatField(required=False, allow_null=True, default=None)
    criticality = serializers.IntegerField(required=False, default=1, min_value=1, max_value=3)
    minutes = serializers.IntegerField(required=False, default=10, min_value=1, max_value=480)
    coins = serializers.FloatField(required=False, allow_null=True, default=None, min_value=0, max_value=1)
    xp = serializers.FloatField(required=False, allow_null=True, default=None, min_value=0, max_value=1)
    respawn = serializers.BooleanField(required=False, default=False)
    respawn_time = serializers.CharField(required=False, default='10:00', allow_blank=True)
    respawn_offset = serializers.IntegerField(required=False, allow_null=True, default=None, min_value=1)
    require_photo = serializers.BooleanField(required=False, default=False)
    require_comment = serializers.BooleanField(required=False, default=False)
    photo = serializers.FileField(required=False, allow_null=True, default=None)
    skill_read = serializers.PrimaryKeyRelatedField(many=True, queryset=Skill.objects.all(), required=False, default=[])
    skill_write = serializers.PrimaryKeyRelatedField(many=True, queryset=Skill.objects.all(), required=False, default=[])
    skill_execute = serializers.PrimaryKeyRelatedField(many=True, queryset=Skill.objects.all(), required=False, default=[])

    def validate_lat(self, value):
        if value is not None and not (-90 <= value <= 90):
            raise serializers.ValidationError("Must be between -90 and 90.")
        return value

    def validate_lon(self, value):
        if value is not None and not (-180 <= value <= 180):
            raise serializers.ValidationError("Must be between -180 and 180.")
        return value

    def validate_respawn_time(self, value):
        if not value:
            return datetime.time(10, 0)
        try:
            h, m = value.split(':')
            return datetime.time(int(h), int(m))
        except (ValueError, AttributeError):
            raise serializers.ValidationError("Must be in HH:MM format.")

    def validate_coins(self, value):
        """Handle empty string from FormData."""
        if value == '' or value is None:
            return None
        return value

    def validate_xp(self, value):
        """Handle empty string from FormData."""
        if value == '' or value is None:
            return None
        return value


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ['id', 'name']


class TutorialAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = TutorialAnswer
        fields = ['id', 'text', 'order']  # never expose is_correct


class TutorialQuestionSerializer(serializers.ModelSerializer):
    answers = TutorialAnswerSerializer(many=True, read_only=True)

    class Meta:
        model = TutorialQuestion
        fields = ['id', 'text', 'order', 'answers']


class TutorialPartSerializer(serializers.ModelSerializer):
    questions = TutorialQuestionSerializer(many=True, read_only=True)
    completed = serializers.SerializerMethodField()

    def get_completed(self, obj):
        progress = self.context.get('progress')
        if not progress:
            return False
        return progress.completed_parts.filter(pk=obj.pk).exists()

    class Meta:
        model = TutorialPart
        fields = ['id', 'type', 'title', 'order', 'text_content', 'video_url', 'questions', 'completed', 'freetext_min_length', 'freetext_max_length']
        # password intentionally excluded


class TutorialTaskDetailSerializer(serializers.ModelSerializer):
    """Used for the tutorial detail endpoint (step-through UI)."""
    parts = serializers.SerializerMethodField()
    reward_skill_name = serializers.CharField(source='reward_skill.name', read_only=True)

    def get_parts(self, obj):
        request = self.context.get('request')
        try:
            progress = TutorialProgress.objects.get(user=request.user, tutorial=obj)
        except TutorialProgress.DoesNotExist:
            progress = None
        return TutorialPartSerializer(
            obj.parts.all(), many=True, context={**self.context, 'progress': progress}
        ).data

    class Meta:
        model = TutorialTask
        fields = ['id', 'reward_skill_name', 'parts']


TUTORIAL_ID_OFFSET = 100000


class TutorialTaskFlatSerializer(serializers.ModelSerializer):
    """Minimal serialization of TutorialTask for the unified task list.

    IDs are offset by TUTORIAL_ID_OFFSET to avoid collision with regular Task PKs.
    Visible only to users who don't yet have the reward skill.
    """
    id = serializers.SerializerMethodField()
    is_tutorial = serializers.SerializerMethodField()
    skill_execute_names = serializers.SerializerMethodField()
    in_progress = serializers.SerializerMethodField()
    lat = serializers.SerializerMethodField()
    lon = serializers.SerializerMethodField()

    reward_skill_name = serializers.SerializerMethodField()
    tutorial_pending_review = serializers.SerializerMethodField()
    has_owner = serializers.SerializerMethodField()

    owner = serializers.SerializerMethodField()

    def get_id(self, obj): return TUTORIAL_ID_OFFSET + obj.pk
    def get_is_tutorial(self, obj): return True
    def get_has_owner(self, obj): return obj.owner_id is not None
    def get_owner(self, obj): return obj.owner_id

    def get_reward_skill_name(self, obj):
        return obj.reward_skill.name if obj.reward_skill else None

    def get_skill_execute_names(self, obj):
        return [s.name for s in obj.skill_execute.all()]

    def get_lat(self, obj):
        return getattr(obj, '_user_lat', obj.lat)

    def get_lon(self, obj):
        return getattr(obj, '_user_lon', obj.lon)

    def get_in_progress(self, obj):
        in_progress_ids = self.context.get('in_progress_ids')
        if in_progress_ids is not None:
            return obj.pk in in_progress_ids
        request = self.context.get('request')
        if not request:
            return False
        return TutorialProgress.objects.filter(
            user=request.user, tutorial=obj, state=TutorialProgress.State.IN_PROGRESS
        ).exists()

    def get_tutorial_pending_review(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        return TutorialProgress.objects.filter(
            user=request.user, tutorial=obj,
            review_status='pending',
        ).exists()

    def get_owner_pending_review_count(self, obj):
        """Number of pending reviews for this tutorial (visible to owner)."""
        request = self.context.get('request')
        if not request or obj.owner_id != request.user.id:
            return 0
        from comrade_core.models import TutorialReview
        return TutorialReview.objects.filter(tutorial=obj, status='pending').count()

    owner_pending_review_count = serializers.SerializerMethodField()

    class Meta:
        model = TutorialTask
        fields = ['id', 'is_tutorial', 'name', 'description', 'lat', 'lon', 'skill_execute_names', 'in_progress', 'reward_skill_name', 'tutorial_pending_review', 'has_owner', 'owner', 'owner_pending_review_count']


class TutorialPartSubmissionSerializer(serializers.ModelSerializer):
    part_title = serializers.CharField(source='part.title', read_only=True)
    part_type = serializers.CharField(source='part.type', read_only=True)
    submitted_file_url = serializers.SerializerMethodField()

    def get_submitted_file_url(self, obj):
        if not obj.submitted_file:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.submitted_file.url)
        return obj.submitted_file.url

    class Meta:
        model = TutorialPartSubmission
        fields = ['part_id', 'part_title', 'part_type', 'submitted_text', 'submitted_file_url']