from comrade_core.models import Task, User, Review, Skill, TutorialTask, TutorialPart, TutorialQuestion, TutorialAnswer, TutorialProgress
from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from rest_framework import serializers


class UserSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = User
        fields = ["url", "username", "email", "groups"]


class GroupSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Group
        fields = ["url", "name"]


class TaskSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Task
        fields = ["title"]

User = get_user_model()

class UserDetailSerializer(serializers.ModelSerializer):
    skills = serializers.StringRelatedField(many=True)
    level = serializers.IntegerField(read_only=True)
    level_progress = serializers.DictField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "latitude", "longitude", "skills", "is_superuser", "is_staff", "coins", "xp", "total_coins_earned", "total_xp_earned", "task_streak", "level", "level_progress"]


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

    def get_is_tutorial(self, obj):
        return False

    def get_pending_review(self, obj):
        review = obj.reviews.filter(status='pending').order_by('-created_at').first()
        if review:
            return PendingReviewSerializer(review, context=self.context).data
        return None

    class Meta:
        model = Task
        fields = "__all__"


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
        fields = ['id', 'type', 'title', 'order', 'text_content', 'video_url', 'questions', 'completed']
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

    def get_id(self, obj): return TUTORIAL_ID_OFFSET + obj.pk
    def get_is_tutorial(self, obj): return True

    def get_skill_execute_names(self, obj):
        return [s.name for s in obj.skill_execute.all()]

    def get_in_progress(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        return TutorialProgress.objects.filter(
            user=request.user, tutorial=obj, state=TutorialProgress.State.IN_PROGRESS
        ).exists()

    class Meta:
        model = TutorialTask
        fields = ['id', 'is_tutorial', 'name', 'description', 'lat', 'lon', 'skill_execute_names', 'in_progress']