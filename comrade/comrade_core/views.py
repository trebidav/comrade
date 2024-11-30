from allauth.socialaccount.adapter import (
    get_adapter as get_socialaccount_adapter,
)
from comrade_core.models import Task
from allauth.socialaccount.models import SocialApp
from django.contrib.auth import authenticate
from django.shortcuts import render
from rest_framework import generics, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import UserDetailSerializer


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
class MyPostView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        taskId = request.query_params["taskId"]
        task = None
        try:
            task = Task.objects.get(pk=taskId)
        except Task.DoesNotExist as e:
            raise e

        task.start(request.user)

        return Response(
            {"message": "Task started!"},
            status=status.HTTP_200_OK,
        )
