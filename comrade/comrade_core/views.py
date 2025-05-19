from allauth.socialaccount.adapter import (
    get_adapter as get_socialaccount_adapter,
)
from comrade_core.models import Task
from allauth.socialaccount.models import SocialApp, SocialAccount
from django.contrib.auth import authenticate
from django.shortcuts import render
from rest_framework import generics, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import UserDetailSerializer, TaskSerializer

from django.core.exceptions import ValidationError
from .models import User


def index(request):
    return render(request, "index.html")


def google(request):
    try:
        provider = get_socialaccount_adapter().get_provider(request, "google")
        context = {
            "client_id": provider.app.client_id,
        }
    except SocialApp.DoesNotExist:
        context = {
            "error": "Google social app not found. Check Sites in configuration.",
        }
    return render(request, "google.html", context=context)


def map(request):
    return render(request, "map.html")


class UserDetailView(generics.RetrieveAPIView):
    serializer_class = UserDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user  # Return the currently authenticated user


@api_view(["POST"])
def login_view(request):
    username = request.data.get("username")
    password = request.data.get("password")
    user = authenticate(username=username, password=password)
    if user is not None:
        token, created = Token.objects.get_or_create(user=user)
        return Response({"token": token.key}, status=status.HTTP_200_OK)

    return Response(
        {"error": "Invalid Credentials"}, status=status.HTTP_401_UNAUTHORIZED
    )


# POST /task/{taskId}/start
class TaskStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, taskId: int):
        task = None
        try:
            task = Task.objects.get(pk=taskId)
        except Task.DoesNotExist as e:
            return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

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
        task = None
        try:
            task = Task.objects.get(pk=taskId)
        except Task.DoesNotExist as e:
            return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

        print(request.user)
        try:
            task.finish(request.user)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_412_PRECONDITION_FAILED)

        return Response(
            {"message": "Task finished!"},
            status=status.HTTP_200_OK,
        )

class TaskListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        tasks = Task.objects.filter(skill_read__in=user.skills.all())
        serializer = TaskSerializer(tasks, many=True)
        return Response(
            {"tasks": serializer.data},
            status=status.HTTP_200_OK,
        )

@api_view(["POST"])
def google_login_view(request):
    access_token = request.data.get("access_token")
    
    if not access_token:
        return Response(
            {"error": "Access token is required"}, 
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Get the social account associated with the Google token
        social_account = SocialAccount.objects.get(
            provider="google",
            extra_data__id_token=access_token
        )
        user = social_account.user
        
        # Create or get the API token for the user
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({"token": token.key}, status=status.HTTP_200_OK)
        
    except SocialAccount.DoesNotExist:
        return Response(
            {"error": "Invalid Google token"}, 
            status=status.HTTP_401_UNAUTHORIZED
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
        return Response({'status': 'Friend request accepted'}, status=status.HTTP_200_OK)
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