from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import ChatMessage, LocationConfig


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chat_history(request):
    """Return the last 100 chat messages from friends only."""
    friend_ids = request.user.friends.values_list('id', flat=True)
    messages = (
        ChatMessage.objects
        .filter(sender__in=[request.user.id, *friend_ids])
        .select_related('sender')
        .order_by('-created_at')[:100]
    )
    data = [
        {
            'id': m.id,
            'text': m.text,
            'sender': m.sender.username,
            'timestamp': m.created_at.isoformat(),
        }
        for m in reversed(messages)
    ]
    return Response({'messages': data}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def welcome_message(request):
    """Return the welcome message if the user has not accepted it yet."""
    if request.user.welcome_accepted:
        return Response({'show': False}, status=status.HTTP_200_OK)
    config = LocationConfig.get_config()
    return Response({'show': True, 'message': config.welcome_message}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def welcome_accept(request):
    """Mark the welcome message as accepted for this user."""
    request.user.welcome_accepted = True
    request.user.save(update_fields=['welcome_accepted'])
    return Response({'status': 'ok'}, status=status.HTTP_200_OK)
