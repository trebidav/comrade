# Backend Refactor — Design Spec

**Date:** 2026-03-25
**Scope:** Django backend (`comrade_core`) — incremental refactor
**Constraint:** No breaking changes to the frontend API contract. Changes that require frontend coordination are documented separately in `docs/future-sync-refactor.md`.

---

## Audit Summary

30+ issues identified across security, bugs, performance, architecture, and code quality. See categorized list below.

---

## Phases

### Phase 1: Dead Code & Bug Fixes

**1a. Remove dead code:**

| Item | Location | Action |
|------|----------|--------|
| `comrade_tutorial/` app | `comrade/comrade/comrade_tutorial/` | Delete entire directory (not in INSTALLED_APPS, verify no migration dependencies) |
| Old `settings.py` | `comrade/comrade/settings.py` | Delete (has hardcoded OAuth credentials) |
| Old `asgi.py` | `comrade/comrade/asgi.py` | Delete (duplicates `comrade/comrade/comrade/asgi.py`) |
| Stale `consumers.py` copy | `comrade/comrade/comrade_core/consumers.py` | Delete (80-line old version; active file is at `comrade/comrade/comrade/comrade_core/consumers.py`) |
| `Task.review()` method | `models.py:480-497` | Delete (references nonexistent `done=1` field, never called) |
| Shadowed `TaskSerializer` | `serializers.py:19-22` | Delete (overwritten at line 42) |
| `UserSerializer` / `GroupSerializer` | `serializers.py:7-16` | Delete (unused) |
| Duplicate `User = get_user_model()` | `views.py:32` | Remove (already imported from models at line 23) |
| `User.get_nearby_users()` | `models.py:286-297` | Delete (iterates all users in Python, never called from any view) |
| `LocationConsumer.group_exists()` | `consumers.py:276-282` | Delete (calls non-existent `group_channels()` API, always returns `False`, never called) |
| `LocationConsumer.get_user_from_token()` | `consumers.py:284-291` | Delete (never called, token auth done inline in `connect()`) |
| `ChatConsumer.get_user_from_token()` | `consumers.py:387-395` | Delete (same — never called) |

**1b. Fix bugs:**

| Bug | Location | Fix |
|-----|----------|-----|
| Imports at bottom of file | `consumers.py:329-330` | Move `parse_qs`, `sync_to_async` to top with other imports |
| `ChatConsumer.disconnect()` crash if `self.room_group_name` not set | `consumers.py:357-362` | Guard with `hasattr(self, 'room_group_name')` check |
| `print()` used for logging | `views.py:272`, `consumers.py:141,168,197,390` | Replace with `logger.info()` / `logger.debug()`. Add `import logging` + `logger = logging.getLogger(__name__)` to both `views.py` and `consumers.py`. |
| `TaskListView` visibility query ambiguous | `views.py:260-268` | Rewrite with explicit Q-object logic (see Visibility Rules below) |
| `corsheaders` missing from INSTALLED_APPS | `settings.py` | Add `'corsheaders'` to INSTALLED_APPS |

**TaskListView Visibility Rules (intended behavior):**
A task is visible to a user if ANY of these are true:
1. User is the task owner
2. User is the task assignee
3. Task is IN_REVIEW and user has at least one of the task's write skills
4. Task has NO read skills (visible to everyone)
5. Task has read skills AND user has at least one matching read skill

Correct Q-expression:
```python
tasks = Task.objects.filter(
    models.Q(owner=user)
    | models.Q(assignee=user)
    | models.Q(state=Task.State.IN_REVIEW, skill_write__in=user.skills.all())
    | models.Q(skill_read__isnull=True)  # no read skills = visible to all
    | models.Q(skill_read__in=user.skills.all())
).distinct()
```
Note: For M2M fields, `skill_read__isnull=True` correctly checks "no related skills exist" (LEFT OUTER JOIN produces NULL).

### Phase 2: Performance Fixes

| Issue | Location | Fix |
|-------|----------|-----|
| N+1 queries in `TaskListView` | `views.py:260-274` | Add `select_related('owner', 'assignee')` and `prefetch_related('skill_execute', 'skill_read', 'skill_write', 'reviews')` |
| N+1 in `AchievementsView` | `views.py:726-767` | Batch compute progress where possible; prefetch `user_achievements` |
| N+1 in `TutorialTaskFlatSerializer` | `serializers.py:159-165` | Prefetch `skill_execute` on tutorial tasks queryset |
| No caching on `LocationConfig.get_config()` | `models.py:67-71` | Add simple TTL cache (e.g., 60s) using module-level variable |
| `check_and_respawn()` + `check_and_reset_stale()` on every GET | `views.py:254-255` | Keep in request path for now (no cron infra), but optimize: batch update for respawn (already OK), convert stale-check loop to single annotated query |
| `save_user_location` saves full model | `consumers.py:270-274` | Use `update_fields=['latitude', 'longitude', 'timestamp']` |
| Race conditions in task state transitions | views: TaskStartView, TaskFinishView, TaskPauseView, TaskResumeView, TaskAbandonView, TaskAcceptReviewView, TaskDeclineReviewView | Wrap task fetch + state transition in `transaction.atomic()` with `select_for_update()`: `task = Task.objects.select_for_update().get(pk=taskId)` |
| Broadcast to ALL users on location update | `consumers.py:184-197` | Document as future optimization (requires presence tracking); no change now |

