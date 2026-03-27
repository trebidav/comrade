import math
import random

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import ChatMessage, GlobalConfig


def _random_point_within(lat, lon, radius_meters):
    """Generate a random lat/lon within radius_meters of the given point."""
    # Convert radius to degrees (approximate)
    radius_deg = radius_meters / 111320.0  # ~111.32 km per degree
    angle = random.uniform(0, 2 * math.pi)
    r = radius_deg * math.sqrt(random.uniform(0, 1))  # sqrt for uniform area distribution
    return lat + r * math.cos(angle), lon + r * math.sin(angle) / math.cos(math.radians(lat))


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
    config = GlobalConfig.get_config()
    return Response({'show': True, 'message': config.welcome_message}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def welcome_accept(request):
    """Accept T&C and spawn onboarding tutorials around user's location."""
    if request.user.welcome_accepted:
        return Response({'message': 'Already accepted'}, status=status.HTTP_200_OK)

    lat = request.data.get('latitude')
    lon = request.data.get('longitude')

    # Spawn onboarding tutorials if location provided
    if lat is not None and lon is not None:
        lat, lon = float(lat), float(lon)
        from comrade_core.models import OnboardingTemplate, UserOnboardingTutorial
        for template in OnboardingTemplate.objects.filter(is_active=True).select_related('tutorial'):
            spawn_lat, spawn_lon = _random_point_within(lat, lon, template.spawn_radius_meters)
            UserOnboardingTutorial.objects.get_or_create(
                user=request.user,
                tutorial=template.tutorial,
                defaults={'lat': spawn_lat, 'lon': spawn_lon},
            )

    request.user.welcome_accepted = True
    request.user.save(update_fields=['welcome_accepted'])
    return Response({'message': 'ok'}, status=status.HTTP_200_OK)
