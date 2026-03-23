import datetime
import urllib.parse
import urllib.request
from comrade_core.models import Task
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from rest_framework import generics, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model

from .serializers import UserDetailSerializer, TaskSerializer, SkillSerializer, TutorialTaskDetailSerializer, TutorialTaskFlatSerializer

from django.core.exceptions import ValidationError
from django.utils.timezone import now
from .models import User, Rating, Review, Skill, LocationConfig, haversine_km, TutorialTask, TutorialPart, TutorialAnswer, TutorialProgress, Achievement, UserAchievement

from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.utils.decorators import method_decorator
import json
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.db import models

User = get_user_model()


def index(request):
    return render(request, "index.html")


@ensure_csrf_cookie
def login_page(request):
    """Render the login page"""
    if request.user.is_authenticated:
        return redirect('map')
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            from django.contrib.auth import login
            login(request, user)
            return redirect('map')
        return render(request, "login.html", {'error': 'Invalid username or password'})
    return render(request, "login.html")


@ensure_csrf_cookie
@login_required
def map(request):
    """Render the map page"""
    # Create or get token
    token, created = Token.objects.get_or_create(user=request.user)
    
    # Get friends list
    friends = request.user.get_friends()
    
    # Prepare user data
    user_data = {
        'id': request.user.id,
        'email': request.user.email,
        'name': f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username,
        'friends': [{'id': friend.id, 'name': f"{friend.first_name} {friend.last_name}".strip() or friend.username} for friend in friends],
        'skills': list(request.user.skills.values_list('name', flat=True))
    }
    
    # Set CSRF cookie
    from django.middleware.csrf import get_token
    get_token(request)
    
    context = {
        'api_token': token.key,
        'user': json.dumps(user_data)
    }
    
    return render(request, "map.html", context=context)


class UserDetailView(generics.RetrieveAPIView):
    serializer_class = UserDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


@api_view(["GET"])
def login_view(request):
    """Redirect to login page"""
    return redirect('login_page')


@api_view(["POST"])
def token_login_view(request):
    """Token-based login for the React frontend"""
    username = request.data.get("username")
    password = request.data.get("password")
    user = authenticate(username=username, password=password)
    if user is not None:
        token, created = Token.objects.get_or_create(user=user)
        return Response({"token": token.key}, status=status.HTTP_200_OK)
    return Response({"error": "Invalid Credentials"}, status=status.HTTP_401_UNAUTHORIZED)


# POST /task/{taskId}/start
class TaskStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        task = None
        try:
            task = Task.objects.get(pk=taskId)
        except Task.DoesNotExist as e:
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

        return Response(
            {"message": "Task started!"},
            status=status.HTTP_200_OK,
        )

class TaskFinishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        try:
            task = Task.objects.get(pk=taskId)
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
        return Response({"message": "Rating saved!", "new_achievements": _serialize_achievements(new_achievements)}, status=status.HTTP_200_OK)

class TaskPauseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        task = None
        try:
            task = Task.objects.get(pk=taskId)
        except Task.DoesNotExist as e:
            return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            task.pause(request.user)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)

        return Response(
            {"message": "Task paused!"},
            status=status.HTTP_200_OK,
        )

class TaskResumeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        task = None
        try:
            task = Task.objects.get(pk=taskId)
        except Task.DoesNotExist as e:
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
            models.Q(owner=user) |
            models.Q(assignee=user) |
            models.Q(state=Task.State.IN_REVIEW, skill_write__in=user.skills.all()) |
            (
                ~models.Q(skill_read__isnull=False) |
                models.Q(skill_read__in=user.skills.all())
            )
        ).distinct()
        
        # For debugging: count tasks that have location data
        tasks_with_location = tasks.exclude(lat__isnull=True).exclude(lon__isnull=True).count()
        print(f"Found {tasks.count()} tasks for user {user} ({tasks_with_location} with location)")
        
        task_serializer = TaskSerializer(tasks, many=True, context={'request': request})

        # Tutorial tasks: only show if user doesn't already have the reward skill
        tutorial_tasks = TutorialTask.objects.exclude(reward_skill__in=user.skills.all())
        tutorial_serializer = TutorialTaskFlatSerializer(tutorial_tasks, many=True, context={'request': request})

        return Response(
            {"tasks": list(task_serializer.data) + list(tutorial_serializer.data)},
            status=status.HTTP_200_OK,
        )

