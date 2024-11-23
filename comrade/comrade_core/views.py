import asyncio
import datetime
import json
import random
from typing import AsyncGenerator, Callable

import redis
from allauth.socialaccount.adapter import (
    get_adapter as get_socialaccount_adapter,
)
from allauth.socialaccount.models import SocialApp

from comrade_core.models import Task
from comrade_core.serializers import GroupSerializer, TaskSerializer, UserSerializer
from django.conf import settings
from django.contrib.auth.models import Group, User
from django.http import HttpResponse, StreamingHttpResponse
from django.shortcuts import render
from django_async_stream import AsyncStreamingHttpResponse
from django_eventstream import send_event
from redis import asyncio as aioredis
from rest_framework import permissions, viewsets
from rest_framework.permissions import IsAuthenticated
# from adrf.views import APIView
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.views import APIView



def index(request):
    return render(request, "index.html")

def google(request):
    try:
        provider = get_socialaccount_adapter().get_provider(
            request, "google"
        )
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

from rest_framework import generics
from .serializers import UserDetailSerializer

class UserDetailView(generics.RetrieveAPIView):
    serializer_class = UserDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user  # Return the currently authenticated user

from django.contrib.auth import authenticate
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework import status
from rest_framework.decorators import api_view

@api_view(['POST'])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    if user is not None:
        token, created = Token.objects.get_or_create(user=user)
        return Response({'token': token.key}, status=status.HTTP_200_OK)
    return Response({'error': 'Invalid Credentials'}, status=status.HTTP_401_UNAUTHORIZED)
