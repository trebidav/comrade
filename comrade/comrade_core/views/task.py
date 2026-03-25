import datetime
import logging

from django.core.exceptions import ValidationError
from django.db import models, transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Task, Rating, Review, Skill, LocationConfig, TutorialTask
from ..serializers import TaskSerializer, SkillSerializer, TutorialTaskFlatSerializer
from ..utils import haversine_km
from ..ws_events import send_task_update, send_user_stats, send_achievements

logger = logging.getLogger(__name__)


# POST /task/{taskId}/start
class TaskStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=taskId)
            except Task.DoesNotExist:
                return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

            if task.lat is not None and task.lon is not None:
                config = LocationConfig.get_config()
                distance_km = haversine_km(request.user.latitude, request.user.longitude, task.lat, task.lon)
                if distance_km > config.task_proximity_km:
                    return Response(
                        {"error": f"Too far from task ({int(distance_km * 1000)}m away, max {int(config.task_proximity_km * 1000)}m)"},
                        status=status.HTTP_412_PRECONDITION_FAILED,
                    )

            try:
                task.start(request.user)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)

        send_task_update(task, action='start', exclude_user_id=request.user.id)
        return Response(
            {"message": "Task started!"},
            status=status.HTTP_200_OK,
        )

class TaskFinishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=taskId)
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

        send_task_update(task, action='finish', exclude_user_id=request.user.id)
        return Response({"message": "Task finished!"}, status=status.HTTP_200_OK)


class TaskRateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        try:
            task = Task.objects.get(pk=taskId)
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

    def post(self, request: Request, taskId: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=taskId)
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

    def post(self, request: Request, taskId: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=taskId)
            except Task.DoesNotExist:
                return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

            if task.lat is not None and task.lon is not None:
                config = LocationConfig.get_config()
                distance_km = haversine_km(request.user.latitude, request.user.longitude, task.lat, task.lon)
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
        tasks = Task.objects.filter(
            models.Q(owner=user)
            | models.Q(assignee=user)
            | models.Q(state=Task.State.IN_REVIEW, skill_write__in=user.skills.all())
            | models.Q(skill_read__isnull=True)
            | models.Q(skill_read__in=user.skills.all())
        ).distinct().select_related('owner', 'assignee').prefetch_related('skill_execute', 'skill_read', 'skill_write', 'reviews')

        # For debugging: count tasks that have location data
        tasks_with_location = tasks.exclude(lat__isnull=True).exclude(lon__isnull=True).count()
        logger.debug("Found %d tasks for user %s (%d with location)", tasks.count(), user, tasks_with_location)

        task_serializer = TaskSerializer(tasks, many=True, context={'request': request})

        # Tutorial tasks: only show if user doesn't already have the reward skill
        tutorial_tasks = TutorialTask.objects.exclude(reward_skill__in=user.skills.all()).prefetch_related('skill_execute')
        tutorial_serializer = TutorialTaskFlatSerializer(tutorial_tasks, many=True, context={'request': request})

        return Response(
            {"tasks": list(task_serializer.data) + list(tutorial_serializer.data)},
            status=status.HTTP_200_OK,
        )

class TaskAbandonView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=taskId)
            except Task.DoesNotExist:
                return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
            try:
                task.abandon(request.user)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)
        send_task_update(task, action='abandon', exclude_user_id=request.user.id)
        return Response({"message": "Task abandoned."}, status=status.HTTP_200_OK)


class TaskAcceptReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=taskId)
            except Task.DoesNotExist:
                return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
            try:
                new_achievements = task.accept_review(request.user)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)
            earned_coins = task.coins if task.coins is not None else 0
            earned_xp = task.xp if task.xp is not None else 0

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

    def post(self, request: Request, taskId: int):
        with transaction.atomic():
            try:
                task = Task.objects.select_for_update().get(pk=taskId)
            except Task.DoesNotExist:
                return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
            try:
                task.decline_review(request.user)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)
        send_task_update(task, action='decline_review', exclude_user_id=request.user.id)
        return Response({"message": "Review declined, task reset to open."}, status=status.HTTP_200_OK)


class TaskDebugResetView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        try:
            task = Task.objects.get(pk=taskId)
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

        data = request.data
        _tobool = lambda v: str(v).lower() in ('true', '1', 'yes') if isinstance(v, str) else bool(v)
        name = data.get('name', '').strip()
        if not name:
            return Response({"error": "Name is required"}, status=status.HTTP_400_BAD_REQUEST)

        respawn_time_raw = data.get('respawn_time')
        respawn_time = None
        if respawn_time_raw:
            try:
                h, m = str(respawn_time_raw).split(':')
                respawn_time = datetime.time(int(h), int(m))
            except (ValueError, AttributeError):
                pass

        photo = request.FILES.get('photo')

        task = Task(
            name=name,
            description=data.get('description', ''),
            lat=data.get('lat'),
            lon=data.get('lon'),
            criticality=data.get('criticality', Task.Criticality.LOW),
            minutes=data.get('minutes', 60),
            coins=data.get('coins') or None,
            xp=data.get('xp') or None,
            respawn=_tobool(data.get('respawn', False)),
            respawn_time=respawn_time or datetime.time(10, 0, 0),
            respawn_offset=data.get('respawn_offset') or None,
            require_photo=_tobool(data.get('require_photo', False)),
            require_comment=_tobool(data.get('require_comment', False)),
            owner=user,
            state=Task.State.OPEN,
        )
        if photo:
            task.photo = photo
        task.save()

        skill_read_ids = data.get('skill_read', [])
        skill_write_ids = data.get('skill_write', [])
        skill_execute_ids = data.get('skill_execute', [])

        if skill_read_ids:
            task.skill_read.set(Skill.objects.filter(id__in=skill_read_ids))
        if skill_write_ids:
            task.skill_write.set(Skill.objects.filter(id__in=skill_write_ids))
        if skill_execute_ids:
            task.skill_execute.set(Skill.objects.filter(id__in=skill_execute_ids))

        serializer = TaskSerializer(task, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


def _serialize_achievements(achievements: list) -> list:
    return [{"id": a.id, "name": a.name, "icon": a.icon, "description": a.description} for a in achievements]
