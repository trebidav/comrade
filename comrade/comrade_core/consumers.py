import json
import logging
import time as _time
from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone
from rest_framework.authtoken.models import Token

from .models import User, ChatMessage

logger = logging.getLogger(__name__)

# Shared group for public location broadcasts (all connected users join this)
PUBLIC_LOCATIONS_GROUP = 'public_locations'

# How often to refresh user profile from DB (seconds)
_PROFILE_REFRESH_INTERVAL = 60


class LocationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        query_string = self.scope['query_string'].decode()
        query_params = parse_qs(query_string)
        token_key = query_params.get('token', [None])[0]
        try:
            token = await database_sync_to_async(Token.objects.get)(key=token_key)
            self.user = await sync_to_async(lambda: token.user)()
            if not self.user.is_authenticated:
                await self.close()
                return

            # Per-user group for targeted messages (task updates, stats, achievements, etc.)
            self.location_group = f"location_{self.user.id}"
            await self.channel_layer.group_add(self.location_group, self.channel_name)

            # Shared group for public location broadcasts
            await self.channel_layer.group_add(PUBLIC_LOCATIONS_GROUP, self.channel_name)

            await self.accept()
            logger.info("WS connect: user %d (%s)", self.user.id, self.user.username)

            # Cache friends list and profile refresh timestamp
            self._friends_cache = await database_sync_to_async(lambda: list(self.user.get_friends()))()
            self._friends_ids = {f.id for f in self._friends_cache}
            self._profile_refreshed_at = _time.monotonic()

            # Notify friends that this user came online
            online_msg = {
                'type': 'friend_online',
                'userId': self.user.id,
                'name': f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username,
            }
            for friend in self._friends_cache:
                await self.channel_layer.group_send(f"location_{friend.id}", online_msg)

        except Token.DoesNotExist:
            logger.warning("WS connect: invalid token")
            await self.close()

    async def disconnect(self, close_code):
        if not hasattr(self, 'location_group'):
            return
        logger.info("WS disconnect: user %d (%s)", self.user.id, self.user.username)

        offline_message = {
            'type': 'user_offline',
            'userId': self.user.id,
        }

        # Notify friends
        friends = getattr(self, '_friends_cache', None)
        if friends is None:
            friends = await database_sync_to_async(lambda: list(self.user.get_friends()))()
        for friend in friends:
            await self.channel_layer.group_send(f"location_{friend.id}", offline_message)

        # Notify public users via shared group (single call instead of O(N))
        if self.user.location_sharing_level == User.SharingLevel.ALL:
            await self.channel_layer.group_send(PUBLIC_LOCATIONS_GROUP, offline_message)

        # Leave groups
        await self.channel_layer.group_discard(PUBLIC_LOCATIONS_GROUP, self.channel_name)
        await self.channel_layer.group_discard(self.location_group, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get('type')

        # Handle preference updates
        if 'preferences' in data:
            await self._handle_preferences(data['preferences'])
            return

        if msg_type == 'heartbeat':
            await self.send(text_data=json.dumps({'type': 'heartbeat_response'}))
            return

        if msg_type == 'chat_message':
            await self._handle_chat(data)
            return

        if msg_type == 'location_update':
            await self._handle_location(data)
            return

    # ── Message handlers ──

    async def _handle_chat(self, data):
        message = (data.get('message') or '').strip()
        if not message:
            return

        # Always use server-side username, never trust client
        sender = self.user.username

        msg = await database_sync_to_async(ChatMessage.objects.create)(
            sender=self.user, text=message,
        )

        chat_event = {
            'type': 'chat_message',
            'message': message,
            'sender': sender,
            'msgId': msg.id,
            'timestamp': msg.created_at.isoformat(),
        }

        for friend in self._friends_cache:
            await self.channel_layer.group_send(f"location_{friend.id}", chat_event)

    async def _handle_location(self, data):
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        if latitude is None or longitude is None:
            return
        accuracy = data.get('accuracy', 50)

        # Refresh profile periodically (not every ping)
        if _time.monotonic() - self._profile_refreshed_at > _PROFILE_REFRESH_INTERVAL:
            await database_sync_to_async(self.user.refresh_from_db)()
            self._profile_refreshed_at = _time.monotonic()

        # Save location
        await self._save_location(latitude, longitude)

        # Only share if not set to NONE
        if self.user.location_sharing_level == User.SharingLevel.NONE:
            return

        skills = await database_sync_to_async(
            lambda: list(self.user.skills.values_list('name', flat=True))
        )()

        # Send detailed update to friends (small set, per-user groups)
        friend_update = {
            'type': 'friend_location',
            'userId': self.user.id,
            'name': f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username,
            'latitude': latitude,
            'longitude': longitude,
            'accuracy': accuracy,
            'timestamp': timezone.now().isoformat(),
            'friends': [{'id': f.id, 'name': f"{f.first_name} {f.last_name}".strip() or f.username} for f in self._friends_cache],
            'skills': skills,
            'profilePicture': self.user.profile_picture or '',
        }
        for friend in self._friends_cache:
            await self.channel_layer.group_send(f"location_{friend.id}", friend_update)

        # Public broadcast via shared group (single call instead of O(N))
        if self.user.location_sharing_level == User.SharingLevel.ALL:
            public_update = {
                'type': 'public_location',
                'userId': self.user.id,
                'name': f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username,
                'latitude': latitude,
                'longitude': longitude,
                'accuracy': accuracy,
                'timestamp': timezone.now().isoformat(),
            }
            await self.channel_layer.group_send(PUBLIC_LOCATIONS_GROUP, public_update)

    async def _handle_preferences(self, preferences_data):
        sharing_level = preferences_data.get('sharing_level')
        if sharing_level in dict(User.SharingLevel.choices):
            self.user.location_sharing_level = sharing_level
            await database_sync_to_async(
                lambda: self.user.save(update_fields=['location_sharing_level'])
            )()

        await self.send(text_data=json.dumps({
            'type': 'preferences_updated',
            'status': 'success',
            'preferences': {'sharing_level': self.user.location_sharing_level},
        }))

    async def _save_location(self, latitude, longitude):
        self.user.latitude = latitude
        self.user.longitude = longitude
        self.user.timestamp = timezone.now()
        await database_sync_to_async(
            lambda: self.user.save(update_fields=['latitude', 'longitude', 'timestamp'])
        )()

    # ── Invalidate friends cache on friend events ──

    async def _refresh_friends_cache(self):
        self._friends_cache = await database_sync_to_async(lambda: list(self.user.get_friends()))()
        self._friends_ids = {f.id for f in self._friends_cache}

    # ── Channel event handlers (receive from group_send) ──

    async def friend_location(self, event):
        await self.send(text_data=json.dumps({
            'type': 'friend_location',
            'userId': event['userId'],
            'name': event['name'],
            'latitude': event['latitude'],
            'longitude': event['longitude'],
            'accuracy': event['accuracy'],
            'timestamp': event['timestamp'],
            'friends': event['friends'],
            'skills': event['skills'],
            'profilePicture': event.get('profilePicture', ''),
        }))

    async def public_location(self, event):
        # Don't echo own public location back
        if event.get('userId') == self.user.id:
            return
        await self.send(text_data=json.dumps({
            'type': 'public_location',
            'userId': event['userId'],
            'name': event['name'],
            'latitude': event['latitude'],
            'longitude': event['longitude'],
            'accuracy': event['accuracy'],
            'timestamp': event['timestamp'],
        }))

    async def user_offline(self, event):
        # Don't echo own offline event
        if event.get('userId') == self.user.id:
            return
        await self.send(text_data=json.dumps({
            'type': 'user_offline',
            'userId': event['userId'],
        }))

    async def friend_details(self, event):
        await self.send(text_data=json.dumps({
            'type': 'friend_details',
            'userId': event['userId'],
            'name': event['name'],
            'friends': event['friends'],
            'skills': event['skills'],
        }))

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender': event['sender'],
            'msgId': event.get('msgId'),
            'timestamp': event.get('timestamp'),
        }))

    # ── Real-time event handlers (forwarded from ws_events.py) ──

    async def task_update(self, event):
        await self.send(text_data=json.dumps(event))

    async def user_stats_update(self, event):
        # Refresh profile cache since stats/skills may have changed
        await database_sync_to_async(self.user.refresh_from_db)()
        self._profile_refreshed_at = _time.monotonic()
        await self.send(text_data=json.dumps(event))

    async def achievement_earned(self, event):
        await self.send(text_data=json.dumps(event))

    async def friend_request_received(self, event):
        await self.send(text_data=json.dumps(event))

    async def friend_request_accepted(self, event):
        await self._refresh_friends_cache()
        await self.send(text_data=json.dumps(event))

    async def friend_request_rejected(self, event):
        await self.send(text_data=json.dumps(event))

    async def friend_removed(self, event):
        await self._refresh_friends_cache()
        await self.send(text_data=json.dumps(event))

    async def friend_online(self, event):
        await self.send(text_data=json.dumps(event))

    async def tutorial_review_accepted(self, event):
        await self.send(text_data=json.dumps(event))

    async def tutorial_review_declined(self, event):
        await self.send(text_data=json.dumps(event))
