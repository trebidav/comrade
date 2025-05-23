import json
from datetime import timedelta
from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token
from .models import User
import logging

logger = logging.getLogger(__name__)

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
                logger.info(f"User {self.user.username} connected to WebSocket, group: {self.location_group}")
                await self.accept()
            else:
                logger.error(f"User not authenticated, closing connection")
                await self.close()
        except Token.DoesNotExist:
            logger.error(f"Invalid token, closing connection")
            await self.close()

    async def receive(self, text_data):
        data = json.loads(text_data)
        logger.info(f"Received message from user {self.user.username}: {data}")
        
        # Handle chat messages
        if data.get('type') == 'chat_message':
            message = data.get('message')
            sender = data.get('sender')
            
            # Get user's friends
            friends = await database_sync_to_async(lambda: list(self.user.get_friends()))()
            logger.info(f"Sending message to friends of {self.user.username}: {[f.username for f in friends]}")
            
            # Create the message event
            chat_message = {
                'type': 'chat_message',
                'message': message,
                'sender': sender
            }
            
            # Send message to all friends
            for friend in friends:
                friend_location_group = f"location_{friend.id}"
                logger.info(f"Sending message to friend's group: {friend_location_group}")
                await self.channel_layer.group_send(
                    friend_location_group,
                    chat_message
                )
            
            # Also send the message back to the sender's group
            logger.info(f"Sending message back to sender's group: {self.location_group}")
            await self.channel_layer.group_send(
                self.location_group,
                chat_message
            )
            return

    async def chat_message(self, event):
        """Handler for chat messages"""
        logger.info(f"Chat message handler called for user {self.user.username} with event: {event}")
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender': event['sender']
        })) 