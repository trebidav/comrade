import logging

from django.core.exceptions import ValidationError
from django.db import models, transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Task, Rating, Review, Skill, GlobalConfig, TutorialTask, TutorialProgress, OnboardingTemplate, UserOnboardingTutorial, UserOnboardingTask
from ..serializers import TaskSerializer, SkillSerializer, TutorialTaskFlatSerializer, TaskCreateSerializer
from ..utils import haversine_km
from ..ws_events import send_task_update, send_user_stats, send_achievements

logger = logging.getLogger(__name__)


# POST /task/{taskId}/start
class TaskStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, task_id: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=task_id)
            except Task.DoesNotExist:
                return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

            # Use per-user onboarding location if available, else task's own location
            task_lat, task_lon = task.lat, task.lon
            try:
                uo = UserOnboardingTask.objects.get(user=request.user, task=task)
                task_lat, task_lon = uo.lat, uo.lon
            except UserOnboardingTask.DoesNotExist:
                pass

            if task_lat is not None and task_lon is not None:
                config = GlobalConfig.get_config()
                user_lat = float(request.data.get('latitude', request.user.latitude))
                user_lon = float(request.data.get('longitude', request.user.longitude))
                distance_km = haversine_km(user_lat, user_lon, task_lat, task_lon)
                if distance_km > config.task_proximity_km:
                    return Response(
                        {"error": f"Too far from task ({int(distance_km * 1000)}m away, max {int(config.task_proximity_km * 1000)}m)"},
                        status=status.HTTP_412_PRECONDITION_FAILED,
                    )

            try:
                task.start(request.user)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)

        logger.info("Task %d started by user %d (%s)", task.id, request.user.id, request.user.username)
        send_task_update(task, action='start', exclude_user_id=request.user.id)
        return Response(
            {"message": "Task started!"},
            status=status.HTTP_200_OK,
        )

class TaskFinishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, task_id: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=task_id)
            except Task.DoesNotExist:
                return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

            photo = request.FILES.get('photo')
            comment = request.data.get('comment', '')

            if task.require_photo and not photo:
                return Response({"error": "A photo is required to finish this task"}, status=status.HTTP_400_BAD_REQUEST)
            if task.require_comment and not comment.strip():
                return Response({"error": "A comment is required to finish this task"}, status=status.HTTP_400_BAD_REQUEST)

            try:
                task.finish(request.user)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)

            review = Review(task=task, comment=comment)
            if photo:
                review.photo = photo
            review.save()

        logger.info("Task %d finished by user %d (%s)", task.id, request.user.id, request.user.username)
        send_task_update(task, action='finish', exclude_user_id=request.user.id)
        return Response({"message": "Task finished!"}, status=status.HTTP_200_OK)


class TaskRateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, task_id: int):
        try:
            task = Task.objects.get(pk=task_id)
        except Task.DoesNotExist:
            return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

        happiness = request.data.get('happiness', 3)
        time_rating = request.data.get('time', 3)
        feedback = request.data.get('feedback', '')

        Rating.objects.create(
            task=task,
            user=request.user,
            happiness=happiness,
            time=time_rating,
            feedback=feedback,
        )
        new_achievements = request.user.check_and_award_achievements()
        send_achievements(request.user.id, new_achievements)
        return Response({"message": "Rating saved!", "new_achievements": _serialize_achievements(new_achievements)}, status=status.HTTP_200_OK)

class TaskPauseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, task_id: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=task_id)
            except Task.DoesNotExist:
                return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

            try:
                task.pause(request.user)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)

        send_task_update(task, action='pause', exclude_user_id=request.user.id)
        return Response(
            {"message": "Task paused!"},
            status=status.HTTP_200_OK,
        )

class TaskResumeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, task_id: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=task_id)
            except Task.DoesNotExist:
                return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

            task_lat, task_lon = task.lat, task.lon
            try:
                uo = UserOnboardingTask.objects.get(user=request.user, task=task)
                task_lat, task_lon = uo.lat, uo.lon
            except UserOnboardingTask.DoesNotExist:
                pass

            if task_lat is not None and task_lon is not None:
                config = GlobalConfig.get_config()
                user_lat = float(request.data.get('latitude', request.user.latitude))
                user_lon = float(request.data.get('longitude', request.user.longitude))
                distance_km = haversine_km(user_lat, user_lon, task_lat, task_lon)
                if distance_km > config.task_proximity_km:
                    return Response(
                        {"error": f"Too far from task ({int(distance_km * 1000)}m away, max {int(config.task_proximity_km * 1000)}m)"},
                        status=status.HTTP_412_PRECONDITION_FAILED,
                    )

            try:
                task.resume(request.user)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)

        send_task_update(task, action='resume', exclude_user_id=request.user.id)
        return Response(
            {"message": "Task resumed!"},
            status=status.HTTP_200_OK,
        )

class TaskListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        Task.check_and_respawn()
        Task.check_and_reset_stale()
        user = request.user
        # Visibility rules:
        # - Always visible: owned tasks, assigned tasks, write-skill IN_REVIEW tasks
        # - Otherwise: visible if task has no read skills OR user has a matching read skill
        # Get onboarding template IDs (tutorials + tasks)
        onboarding_tutorial_ids = set(
            OnboardingTemplate.objects.filter(is_active=True, tutorial__isnull=False).values_list('tutorial_id', flat=True)
        )
        onboarding_task_ids = set(
            OnboardingTemplate.objects.filter(is_active=True, task__isnull=False).values_list('task_id', flat=True)
        )

        # Get user's spawned onboarding tasks (per-user lat/lon)
        user_onboarding_tasks = {
            uo.task_id: uo
            for uo in UserOnboardingTask.objects.filter(user=user)
        }

        tasks_qs = Task.objects.filter(
            models.Q(owner=user)
            | models.Q(assignee=user)
            | models.Q(state=Task.State.IN_REVIEW, skill_write__in=user.skills.all())
            | models.Q(skill_read__isnull=True)
            | models.Q(skill_read__in=user.skills.all())
        ).distinct().select_related('owner', 'assignee').prefetch_related('skill_execute', 'skill_read', 'skill_write', 'reviews')

        # Filter onboarding-template tasks: only show if spawned for this user, override lat/lon
        tasks = []
        for t in tasks_qs:
            if t.id in onboarding_task_ids:
                uo = user_onboarding_tasks.get(t.id)
                if uo:
                    t._user_lat = uo.lat
                    t._user_lon = uo.lon
                    tasks.append(t)
            else:
                tasks.append(t)

        task_serializer = TaskSerializer(tasks, many=True, context={'request': request})

        # Tutorial tasks: only show if user doesn't already have the reward skill

        # Get user's spawned onboarding tutorials
        user_onboarding = {
            uo.tutorial_id: uo
            for uo in UserOnboardingTutorial.objects.filter(user=user)
        }

        # Regular tutorials: not onboarding templates
        # Onboarding tutorials: only if spawned for this user
        tutorial_tasks_qs = (
            TutorialTask.objects.exclude(reward_skill__in=user.skills.all())
            .select_related('reward_skill')
            .prefetch_related('skill_execute')
        )

        tutorial_tasks = []
        for t in tutorial_tasks_qs:
            if t.id in onboarding_tutorial_ids:
                # Onboarding template — only show if spawned for this user
                uo = user_onboarding.get(t.id)
                if uo:
                    # Override lat/lon with per-user position
                    t._user_lat = uo.lat
                    t._user_lon = uo.lon
                    tutorial_tasks.append(t)
            else:
                tutorial_tasks.append(t)
        # Batch lookup: which tutorials does this user have in progress?
        in_progress_ids = set(
            TutorialProgress.objects.filter(
                user=user, state=TutorialProgress.State.IN_PROGRESS,
                tutorial__in=tutorial_tasks,
            ).values_list('tutorial_id', flat=True)
        ) if tutorial_tasks else set()
        tutorial_serializer = TutorialTaskFlatSerializer(
            tutorial_tasks, many=True,
            context={'request': request, 'in_progress_ids': in_progress_ids},
        )

        return Response(
            {"tasks": list(task_serializer.data) + list(tutorial_serializer.data)},
            status=status.HTTP_200_OK,
        )

