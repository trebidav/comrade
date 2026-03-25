from rest_framework import generics, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import User
from ..serializers import UserDetailSerializer


class UserDetailView(generics.RetrieveAPIView):
    serializer_class = UserDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


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
