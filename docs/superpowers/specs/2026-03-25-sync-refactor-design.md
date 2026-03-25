# Synchronized Backend + Frontend Refactor — Design Spec

**Date:** 2026-03-25
**Scope:** 4 coordinated changes across Django backend and React frontend
**Constraint:** Each item ships as a single commit touching both backend and frontend. Tests must pass after each.

---

## Item 1: Explicit Serializer Fields + Cleanup

**Goal:** Replace `TaskSerializer.Meta.fields = "__all__"` with an explicit field list, then drop unused fields.

**Backend (`comrade_core/serializers.py`):**

Replace `fields = "__all__"` with:
```python
fields = [
    'id', 'name', 'description', 'lat', 'lon',
    'state', 'criticality', 'minutes', 'coins', 'xp',
    'owner', 'assignee', 'photo',
    'require_photo', 'require_comment',
    'datetime_start', 'datetime_finish', 'datetime_paused',
    'respawn', 'respawn_time', 'respawn_offset', 'datetime_respawn',
    'time_spent_minutes',
    # SerializerMethodFields
    'skill_execute_names', 'skill_read_names', 'skill_write_names',
    'assignee_name', 'pending_review', 'is_tutorial',
]
```

**Dropped fields** (raw M2M ID lists not used by frontend): `skill_read`, `skill_write`, `skill_execute`.

**Maintenance note:** With explicit fields, new model fields will NOT appear in API responses unless added to this list. Add a code comment in the serializer reminding developers.

**Frontend (`client/src/api.ts`):**

Audit the `Task` TypeScript interface. Remove `skill_read`, `skill_write`, `skill_execute` if they exist as raw ID array fields. The `_names` variants are already the ones used everywhere.

---

## Item 2: WebSocket Event Field Naming (standardize to camelCase)

**Goal:** Make all WebSocket event fields consistently camelCase since the consumer is JavaScript.

**Backend files and where each event is constructed:**

| Event | Constructed in |
|-------|---------------|
| `task_update` | `comrade_core/ws_events.py` |
| `user_stats_update` | `comrade_core/ws_events.py` |
| `achievement_earned` | `comrade_core/ws_events.py` |
| `friend_location` | `comrade_core/consumers.py` (LocationConsumer.receive) |
| `public_location` | `comrade_core/consumers.py` (LocationConsumer.receive) |
| `chat_message` | `comrade_core/consumers.py` (LocationConsumer.receive) |
| `friend_online` | `comrade_core/consumers.py` (LocationConsumer.connect) |
| `user_offline` | `comrade_core/consumers.py` (LocationConsumer.disconnect) |
| `friend_details` | `comrade_core/views/friends.py` (accept_friend_request) |
| `friend_request_received` | `comrade_core/views/friends.py` |
| `friend_request_accepted` | `comrade_core/views/friends.py` |
| `friend_request_rejected` | `comrade_core/views/friends.py` |
| `friend_removed` | `comrade_core/views/friends.py` |

**Fields to rename:**

| Event | snake_case → camelCase |
|-------|----------------------|
| `task_update` | `task_id` → `taskId`, `assignee_name` → `assigneeName`, `datetime_start` → `datetimeStart`, `datetime_finish` → `datetimeFinish`, `datetime_paused` → `datetimePaused` |
| `user_stats_update` | `total_coins_earned` → `totalCoinsEarned`, `total_xp_earned` → `totalXpEarned`, `task_streak` → `taskStreak`, `level_progress` → `levelProgress` |
| `chat_message` | `msg_id` → `msgId` |
| `friend_location` | `profile_picture` → `profilePicture` |
| `friend_request_received` | `from_user` → `fromUser` |
| `friend_request_rejected` | `user_id` → `userId` |
| `friend_removed` | `user_id` → `userId` |
| `public_location` | No changes needed (all fields already camelCase). Note: `profilePicture` is not sent in this event — this is a pre-existing gap, not in scope. |

**Already camelCase (no change):** `userId`, `name`, `latitude`, `longitude`, `accuracy`, `timestamp`, `friends`, `skills`, `message`, `sender`, `coins`, `xp`, `level`.

**Frontend (`client/src/hooks/useLocationSocket.ts`):**

Update:
1. `TaskUpdateEvent` interface: rename fields to camelCase (`taskId`, `assigneeName`, `datetimeStart`, `datetimeFinish`, `datetimePaused`)
2. `UserStatsEvent` interface: rename fields to camelCase (`totalCoinsEarned`, `totalXpEarned`, `taskStreak`, `levelProgress`)
3. All field access in switch cases and event handlers that reference the renamed fields
4. Audit all components consuming `taskUpdates` / `userStats` from the hook for field name changes

---

## Item 3: Task Create Validation

**Goal:** Replace manual field extraction in `TaskCreateView` with a proper `TaskCreateSerializer` with field-level validation.

**Backend (`comrade_core/serializers.py`):**

Create `TaskCreateSerializer`:
- `name`: required, non-blank, max 64 chars
- `description`: optional, max 200 chars
- `lat`, `lon`: optional floats, lat -90..90, lon -180..180
- `coins`, `xp`: optional floats, 0..1, `allow_null=True` (frontend omits when empty)
- `minutes`: integer, 1..480, default 10
- `criticality`: integer, 1..3, default 1
- `respawn`: boolean, default False
- `respawn_time`: optional, format HH:MM
- `respawn_offset`: optional positive integer
- `require_photo`, `require_comment`: boolean, default False
- `skill_read`, `skill_write`, `skill_execute`: `PrimaryKeyRelatedField(many=True, queryset=Skill.objects.all(), required=False)` — handles multipart repeated keys natively
- `photo`: optional file

**Backend (`comrade_core/views/task.py`):**

Update `TaskCreateView` to use the serializer. On validation failure, return:
```json
{"error": "Validation failed", "fields": {"name": ["This field is required."]}}
```

**Frontend (`client/src/components/CreateTaskModal.tsx` + Desktop variant):**

Update error handling to check for `response.data.fields` and display per-field errors. Fall back to `response.data.error` string for non-validation errors.

---

## Item 4: Consistent Error/Success Responses

**Goal:** Standardize success response key from mixed `status`/`message` to always `message`.

**Backend changes (`comrade_core/views/friends.py`, `comrade_core/views/chat.py`):**

| Endpoint | Current | Fixed |
|----------|---------|-------|
| `send_friend_request` | `{"status": "..."}` | `{"message": "..."}` |
| `accept_friend_request` | `{"status": "...", "new_achievements": [...]}` | `{"message": "...", "new_achievements": [...]}` |
| `reject_friend_request` | `{"status": "..."}` | `{"message": "..."}` |
| `remove_friend` | `{"status": "..."}` | `{"message": "..."}` |
| `welcome_accept` | `{"status": "ok"}` | `{"message": "ok"}` |

**Frontend:** No changes needed — the frontend does not read the success `status`/`message` field from these responses. It only checks the HTTP status code.

---

## Implementation Order

1. Item 1 (Explicit fields) — lowest risk, no behavior change
2. Item 4 (Consistent responses) — backend-only, trivial
3. Item 2 (WebSocket naming) — coordinated, small scope
4. Item 3 (Task create validation) — most complex, new serializer + frontend error display