### Phase 3: Structural Cleanup

**Split `models.py` (877 lines) into package:**

```
comrade_core/
  models/
    __init__.py          # re-exports all models
    config.py            # LocationConfig
    user.py              # User
    task.py              # Task, Rating, Review
    achievement.py       # Achievement, UserAchievement
    tutorial.py          # TutorialTask, TutorialPart, TutorialQuestion, TutorialAnswer, TutorialProgress
    chat.py              # ChatMessage
  utils.py               # haversine_km(), _compute_level()
```

**Split `views.py` (930+ lines) into package:**

```
comrade_core/
  views/
    __init__.py          # re-exports all views for urls.py compatibility
    user.py              # UserDetailView, LocationSharingPreferencesView, get_user_info
    task.py              # TaskStartView, TaskFinishView, TaskPauseView, TaskResumeView, TaskAbandonView, TaskListView, TaskCreateView, TaskDebugResetView, TaskAcceptReviewView, TaskDeclineReviewView, TaskRateView
    tutorial.py          # TutorialDetailView, TutorialSubmitPartView, TutorialTaskStartView, TutorialTaskAbandonView
    friends.py           # send_friend_request, accept_friend_request, reject_friend_request, remove_friend, get_friends, get_pending_requests, get_sent_requests
    config.py            # ProximitySettingsView, GlobalConfigView, AchievementsView, SkillListView
    auth.py              # google_oauth_callback, google_config, token_login_view, login_page
    chat.py              # chat_history, welcome_message, welcome_accept
```

**Deduplication:**

| What | Current | Fix |
|------|---------|-----|
| Haversine formula | `User.distance_to()` + standalone `haversine_km()` | Single `comrade_core/utils.py:haversine_km()`. `User.distance_to()` calls it. Remove standalone function from models. |
| Level calculation | `User.level` and `User.level_progress` repeat while-loop | Extract `comrade_core/utils.py:compute_level(total_xp, modifier) -> (level, current_xp, required_xp)`. Both properties call it. |

**Consistency fixes:**

| What | Fix | Note |
|------|-----|------|
| Task state methods return `False` vs raise `ValidationError` | All invalid-state cases raise `ValidationError` consistently | **Visible behavior change:** `pause()`, `resume()`, `finish()` currently return `False` silently for some invalid states → views return HTTP 200 doing nothing. After fix → HTTP 412. Frontend already handles 412 on these endpoints. |
| View error handling patterns | Standardize: try/get/except `DoesNotExist` → 404, `ValidationError` → 400/412 | |
| Unused `task = None` assignments | Remove from TaskStartView, TaskPauseView, TaskResumeView | |
| URL param internal names | Rename Django capture groups `taskId` → `task_id`, `partId` → `part_id` in urls.py and view signatures | Backend-only change — does not affect URL paths the frontend calls |

### Phase 4: Tests

Write a **minimal TaskListView visibility smoke test before Phase 2** (test-first for highest-risk change).

**Model tests:**
- Task lifecycle: start, pause, resume, finish, abandon (happy path + error cases)
- Task state machine: invalid transitions raise `ValidationError`
- Reward calculation: coins, XP, criticality factor, time multiplier
- Achievement: compute_progress for all 11 condition types, check_and_award_achievements
- Tutorial: start, submit parts (quiz/password/file_upload), completion, skill reward
- Friends: send/accept/reject/remove, edge cases (self-request, duplicate)
- User: level calculation, distance_to

**View tests (DRF APITestCase):**
- All task endpoints: auth required, correct status codes, state transitions
- Tutorial endpoints: auth, proximity, skill checks
- Friend endpoints: auth, all CRUD operations
- Config endpoints: superuser-only access
- Google OAuth callback: happy path, error cases

**WebSocket tests:**
- `LocationConsumer`: connect with valid/invalid token, disconnect cleanup
- `LocationConsumer`: location broadcast respects sharing level
- `LocationConsumer`: chat message delivery to friends
- `ChatConsumer`: connect, send message to room, disconnect cleanup

---

## Non-Breaking Change Constraint

All changes in Phases 1-4 are internal refactors. The following are explicitly preserved:

- All URL paths and parameter names (`taskId`, `partId`, `user_id`)
- All response shapes (field names, nesting)
- All WebSocket event types and field names
- All HTTP status codes for existing error cases

**One known visible change (Phase 3):** Task state methods (`pause`, `resume`, `finish`) that currently fail silently (return `False` → HTTP 200) will instead raise `ValidationError` (→ HTTP 412). This is a correctness fix — the frontend already handles 412 on these endpoints.

---

## Future Synchronized Refactor (Backend + Frontend)

Documented separately in `docs/future-sync-refactor.md`. These changes require coordinated frontend updates:

1. **Explicit serializer fields**: Replace `fields = "__all__"` with explicit list
2. **Pagination**: Add to `GET /tasks/`, `GET /achievements/`, `GET /chat/history/`
3. **Error response format**: Standardize to `{"error": {"code": "...", "message": "..."}}`
4. **WebSocket event naming**: Standardize `camelCase` vs `snake_case` field names
5. **Task create endpoint**: Add proper input validation with structured error responses