class TaskAbandonView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        try:
            task = Task.objects.get(pk=taskId)
        except Task.DoesNotExist:
            return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
        try:
            task.abandon(request.user)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)
        return Response({"message": "Task abandoned."}, status=status.HTTP_200_OK)


class TaskAcceptReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        try:
            task = Task.objects.get(pk=taskId)
        except Task.DoesNotExist:
            return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
        try:
            new_achievements = task.accept_review(request.user)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)
        earned_coins = task.coins if task.coins is not None else 0
        earned_xp = task.xp if task.xp is not None else 0
        return Response({
            "message": "Review accepted, task marked as done.",
            "earned_coins": earned_coins,
            "earned_xp": earned_xp,
            "new_achievements": _serialize_achievements(new_achievements),
        }, status=status.HTTP_200_OK)


class TaskDeclineReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        try:
            task = Task.objects.get(pk=taskId)
        except Task.DoesNotExist:
            return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
        try:
            task.decline_review(request.user)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)
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
        return Response(
            {"message": "Task reset to OPEN state"},
            status=status.HTTP_200_OK
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_friend_request(request, user_id):
    try:
        target_user = User.objects.get(id=user_id)
        request.user.send_friend_request(target_user)
        return Response({'status': 'Friend request sent'}, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except ValidationError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_friend_request(request, user_id):
    try:
        target_user = User.objects.get(id=user_id)
        request.user.accept_friend_request(target_user)

        # Get channel layer for WebSocket communication
        channel_layer = get_channel_layer()

        # Get both users' friends and skills
        current_user_friends = request.user.get_friends()
        target_user_friends = target_user.get_friends()

        # Prepare friend details messages for both users
        current_user_details = {
            'type': 'friend_details',
            'userId': request.user.id,
            'name': f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username,
            'friends': [{'id': f.id, 'name': f"{f.first_name} {f.last_name}".strip() or f.username} for f in current_user_friends],
            'skills': list(request.user.skills.values_list('name', flat=True))
        }

        target_user_details = {
            'type': 'friend_details',
            'userId': target_user.id,
            'name': f"{target_user.first_name} {target_user.last_name}".strip() or target_user.username,
            'friends': [{'id': f.id, 'name': f"{f.first_name} {f.last_name}".strip() or f.username} for f in target_user_friends],
            'skills': list(target_user.skills.values_list('name', flat=True))
        }

        # Send friend details to both users
        async_to_sync(channel_layer.group_send)(
            f"location_{target_user.id}",
            current_user_details
        )
        async_to_sync(channel_layer.group_send)(
            f"location_{request.user.id}",
            target_user_details
        )

        new_achievements = request.user.check_and_award_achievements()
        return Response({'status': 'Friend request accepted', 'new_achievements': _serialize_achievements(new_achievements)}, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except ValidationError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_friend_request(request, user_id):
    try:
        target_user = User.objects.get(id=user_id)
        request.user.reject_friend_request(target_user)
        return Response({'status': 'Friend request rejected'}, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except ValidationError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_friend(request, user_id):
    try:
        target_user = User.objects.get(id=user_id)
        request.user.remove_friend(target_user)
        return Response({'status': 'Friend removed'}, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except ValidationError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_friends(request):
    friends = request.user.get_friends()
    serializer = UserDetailSerializer(friends, many=True)
    return Response({'friends': serializer.data}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_pending_requests(request):
    pending_requests = request.user.get_pending_friend_requests()
    serializer = UserDetailSerializer(pending_requests, many=True)
    return Response({'pending_requests': serializer.data}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_sent_requests(request):
    sent_requests = request.user.get_sent_friend_requests()
    serializer = UserDetailSerializer(sent_requests, many=True)
    return Response({'sent_requests': serializer.data}, status=status.HTTP_200_OK)

@api_view(['GET'])
def get_user_info(request):
    """Get user information after successful login"""
    if not request.user.is_authenticated:
        return Response(
            {"error": "User not authenticated"}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Create or get token
    token, created = Token.objects.get_or_create(user=request.user)
    
    return Response({
        "token": token.key,
        "user": {
            "id": request.user.id,
            "email": request.user.email,
            "name": f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
        }
    }, status=status.HTTP_200_OK)

class TutorialDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, taskId):
        try:
            tutorial = TutorialTask.objects.get(pk=taskId)
        except TutorialTask.DoesNotExist:
            return Response({"error": "Tutorial not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = TutorialTaskDetailSerializer(tutorial, context={'request': request})
        return Response(serializer.data)


class TutorialSubmitPartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, taskId, partId):
        try:
            tutorial = TutorialTask.objects.get(pk=taskId)
            part = tutorial.parts.get(pk=partId)
        except (TutorialTask.DoesNotExist, TutorialPart.DoesNotExist):
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            progress = TutorialProgress.objects.get(
                user=request.user, tutorial=tutorial, state=TutorialProgress.State.IN_PROGRESS
            )
        except TutorialProgress.DoesNotExist:
            return Response({"error": "Tutorial not started"}, status=status.HTTP_403_FORBIDDEN)

        # Validate part
        if part.type == TutorialPart.Type.QUIZ:
            submitted = request.data.get('answers', {})  # {str(question_id): answer_id}
            for question in part.questions.all():
                answer_id = submitted.get(str(question.id))
                if not answer_id:
                    return Response({"error": "Question not answered", "question_id": question.id}, status=status.HTTP_400_BAD_REQUEST)
                try:
                    answer = question.answers.get(pk=answer_id)
                except TutorialAnswer.DoesNotExist:
                    return Response({"error": "Invalid answer"}, status=status.HTTP_400_BAD_REQUEST)
                if not answer.is_correct:
                    return Response({"error": "Wrong answer", "question_id": question.id}, status=status.HTTP_400_BAD_REQUEST)

        elif part.type == TutorialPart.Type.PASSWORD:
            if request.data.get('password', '') != part.password:
                return Response({"error": "Incorrect password"}, status=status.HTTP_400_BAD_REQUEST)

        elif part.type == TutorialPart.Type.FILE_UPLOAD:
            if not request.FILES.get('file'):
                return Response({"error": "A file is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Mark part complete
        progress.completed_parts.add(part)

        if progress.is_complete():
            request.user.skills.add(tutorial.reward_skill)
            progress.state = TutorialProgress.State.DONE
            progress.datetime_finish = now()
            progress.save()
            new_achievements = request.user.check_and_award_achievements()
            return Response({"completed": True, "reward_skill": tutorial.reward_skill.name, "new_achievements": _serialize_achievements(new_achievements)})

        return Response({"completed": False, "part_id": part.id})


class TutorialTaskStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, taskId):
        try:
            tutorial = TutorialTask.objects.get(pk=taskId)
        except TutorialTask.DoesNotExist:
            return Response({"error": "Tutorial task not found"}, status=status.HTTP_404_NOT_FOUND)

        # Proximity check
        if tutorial.lat is not None and tutorial.lon is not None:
            config = LocationConfig.get_config()
            distance_km = haversine_km(request.user.latitude, request.user.longitude, tutorial.lat, tutorial.lon)
            if distance_km > config.task_proximity_km:
                return Response(
                    {"error": f"Too far from task ({int(distance_km * 1000)}m away, max {int(config.task_proximity_km * 1000)}m)"},
                    status=status.HTTP_412_PRECONDITION_FAILED,
                )

        # Skill check
        required_skills = tutorial.skill_execute.all()
        if required_skills.exists():
            if request.user.skills.filter(id__in=required_skills).count() < required_skills.count():
                return Response({"error": "Missing required skills"}, status=status.HTTP_412_PRECONDITION_FAILED)

        progress, created = TutorialProgress.objects.get_or_create(
            user=request.user,
            tutorial=tutorial,
            defaults={'state': TutorialProgress.State.IN_PROGRESS},
        )
        if not created and progress.state == TutorialProgress.State.DONE:
            return Response({"error": "Tutorial already completed"}, status=status.HTTP_412_PRECONDITION_FAILED)

        return Response({"message": "Tutorial started!"}, status=status.HTTP_200_OK)


class TutorialTaskAbandonView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, taskId):
        try:
            tutorial = TutorialTask.objects.get(pk=taskId)
        except TutorialTask.DoesNotExist:
            return Response({"error": "Tutorial task not found"}, status=status.HTTP_404_NOT_FOUND)

        deleted, _ = TutorialProgress.objects.filter(
            user=request.user, tutorial=tutorial, state=TutorialProgress.State.IN_PROGRESS
        ).delete()
        if not deleted:
            return Response({"error": "Tutorial not in progress"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"message": "Tutorial abandoned."}, status=status.HTTP_200_OK)


class ProximitySettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config = LocationConfig.get_config()
        return Response({
            'radius_km': config.task_proximity_km,
            'coins_modifier': config.coins_modifier,
            'xp_modifier': config.xp_modifier,
            'time_modifier_minutes': config.time_modifier_minutes,
            'criticality_percentage': config.criticality_percentage,
            'pause_multiplier': config.pause_multiplier,
        }, status=status.HTTP_200_OK)


class GlobalConfigView(APIView):
    permission_classes = [IsAuthenticated]

    FIELDS = ['max_distance_km', 'task_proximity_km', 'coins_modifier', 'xp_modifier',
              'time_modifier_minutes', 'criticality_percentage', 'pause_multiplier', 'level_modifier']

    def get(self, request):
        if not request.user.is_superuser:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        config = LocationConfig.get_config()
        return Response({f: getattr(config, f) for f in self.FIELDS})

    def patch(self, request):
        if not request.user.is_superuser:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        config = LocationConfig.get_config()
        updated = []
        for field in self.FIELDS:
            if field in request.data:
                try:
                    setattr(config, field, float(request.data[field]))
                    updated.append(field)
                except (ValueError, TypeError):
                    return Response({"error": f"Invalid value for {field}"}, status=status.HTTP_400_BAD_REQUEST)
        if updated:
            config.save(update_fields=updated)
        return Response({f: getattr(config, f) for f in self.FIELDS})


def _serialize_achievements(achievements: list) -> list:
    return [{"id": a.id, "name": a.name, "icon": a.icon, "description": a.description} for a in achievements]


class AchievementsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        earned_map = {ua.achievement_id: ua for ua in user.user_achievements.all()}
        data = []
        for achievement in Achievement.objects.filter(is_active=True):
            ua = earned_map.get(achievement.id)
            earned = ua is not None
            if achievement.is_secret and not earned:
                data.append({
                    'id': achievement.id,
                    'name': '???',
                    'description': 'Secret achievement — keep playing to discover it',
                    'icon': '🔒',
                    'is_secret': True,
                    'earned': False,
                    'datetime_earned': None,
                    'progress': None,
                    'threshold': achievement.condition_value,
                    'reward_coins': 0,
                    'reward_xp': 0,
                    'reward_skill': None,
                })
            else:
                progress = ua.progress if ua else achievement.compute_progress(user)
                data.append({
                    'id': achievement.id,
                    'name': achievement.name,
                    'description': achievement.description,
                    'icon': achievement.icon,
                    'is_secret': achievement.is_secret,
                    'earned': earned,
                    'datetime_earned': ua.datetime_earned.isoformat() if ua else None,
                    'progress': progress,
                    'threshold': achievement.condition_value,
                    'reward_coins': achievement.reward_coins,
                    'reward_xp': achievement.reward_xp,
                    'reward_skill': achievement.reward_skill.name if achievement.reward_skill else None,
                })
        return Response({'achievements': data})


class SkillListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        skills = Skill.objects.all().order_by('name')
        serializer = SkillSerializer(skills, many=True)
        return Response({'skills': serializer.data}, status=status.HTTP_200_OK)


class TaskCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not (user.is_superuser or user.is_staff):
            return Response({"error": "Only admins can create tasks"}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
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

        task = Task(
            name=name,
            description=data.get('description', ''),
            lat=data.get('lat'),
            lon=data.get('lon'),
            criticality=data.get('criticality', Task.Criticality.LOW),
            minutes=data.get('minutes', 60),
            coins=data.get('coins') or None,
            xp=data.get('xp') or None,
            respawn=bool(data.get('respawn', False)),
            respawn_time=respawn_time or datetime.time(10, 0, 0),
            respawn_offset=data.get('respawn_offset') or None,
            require_photo=data.get('require_photo', False),
            require_comment=data.get('require_comment', False),
            owner=user,
            state=Task.State.OPEN,
        )
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


@api_view(['GET'])
def google_config(request):
    """Return Google OAuth client ID to the React frontend."""
    return Response({'client_id': settings.GOOGLE_CLIENT_ID})


@csrf_exempt
def google_oauth_callback(request):
    """Exchange Google OAuth code for a DRF token and redirect to the SPA."""
    error = request.GET.get('error')
    code = request.GET.get('code')

    if error or not code:
        return redirect('/?google_error=access_denied')

    # Exchange the authorization code for tokens
    data = urllib.parse.urlencode({
        'code': code,
        'client_id': settings.GOOGLE_CLIENT_ID,
        'client_secret': settings.GOOGLE_CLIENT_SECRET,
        'redirect_uri': settings.GOOGLE_REDIRECT_URI,
        'grant_type': 'authorization_code',
    }).encode()

    req = urllib.request.Request(
        'https://oauth2.googleapis.com/token',
        data=data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req) as resp:
            token_data = json.loads(resp.read())
    except Exception:
        return redirect('/?google_error=token_exchange_failed')

    raw_id_token = token_data.get('id_token')
    if not raw_id_token:
        return redirect('/?google_error=no_id_token')

    # Verify the id_token and extract user info
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    try:
        id_info = google_id_token.verify_oauth2_token(
            raw_id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception:
        return redirect('/?google_error=invalid_token')

    email = id_info.get('email')
    if not email:
        return redirect('/?google_error=no_email')

    # Get or create the Django user
    UserModel = get_user_model()
    user, created = UserModel.objects.get_or_create(
        email=email,
        defaults={
            'username': _unique_username(UserModel, email),
            'first_name': id_info.get('given_name', ''),
            'last_name': id_info.get('family_name', ''),
        },
    )
    if not created and not user.first_name:
        user.first_name = id_info.get('given_name', '')
        user.last_name = id_info.get('family_name', '')
        user.save(update_fields=['first_name', 'last_name'])

    drf_token, _ = Token.objects.get_or_create(user=user)
    return redirect(f'/?google_token={drf_token.key}')


def _unique_username(UserModel, email: str) -> str:
    base = email.split('@')[0][:100]
    username = base
    counter = 1
    while UserModel.objects.filter(username=username).exists():
        username = f'{base}{counter}'
        counter += 1
    return username


class LocationSharingPreferencesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current location sharing preferences"""
        preferences = request.user.get_location_sharing_preferences()
        return Response(preferences, status=status.HTTP_200_OK)

    def post(self, request):
        """Update location sharing preferences"""
        sharing_level = request.data.get('sharing_level')
        
        if sharing_level not in dict(User.SharingLevel.choices):
            return Response(
                {"error": "Invalid sharing level"},
                status=status.HTTP_400_BAD_REQUEST
            )

        request.user.update_location_sharing_preferences(sharing_level=sharing_level)
        
        # Get updated preferences
        preferences = request.user.get_location_sharing_preferences()
        return Response(preferences, status=status.HTTP_200_OK)