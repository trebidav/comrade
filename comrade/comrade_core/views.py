from allauth.socialaccount.adapter import (
    get_adapter as get_socialaccount_adapter,
)
from comrade_core.models import Task
from allauth.socialaccount.models import SocialApp, SocialAccount
from django.contrib.auth import authenticate
from django.shortcuts import render, redirect
from rest_framework import generics, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.views import OAuth2LoginView, OAuth2CallbackView
from django.contrib.auth import get_user_model
from allauth.socialaccount.providers.google.provider import GoogleProvider
from allauth.account.decorators import login_required

from .serializers import UserDetailSerializer, TaskSerializer

from django.core.exceptions import ValidationError
from .models import User

from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.utils.decorators import method_decorator
import json
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

User = get_user_model()


def index(request):
    return render(request, "index.html")


@ensure_csrf_cookie
def login_page(request):
    """Render the login page with Google sign-in"""
    if request.user.is_authenticated:
        return redirect('map')
    return render(request, "login.html")


def google(request):
    return render(request, "google.html")


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


@csrf_exempt
@api_view(["GET", "POST"])
def google_login_view(request):
    """Handle Google OAuth login"""
    if request.method == "GET":
        # Handle the redirect from Google
        credential = request.GET.get('credential')
        if not credential:
            return redirect('login_page')
        
        try:
            # Get user info from Google
            adapter = GoogleOAuth2Adapter(request)
            client = OAuth2Client(request, adapter.client_id, adapter.client_secret, adapter.access_token_method, adapter.access_token_url, adapter.callback_url, adapter.scope)
            user_info = client.get_user_info(credential)

            # Get or create user
            try:
                user = User.objects.get(email=user_info['email'])
            except User.DoesNotExist:
                # Create new user
                user = User.objects.create_user(
                    username=user_info['email'],
                    email=user_info['email'],
                    first_name=user_info.get('given_name', ''),
                    last_name=user_info.get('family_name', '')
                )

            # Create or get social account
            social_account, created = SocialAccount.objects.get_or_create(
                provider=GoogleProvider.id,
                uid=user_info['id'],
                defaults={'user': user}
            )
            if not created:
                social_account.user = user
                social_account.save()

            # Create or get token
            token, created = Token.objects.get_or_create(user=user)
            
            # Store token and user info in session
            request.session['api_token'] = token.key
            request.session['user'] = {
                'id': user.id,
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}".strip() or user.username
            }
            
            # Set CSRF cookie
            from django.middleware.csrf import get_token
            get_token(request)
            
            return redirect('map')
            
        except Exception as e:
            print("Google login error:", str(e))
            return redirect('login_page')
    
    # Handle POST requests (if any)
    access_token = request.data.get("access_token")
    if not access_token:
        return Response(
            {"error": "Access token is required"}, 
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Get user info from Google
        adapter = GoogleOAuth2Adapter(request)
        client = OAuth2Client(request, adapter.client_id, adapter.client_secret, adapter.access_token_method, adapter.access_token_url, adapter.callback_url, adapter.scope)
        user_info = client.get_user_info(access_token)

        # Get or create user
        try:
            user = User.objects.get(email=user_info['email'])
        except User.DoesNotExist:
            # Create new user
            user = User.objects.create_user(
                username=user_info['email'],
                email=user_info['email'],
                first_name=user_info.get('given_name', ''),
                last_name=user_info.get('family_name', '')
            )

        # Create or get social account
        social_account, created = SocialAccount.objects.get_or_create(
            provider=GoogleProvider.id,
            uid=user_info['id'],
            defaults={'user': user}
        )
        if not created:
            social_account.user = user
            social_account.save()

        # Create or get token
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            "token": token.key,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": f"{user.first_name} {user.last_name}".strip() or user.username
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {"error": str(e)}, 
            status=status.HTTP_401_UNAUTHORIZED
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