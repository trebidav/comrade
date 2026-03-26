import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import User

logger = logging.getLogger(__name__)
from ..serializers import UserDetailSerializer
from ..ws_events import send_friend_event, send_achievements
from .task import _serialize_achievements


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_friend_request(request, user_id):
    try:
        target_user = User.objects.get(id=user_id)
        request.user.send_friend_request(target_user)
        logger.info("Friend request: user %d → user %d", request.user.id, target_user.id)
        send_friend_event(target_user.id, {
            'type': 'friend_request_received',
            'fromUser': {'id': request.user.id, 'username': request.user.username},
        })
        return Response({'message': 'Friend request sent'}, status=status.HTTP_200_OK)
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
        logger.info("Friend accepted: user %d ↔ user %d", request.user.id, target_user.id)

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

        # Notify the sender that their request was accepted
        send_friend_event(target_user.id, {
            'type': 'friend_request_accepted',
            'user': {'id': request.user.id, 'username': request.user.username},
        })

        new_achievements = request.user.check_and_award_achievements()
        send_achievements(request.user.id, new_achievements)
        return Response({'message': 'Friend request accepted', 'new_achievements': _serialize_achievements(new_achievements)}, status=status.HTTP_200_OK)
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
        logger.info("Friend rejected: user %d rejected user %d", request.user.id, target_user.id)
        send_friend_event(target_user.id, {
            'type': 'friend_request_rejected',
            'userId': request.user.id,
        })
        return Response({'message': 'Friend request rejected'}, status=status.HTTP_200_OK)
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
        logger.info("Friend removed: user %d removed user %d", request.user.id, target_user.id)
        send_friend_event(target_user.id, {
            'type': 'friend_removed',
            'userId': request.user.id,
        })
        return Response({'message': 'Friend removed'}, status=status.HTTP_200_OK)
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
