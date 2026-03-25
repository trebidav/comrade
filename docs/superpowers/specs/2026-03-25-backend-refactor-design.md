# Backend Refactor — Design Spec

**Date:** 2026-03-25
**Scope:** Django backend (`comrade_core`) — incremental refactor
**Constraint:** No breaking changes to the frontend API contract. Changes that require frontend coordination are documented separately in `docs/future-sync-refactor.md`.

---

## Audit Summary

30 issues identified across security, bugs, performance, architecture, and code quality. See categorized list below.

---

## Phases

### Phase 1: Dead Code & Bug Fixes

**1a. Remove dead code:**

| Item | Location | Action |
|------|----------|--------|
| `comrade_tutorial/` app | `comrade/comrade/comrade_tutorial/` | Delete entire directory |
| Old `settings.py` | `comrade/comrade/settings.py` | Delete (has hardcoded OAuth credentials) |
| Old `asgi.py` | `comrade/comrade/asgi.py` | Delete (duplicates `comrade/comrade/comrade/asgi.py`) |
| `Task.review()` method | `models.py:480-497` | Delete (references nonexistent `done=1` field, never called) |
| Shadowed `TaskSerializer` | `serializers.py:19-22` | Delete (overwritten at line 42) |
| `UserSerializer` / `GroupSerializer` | `serializers.py:7-16` | Delete (unused) |
| Duplicate `User = get_user_model()` | `views.py:32` | Remove (already imported from models at line 23) |

**1b. Fix bugs:**

| Bug | Location | Fix |
|-----|----------|-----|
| Imports at bottom of file | `consumers.py:329-330` | Move `parse_qs`, `sync_to_async` to top with other imports |
| `disconnect()` crash if `self.user` not set | `consumers.py:41-77` | Guard with `hasattr(self, 'user')` check |
| `print()` used for logging | `views.py:272`, `consumers.py:141,168,197` | Replace with `logger.info()` / `logger.debug()` |
| `TaskListView` visibility query ambiguous | `views.py:260-268` | Rewrite with explicit, correct Q-object logic |

### Phase 2: Performance Fixes

| Issue | Location | Fix |
|-------|----------|-----|
| N+1 queries in `TaskListView` | `views.py:260-274` | Add `prefetch_related('skill_execute', 'skill_read', 'skill_write', 'reviews', 'assignee')` and `select_related('owner', 'assignee')` |
| N+1 in `AchievementsView` | `views.py:726-767` | Batch compute progress where possible; prefetch `user_achievements` |
| N+1 in `TutorialTaskFlatSerializer` | `serializers.py:159-165` | Prefetch `skill_execute` on tutorial tasks queryset |
| No caching on `LocationConfig.get_config()` | `models.py:67-71` | Add simple TTL cache (e.g., 60s) using module-level variable |
| `check_and_respawn()` + `check_and_reset_stale()` on every GET | `views.py:254-255` | Keep in request path for now (no cron infra), but optimize: batch update for respawn (already OK), convert stale-check loop to single annotated query |
| `save_user_location` saves full model | `consumers.py:270-274` | Use `update_fields=['latitude', 'longitude', 'timestamp']` |
| Race conditions in task state transitions | `models.py:404-428` etc. | Add `select_for_update()` in views before calling state-transition methods |
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
| Haversine formula | `User.distance_to()` + standalone `haversine_km()` | Single `utils.haversine_km()`, `User.distance_to()` calls it |
| Level calculation | `User.level` and `User.level_progress` repeat while-loop | Extract `_compute_level(total_xp, modifier)` helper, both properties call it |

**Consistency fixes:**

| What | Fix |
|------|-----|
| Task state methods return `False` vs raise `ValidationError` | All invalid-state cases raise `ValidationError` consistently |
| View error handling patterns | Standardize: try/get/except `DoesNotExist` → 404, `ValidationError` → 400/412 |
| Unused `task = None` assignments | Remove from TaskStartView, TaskPauseView, TaskResumeView |

### Phase 4: Tests

**Model tests:**
- Task lifecycle: start, pause, resume, finish, abandon (happy path + error cases)
- Task state machine: invalid transitions raise errors
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
- Connect with valid/invalid token
- Location broadcast respects sharing level
- Chat message delivery to friends
- Disconnect cleanup

---

## Non-Breaking Change Constraint

All changes in Phases 1-4 are internal refactors. The following are explicitly preserved:

- All URL paths and parameter names (`taskId`, `partId`, `user_id`)
- All response shapes (field names, nesting)
- All WebSocket event types and field names
- All HTTP status codes for existing error cases

---

## Future Synchronized Refactor (Backend + Frontend)

Documented separately in `docs/future-sync-refactor.md`. These changes require coordinated frontend updates:

1. **URL parameter naming**: `taskId` → `task_id`, `partId` → `part_id`
2. **Explicit serializer fields**: Replace `fields = "__all__"` with explicit list
3. **Pagination**: Add to `GET /tasks/`, `GET /achievements/`, `GET /chat/history/`
4. **Error response format**: Standardize to `{"error": {"code": "...", "message": "..."}}`
5. **WebSocket event naming**: Standardize `camelCase` vs `snake_case` field names
6. **Task create endpoint**: Add proper input validation with structured error responses
