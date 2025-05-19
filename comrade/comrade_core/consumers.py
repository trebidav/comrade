import json
from datetime import timedelta
from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token
from .models import User

class LocationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        query_string = self.scope['query_string'].decode()
        query_params = parse_qs(query_string)
        self.token = query_params.get('token', [None])[0]
        try:
            token = await database_sync_to_async(Token.objects.get)(key=self.token)
            self.user = await sync_to_async(lambda: token.user)()
            if self.user.is_authenticated:
                # Create a unique group for this user's location updates
                self.location_group = f"location_{self.user.id}"
                await self.channel_layer.group_add(
                    self.location_group,
                    self.channel_name
                )
                await self.accept()
            else:
                await self.close()
        except Token.DoesNotExist:
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, 'location_group'):
            await self.channel_layer.group_discard(
                self.location_group,
                self.channel_name
            )

    async def receive(self, text_data):
        data = json.loads(text_data)
        
        # Handle preference updates
        if 'preferences' in data:
            await self.update_preferences(data['preferences'])
            return

        # Handle location updates
        if data.get('type') == 'location_update':
            latitude = data['latitude']
            longitude = data['longitude']
            accuracy = data.get('accuracy', 50)  # Default accuracy if not provided

            # Check sharing preferences before broadcasting
            if self.user.location_sharing_level == User.SharingLevel.NONE:
                # Only save location, don't broadcast
                await self.save_user_location(self.user, latitude, longitude)
                return

            # Prepare the location update message
            location_update = {
                'type': 'friend_location' if self.user.location_sharing_level == User.SharingLevel.FRIENDS else 'public_location',
                'userId': self.user.id,
                'name': f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username,
                'latitude': latitude,
                'longitude': longitude,
                'accuracy': accuracy,
                'timestamp': timezone.now().isoformat()
            }

            # Handle different sharing levels
            if self.user.location_sharing_level == User.SharingLevel.FRIENDS:
                # Get list of friends to share with
                friends = await database_sync_to_async(
                    lambda: list(self.user.get_friends())
                )()
                
                # Send to each friend's location group
                for friend in friends:
                    friend_location_group = f"location_{friend.id}"
                    await self.channel_layer.group_send(
                        friend_location_group,
                        location_update
                    )
            else:  # ALL
                # Get nearby users who share their location
                nearby_users = await database_sync_to_async(
                    self.user.get_nearby_users
                )()
                
                # Send to each nearby user's location group
                for user in nearby_users:
                    user_location_group = f"location_{user.id}"
                    await self.channel_layer.group_send(
                        user_location_group,
                        location_update
                    )
            
            # Save location regardless of sharing preferences
            await self.save_user_location(self.user, latitude, longitude)
            print(f"[{timezone.now()}] Location saved for {self.user.username} at {latitude}, {longitude}")

    async def update_preferences(self, preferences_data):
        """Update user's location sharing preferences"""
        sharing_level = preferences_data.get('sharing_level')
        if sharing_level in dict(User.SharingLevel.choices):
            self.user.location_sharing_level = sharing_level
            await database_sync_to_async(self.user.save)()
        
        # Send confirmation back to user
        await self.send(text_data=json.dumps({
            'type': 'preferences_updated',
            'status': 'success',
            'preferences': {
                'sharing_level': self.user.location_sharing_level
            }
        }))

    async def friend_location(self, event):
        """Handler for friend location updates"""
        await self.send(text_data=json.dumps({
            'type': 'friend_location',
            'userId': event['userId'],
            'name': event['name'],
            'latitude': event['latitude'],
            'longitude': event['longitude'],
            'accuracy': event['accuracy'],
            'timestamp': event['timestamp']
        }))

    async def public_location(self, event):
        """Handler for public location updates"""
        await self.send(text_data=json.dumps({
            'type': 'public_location',
            'userId': event['userId'],
            'name': event['name'],
            'latitude': event['latitude'],
            'longitude': event['longitude'],
            'accuracy': event['accuracy'],
            'timestamp': event['timestamp']
        }))

    async def location_update(self, event):
        # Send location update with user identification
        await self.send(text_data=json.dumps({
            'type': event['type'],
            'userId': event['userId'],
            'name': event['name'],
            'latitude': event['latitude'],
            'longitude': event['longitude'],
            'timestamp': event['timestamp']
        }))

    async def save_user_location(self, user, latitude, longitude):
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