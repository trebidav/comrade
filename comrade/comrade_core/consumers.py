import json
from datetime import timedelta
from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token

class LocationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'location_updates'
        query_string = self.scope['query_string'].decode()
        query_params = parse_qs(query_string)
        self.token = query_params.get('token', [None])[0]
        try:
            token = await database_sync_to_async(Token.objects.get)(key=self.token)
            self.user = await sync_to_async(lambda: token.user)()
            if self.user.is_authenticated:
#                self.group_name = f"user_{self.user.id}"
                await self.channel_layer.group_add(
                    self.group_name,
                    self.channel_name
                )
                await self.accept()  # Accept the WebSocket connection
            else:
                await self.close()  # Close the connection if not authenticated
        except Token.DoesNotExist:
            await self.close()

    async def disconnect(self, close_code):
        if self.group_name:
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        data = json.loads(text_data)
        latitude = data['latitude']
        longitude = data['longitude']

        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'location_update',
                'latitude': latitude,
                'longitude': longitude
            }
        )
        
        timestamp = self.user.timestamp

        # Check if enough time has passed since the last save
        if timestamp is None or timezone.now() - timestamp > timedelta(seconds=30):
            # Save the user's location to the database
            await self.save_user_location(self.user, latitude, longitude)
            print(f"[{timezone.now()}] Location saved for {self.user.username} at {latitude}, {longitude}")


    async def location_update(self, event):
        await self.send(text_data=json.dumps({
            'latitude': event['latitude'],
            'longitude': event['longitude']
        }))

    async def save_user_location(self, user, latitude, longitude):
        # Create a new UserLocation instance and save it to the database
        user.latitude = latitude
        user.longitude = longitude
        user.timestamp = timezone.now()
        await database_sync_to_async(user.save)()

    @database_sync_to_async
    def get_user_from_token(self):
        token = self.scope['url_route']['kwargs'].get('token')
        try:
            token = Token.objects.get(key=token)
            return token.user
        except Token.DoesNotExist:
            return AnonymousUser()

from urllib.parse import parse_qs
from asgiref.sync import sync_to_async

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        query_string = self.scope['query_string'].decode()
        query_params = parse_qs(query_string)
        self.token = query_params.get('token', [None])[0]
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f"chat_{self.room_name}"

        try:
            token = await database_sync_to_async(Token.objects.get)(key=self.token)
            self.user = await sync_to_async(lambda: token.user)()

            if self.user.is_authenticated:
                # Join room group
                await self.channel_layer.group_add(
                    self.room_group_name,
                    self.channel_name
                )

                await self.accept()
            else:
                await self.close() # Close the connection if not authenticated
        except Token.DoesNotExist:
            await self.close()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json['message']

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message
            }
        )

    # Receive message from room group
    async def chat_message(self, event):
        message = self.user.username + ': ' + event['message']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message
        }))

    @database_sync_to_async
    def get_user_from_token(self):
        token = self.scope['url_route']['kwargs'].get('token')
        print(token)
        try:
            token = Token.objects.get(key=token)
            return token.user
        except Token.DoesNotExist:
            return AnonymousUser()