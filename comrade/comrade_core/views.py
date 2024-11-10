import asyncio
import datetime
import json
import random
from typing import AsyncGenerator, Callable

import redis
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


""" 
# I tried to implement the following code,
# but SSE is unsuitable due to lot of blocking connections
# I will go with Websockets instead leveraging Django Channels

def send(request):
    r = redis.Redis()
    r.publish("general", '{"message": "' + str(request.GET.get("message")) + '"}')
    #    send_event("test", "message", {"text": str(request.GET.get("message"))})
    return HttpResponse(
        "Received message from query parameter: " + str(request.GET.get("message"))
    )


def start_task(request):
    task_id = str(request.GET.get("id"))
    user_id = str(request.user.pk)
    r = redis.Redis()
    r.publish(
        "general",
        '{"notification": {"user_id": '
        + user_id
        + ', "action" : "started_task", "task_id" : " '
        + task_id
        + ' "}}',
    )
    r.publish(
        "general", '{"task_state": {"id": ' + task_id + ', "state": "in_progress"}}'
    )
    r.publish("general", '{"user_state": {"id": ' + user_id + ', "state": "busy"}}')
    #    send_event("test", "message", {"text": str(request.GET.get("message"))})
    return HttpResponse("Started task with ID: " + task_id)


async def sse_stream(request):
    return StreamingHttpResponse(
        listen_to_channel(),
        content_type="text/event-stream",
    )


# Create Redis conection client
def get_async_redis_client():
    try:
        return aioredis.from_url(
            f"redis://localhost:6379", encoding="utf8", decode_responses=True
        )
    except Exception as e:
        print("An unexpected error occurred:", e)


async def listen_to_channel() -> AsyncGenerator:
    # Create message listener and subscribe on the event source channel
    async with get_async_redis_client().pubsub() as listener:
        await listener.subscribe("general")
        # Create a generator that will 'yield' our data into opened connection
        while True:
            message = await listener.get_message(
                timeout=10, ignore_subscribe_messages=True
            )
            # Send heartbeat message
            if message is None:
                message = {"ping": "datetime.now()"}
                yield f"data: {json.dumps(message, default=str)}\n\n"
                continue
            message = json.loads(message["data"])
            yield f"data: {json.dumps(message)}\n\n"


class ServerSentEventRenderer(BaseRenderer):
    media_type = "text/event-stream"
    format = "txt"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class Notify(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer, ServerSentEventRenderer]

    def get(self, request):
        generator = listen_to_channel()
        response = StreamingHttpResponse(
            streaming_content=generator, content_type="text/event-stream"
        )
        response["X-Accel-Buffering"] = "no"  # Disable buffering in nginx
        response["Cache-Control"] = "no-cache"  # Ensure clients don't cache the data
        return response
 """

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