class TaskAbandonView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, task_id: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=task_id)
            except Task.DoesNotExist:
                return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
            try:
                task.abandon(request.user)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)
        logger.info("Task %d abandoned by user %d (%s)", task.id, request.user.id, request.user.username)
        send_task_update(task, action='abandon', exclude_user_id=request.user.id)
        return Response({"message": "Task abandoned."}, status=status.HTTP_200_OK)


class TaskAcceptReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, task_id: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=task_id)
            except Task.DoesNotExist:
                return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
            try:
                new_achievements = task.accept_review(request.user)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)
            earned_coins = task.coins if task.coins is not None else 0
            earned_xp = task.xp if task.xp is not None else 0

        logger.info("Task %d review accepted by user %d (%s)", task.id, request.user.id, request.user.username)
        send_task_update(task, action='accept_review', exclude_user_id=request.user.id)
        # Push stats and achievements to the ASSIGNEE (not the owner who called this)
        if task.assignee:
            task.assignee.refresh_from_db()
            send_user_stats(task.assignee)
            send_achievements(task.assignee.id, new_achievements)

        return Response({
            "message": "Review accepted, task marked as done.",
            "earned_coins": earned_coins,
            "earned_xp": earned_xp,
            "new_achievements": [],  # Achievements belong to assignee, pushed via WS
        }, status=status.HTTP_200_OK)


class TaskDeclineReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, task_id: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=task_id)
            except Task.DoesNotExist:
                return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
            try:
                task.decline_review(request.user)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)
        logger.info("Task %d review declined by user %d (%s)", task.id, request.user.id, request.user.username)
        send_task_update(task, action='decline_review', exclude_user_id=request.user.id)
        return Response({"message": "Review declined, task reset to open."}, status=status.HTTP_200_OK)


class TaskDebugResetView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, task_id: int):
        try:
            task = Task.objects.get(pk=task_id)
        except Task.DoesNotExist:
            return Response(
                {"error": "Task not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if task.owner != request.user:
            return Response({"error": "Only the owner can reset the task"}, status=status.HTTP_403_FORBIDDEN)

        task.debug_reset()
        send_task_update(task, action='reset', exclude_user_id=request.user.id)
        return Response(
            {"message": "Task reset to OPEN state"},
            status=status.HTTP_200_OK
        )


class TaskCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not (user.is_superuser or user.is_staff):
            return Response({"error": "Only admins can create tasks"}, status=status.HTTP_403_FORBIDDEN)

        serializer = TaskCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Validation failed", "fields": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        task = Task(
            name=data['name'],
            description=data['description'],
            lat=data['lat'],
            lon=data['lon'],
            criticality=data['criticality'],
            minutes=data['minutes'],
            coins=data['coins'],
            xp=data['xp'],
            respawn=data['respawn'],
            respawn_time=data['respawn_time'],
            respawn_offset=data['respawn_offset'],
            require_photo=data['require_photo'],
            require_comment=data['require_comment'],
            owner=user,
            state=Task.State.OPEN,
        )
        if data.get('photo'):
            task.photo = data['photo']
        task.save()

        if data['skill_read']:
            task.skill_read.set(data['skill_read'])
        if data['skill_write']:
            task.skill_write.set(data['skill_write'])
        if data['skill_execute']:
            task.skill_execute.set(data['skill_execute'])

        response_serializer = TaskSerializer(task, context={'request': request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


def _serialize_achievements(achievements: list) -> list:
    return [{"id": a.id, "name": a.name, "icon": a.icon, "description": a.description} for a in achievements]
