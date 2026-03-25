# WebSocket Architecture Fixes — Design Spec

**Date:** 2026-03-25
**Scope:** Fix performance and correctness issues in `comrade_core/consumers.py` and `comrade_core/ws_events.py`
**Priority order:** Critical → High → Medium → Low

---

## Fix 1: Replace O(N) public broadcast with shared group (Critical)

**Problem:** Every location ping from a user with `sharing_level=ALL` queries all users from DB and sends N individual `group_send` calls. With 100 active users this is O(N^2) messages per tick.

**Design:**

Add a `"public_locations"` channel group. All connected users join it on connect, leave on disconnect.

```
connect():
  join location_{user_id}     (existing — for targeted messages)
  join public_locations        (NEW — for broadcast)

location_update (sharing_level=ALL):
  group_send(public_locations, public_location_event)   # 1 call instead of N

disconnect():
  leave public_locations
  group_send(public_locations, user_offline)             # 1 call instead of N
```

The `public_location` handler already exists — it filters `userId === self` on the frontend. No frontend changes needed.

For friend locations: keep the per-user `group_send` loop (friends are a small set). Only the public broadcast changes.

**Files:** `consumers.py` — `connect()`, `disconnect()`, `receive()` (location_update section)

---

## Fix 2: Cache friends list on consumer instance (High)

**Problem:** `self.user.get_friends()` queries DB on every location ping (~every 5s). Friends change rarely.

**Design:**

```python
class LocationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        ...
        self._friends_cache = await database_sync_to_async(lambda: list(self.user.get_friends()))()
        self._friends_ids = {f.id for f in self._friends_cache}

    async def receive(self, text_data):
        # Use self._friends_cache instead of querying DB
        ...

    # Invalidate cache when friend events arrive
    async def friend_request_accepted(self, event):
        self._friends_cache = await database_sync_to_async(lambda: list(self.user.get_friends()))()
        self._friends_ids = {f.id for f in self._friends_cache}
        await self.send(text_data=json.dumps(event))

    async def friend_removed(self, event):
        self._friends_cache = await database_sync_to_async(lambda: list(self.user.get_friends()))()
        self._friends_ids = {f.id for f in self._friends_cache}
        await self.send(text_data=json.dumps(event))
```

Cache is populated on connect, invalidated when friend_request_accepted or friend_removed events arrive via the channel group. Chat message delivery and location broadcast both use the cache.

**Files:** `consumers.py` — `connect()`, `receive()`, `friend_request_accepted()`, `friend_removed()`

---

## Fix 3: Cache user profile data, refresh periodically (Medium)

**Problem:** `self.user.refresh_from_db()` runs on every location ping just to get `profile_picture`.

**Design:**

Cache profile fields on connect. Refresh only:
- Every 60 seconds (via a timestamp check)
- When a `user_stats_update` event arrives (skills/XP changed)

```python
async def connect(self):
    ...
    self._profile_refreshed_at = time.monotonic()

async def receive(self, text_data):
    # In location_update handler:
    if time.monotonic() - self._profile_refreshed_at > 60:
        await database_sync_to_async(self.user.refresh_from_db)()
        self._profile_refreshed_at = time.monotonic()
    ...

async def user_stats_update(self, event):
    await database_sync_to_async(self.user.refresh_from_db)()
    self._profile_refreshed_at = time.monotonic()
    await self.send(text_data=json.dumps(event))
```

**Files:** `consumers.py` — `connect()`, `receive()`, `user_stats_update()`

---

## Fix 4: Validate WebSocket input and fix trusted sender (Medium)

**Problem:** No validation on incoming messages. Missing fields cause `KeyError` crashes. Chat `sender` field is trusted from client.

**Design:**

```python
async def receive(self, text_data):
    try:
        data = json.loads(text_data)
    except json.JSONDecodeError:
        return  # ignore malformed

    msg_type = data.get('type')

    if msg_type == 'location_update':
        lat = data.get('latitude')
        lon = data.get('longitude')
        if lat is None or lon is None:
            return  # ignore incomplete
        accuracy = data.get('accuracy', 50)
        ...

    elif msg_type == 'chat_message':
        message = data.get('message', '').strip()
        if not message:
            return  # ignore empty
        sender = self.user.username  # NEVER trust client-provided sender
        ...
```

**Files:** `consumers.py` — `receive()`

---

## Fix 5: Remove dead ChatConsumer (Low)

**Problem:** `ChatConsumer` (lines 319-373) is unused. Chat goes through `LocationConsumer`. The WebSocket route `ws/chat/<room_name>/` exists but no frontend connects to it.

**Design:** Delete `ChatConsumer` class and remove `ws/chat/` route from `urls.py`.

**Files:** `consumers.py`, `urls.py`

---

## Fix 6: update_preferences use update_fields (Low)

**Problem:** `self.user.save()` without `update_fields` on preferences update.

**Design:** Change to `self.user.save(update_fields=['location_sharing_level'])`.

**Files:** `consumers.py` — `update_preferences()`

---

## Fix 7: Multi-tab dedup (Low, future)

**Problem:** Multiple tabs = multiple connections = duplicate messages.

**Design (future):** Track connection count per user in Redis. On connect, if count > 1, send a `duplicate_session` warning to the older connection. Frontend can show "open in another tab" notice. Not blocking for MVP.

---

## Implementation Order

1. Fix 4 (input validation + sender fix) — security, trivial
2. Fix 5 (remove dead ChatConsumer) — cleanup, trivial
3. Fix 6 (update_fields) — trivial
4. Fix 2 (cache friends) — high impact, low effort
5. Fix 3 (cache profile) — medium impact, low effort
6. Fix 1 (public broadcast group) — highest impact, medium effort
7. Fix 7 (multi-tab) — defer until needed

**Estimated total effort:** ~2 hours for fixes 1-6.
