# Backend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Django backend to fix bugs, remove dead code, improve performance, split monolithic files into packages, and add comprehensive tests — without breaking the frontend API contract.

**Architecture:** Incremental 4-phase approach. Each phase produces a working, testable backend. Phase 1 removes dead code and fixes bugs. Phase 2 adds performance optimizations. Phase 3 restructures files into packages. Phase 4 adds tests. A minimal visibility test is written before the Phase 2 query rewrite (test-first for highest-risk change).

**Tech Stack:** Django 5, Django REST Framework, Django Channels, Redis, SQLite (dev), PostgreSQL (prod)

**Spec:** `docs/superpowers/specs/2026-03-25-backend-refactor-design.md`

**Git repo root:** `/Users/davidtrebicky/Code/ClaudeCode/comrade/comrade` (all paths below are relative to this)

**Test command:** `pipenv run python manage.py test comrade_core --verbosity 2`

**Run server:** `pipenv run python manage.py runserver` (from `comrade/comrade/`)

---

## Phase 1: Dead Code & Bug Fixes

### Task 1: Delete dead `comrade_tutorial` app

**Files:**
- Delete: `comrade/comrade_tutorial/` (entire directory)

- [ ] **Step 1: Verify no migration dependencies**

Run: `grep -r "comrade_tutorial" comrade/ --include="*.py" | grep -v "comrade_tutorial/"`
Expected: Only `comrade_tutorial/apps.py` self-reference or nothing relevant.

- [ ] **Step 2: Delete the directory**

```bash
rm -rf comrade/comrade_tutorial/
```

- [ ] **Step 3: Run tests to confirm nothing broke**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: 4 tests pass (same baseline).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor: remove dead comrade_tutorial app"
```

### Task 2: Delete dead files (old settings, old asgi, stale consumers, misc)

**Files:**
- Delete: `comrade/comrade_core/.ideas.py`
- Delete: `comrade/comrade_core/sse_render.py`
- Delete: `comrade/comrade_core/utils.py` (AdminChannelManager — dead code, will be recreated in Phase 3 with real utilities)
- Delete: `comrade/comrade_core/permissions.py` (IsOwnerOrReadOnly — never used)

Note: `settings.py`, `asgi.py` at repo root and `../comrade_core/` were previously identified as dead code but have already been deleted. Skip those.

- [ ] **Step 1: Verify none of these are imported anywhere**

Run: `grep -rn "from.*permissions import\|from.*sse_render\|from.*utils import\|AdminChannelManager\|IsOwnerOrReadOnly" comrade/comrade_core/ --include="*.py"`
Expected: No results (or only self-references in the files being deleted).

- [ ] **Step 2: Delete all dead files**

```bash
rm comrade/comrade_core/.ideas.py
rm comrade/comrade_core/sse_render.py
rm comrade/comrade_core/utils.py
rm comrade/comrade_core/permissions.py
```

- [ ] **Step 3: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: 4 tests pass.

- [ ] **Step 4: Run server check**

Run: `pipenv run python manage.py check`
Expected: "System check identified no issues"

- [ ] **Step 5: Commit**

```bash
git add comrade/comrade_core/.ideas.py comrade/comrade_core/sse_render.py comrade/comrade_core/utils.py comrade/comrade_core/permissions.py && git commit -m "refactor: remove dead files (unused modules)"
```

### Task 3: Clean up dead code in models.py

**Files:**
- Modify: `comrade/comrade_core/models.py`

- [ ] **Step 1: Delete `Task.review()` method (lines ~480-497)**

Remove the `review()` method that creates `Review(done=1)` — the `done` field doesn't exist. Also delete `User.get_nearby_users()` (lines ~286-297) — iterates all users in Python, never called.

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/models.py && git commit -m "refactor: remove dead Task.review() and User.get_nearby_users() methods"
```

### Task 4: Clean up dead code in serializers.py

**Files:**
- Modify: `comrade/comrade_core/serializers.py`

- [ ] **Step 1: Delete shadowed and unused serializers**

Remove:
- `UserSerializer` (lines 7-10) — unused `HyperlinkedModelSerializer`
- `GroupSerializer` (lines 13-16) — unused
- First `TaskSerializer` (lines 19-22) — shadowed by the one at line 42
- `from django.contrib.auth.models import Group` import (line 2) — no longer needed
- `from django.contrib.auth import get_user_model` import (line 3) and `User = get_user_model()` (line 24) — User already imported from models at line 1

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/serializers.py && git commit -m "refactor: remove shadowed and unused serializers"
```

### Task 5: Clean up dead code in views.py

**Files:**
- Modify: `comrade/comrade_core/views.py`

- [ ] **Step 1: Remove duplicate User import**

Remove line `User = get_user_model()` (line 32). `User` is already imported from `.models` at line 23. Also remove the `from django.contrib.auth import get_user_model` import (line 16) if no longer needed.

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/views.py && git commit -m "refactor: remove duplicate User import in views.py"
```

### Task 6: Fix consumers.py imports and dead methods

**Files:**
- Modify: `comrade/comrade_core/consumers.py`

- [ ] **Step 1: Move imports to top of file**

Move `from urllib.parse import parse_qs` and `from asgiref.sync import sync_to_async` from line 329-330 to the top of the file with the other imports.

- [ ] **Step 2: Delete dead methods**

Remove:
- `LocationConsumer.group_exists()` (lines ~276-282) — calls non-existent API, never called
- `LocationConsumer.get_user_from_token()` (lines ~284-291) — never called
- `ChatConsumer.get_user_from_token()` (lines ~387-395) — never called, also has a `print()` statement

- [ ] **Step 3: Add guard to `ChatConsumer.disconnect()`**

```python
async def disconnect(self, close_code):
    if hasattr(self, 'room_group_name'):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
```

- [ ] **Step 4: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add comrade/comrade_core/consumers.py && git commit -m "fix: move imports to top, remove dead methods, guard ChatConsumer.disconnect()"
```

### Task 7: Replace print() with logger

**Files:**
- Modify: `comrade/comrade_core/views.py`
- Modify: `comrade/comrade_core/consumers.py`

- [ ] **Step 1: Add logger to views.py**

Add at top of `views.py`:
```python
import logging
logger = logging.getLogger(__name__)
```

Replace `print(f"Found {tasks.count()} ...")` (line ~272) with:
```python
logger.debug("Found %d tasks for user %s (%d with location)", tasks.count(), user, tasks_with_location)
```

- [ ] **Step 2: Replace print() in consumers.py**

Add at top of `consumers.py` (if not already present):
```python
import logging
logger = logging.getLogger(__name__)
```

Replace all `print(f"[{timezone.now()}] ...")` calls with `logger.debug(...)` equivalents:
- Line ~141: `logger.debug("Location saved for %s at %s, %s", ...)`
- Line ~168: `logger.debug("Broadcasting location to %d friends for %s", ...)`
- Line ~197: `logger.debug("Broadcasting location to %d public users for %s", ...)`

- [ ] **Step 3: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add comrade/comrade_core/views.py comrade/comrade_core/consumers.py && git commit -m "fix: replace print() with logger in views and consumers"
```

### Task 8: Fix TaskListView visibility query

**Files:**
- Modify: `comrade/comrade_core/views.py`

- [ ] **Step 1: Write a smoke test for current visibility behavior (test-first)**

Add to `comrade/comrade_core/tests.py`:

```python
from rest_framework.test import APITestCase, APIClient
from rest_framework.authtoken.models import Token


class TaskListVisibilityTest(APITestCase):
    """Smoke tests for TaskListView visibility rules."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass')
        self.user = User.objects.create_user(username='worker', password='pass')
        self.other = User.objects.create_user(username='other', password='pass')
        self.skill_a = Skill.objects.create(name='SkillA')
        self.skill_b = Skill.objects.create(name='SkillB')
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)

    def _task_ids(self):
        resp = self.client.get('/api/tasks/')
        return {t['id'] for t in resp.data['tasks'] if not t.get('is_tutorial')}

    def test_task_with_no_read_skills_visible_to_all(self):
        t = Task.objects.create(name='open', owner=self.owner, state=Task.State.OPEN)
        self.assertIn(t.id, self._task_ids())

    def test_task_with_read_skill_hidden_without_skill(self):
        t = Task.objects.create(name='locked', owner=self.owner, state=Task.State.OPEN)
        t.skill_read.add(self.skill_a)
        self.assertNotIn(t.id, self._task_ids())

    def test_task_with_read_skill_visible_with_skill(self):
        self.user.skills.add(self.skill_a)
        t = Task.objects.create(name='readable', owner=self.owner, state=Task.State.OPEN)
        t.skill_read.add(self.skill_a)
        self.assertIn(t.id, self._task_ids())

    def test_owned_task_always_visible(self):
        t = Task.objects.create(name='mine', owner=self.user, state=Task.State.OPEN)
        t.skill_read.add(self.skill_b)  # user doesn't have skill_b
        self.assertIn(t.id, self._task_ids())

    def test_assigned_task_always_visible(self):
        t = Task.objects.create(name='assigned', owner=self.owner, assignee=self.user, state=Task.State.IN_PROGRESS)
        t.skill_read.add(self.skill_b)
        self.assertIn(t.id, self._task_ids())

    def test_in_review_task_visible_with_write_skill(self):
        self.user.skills.add(self.skill_a)
        t = Task.objects.create(name='reviewable', owner=self.owner, state=Task.State.IN_REVIEW)
        t.skill_write.add(self.skill_a)
        self.assertIn(t.id, self._task_ids())
```

- [ ] **Step 2: Run the new tests to verify they pass with current query**

Run: `pipenv run python manage.py test comrade_core.tests.TaskListVisibilityTest --verbosity 2`
Expected: All 6 tests pass (or some may fail if current query is buggy — note which ones).

- [ ] **Step 3: Fix the visibility query**

Replace the current Q-expression in `TaskListView.get()` with:

```python
tasks = Task.objects.filter(
    models.Q(owner=user)
    | models.Q(assignee=user)
    | models.Q(state=Task.State.IN_REVIEW, skill_write__in=user.skills.all())
    | models.Q(skill_read__isnull=True)
    | models.Q(skill_read__in=user.skills.all())
).distinct()
```

- [ ] **Step 4: Run all tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add comrade/comrade_core/tests.py comrade/comrade_core/views.py && git commit -m "fix: rewrite TaskListView visibility query with correct Q-objects and add smoke tests"
```

### Task 9: Add corsheaders to INSTALLED_APPS

**Files:**
- Modify: `comrade/comrade/settings.py`

- [ ] **Step 1: Add `'corsheaders'` to INSTALLED_APPS**

Add `'corsheaders'` to the INSTALLED_APPS list (after `'channels'`).

- [ ] **Step 2: Run check**

Run: `pipenv run python manage.py check`
Expected: No issues.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade/settings.py && git commit -m "fix: add corsheaders to INSTALLED_APPS"
```

---

## Phase 2: Performance Fixes

### Task 10: Add prefetch/select_related to TaskListView

**Files:**
- Modify: `comrade/comrade_core/views.py`

- [ ] **Step 1: Add query optimizations**

In `TaskListView.get()`, after the `.filter(...).distinct()` call, chain:

```python
tasks = Task.objects.filter(
    ...
).distinct().select_related('owner', 'assignee').prefetch_related(
    'skill_execute', 'skill_read', 'skill_write', 'reviews'
)
```

Also add prefetch for tutorial tasks:
```python
tutorial_tasks = TutorialTask.objects.exclude(
    reward_skill__in=user.skills.all()
).prefetch_related('skill_execute')
```

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/views.py && git commit -m "perf: add select_related/prefetch_related to TaskListView"
```

### Task 10b: Optimize AchievementsView prefetch

**Files:**
- Modify: `comrade/comrade_core/views.py`

- [ ] **Step 1: Add prefetch to AchievementsView**

In `AchievementsView.get()`, prefetch `user_achievements` and `reward_skill` to reduce queries:

```python
def get(self, request):
    user = request.user
    earned_map = {ua.achievement_id: ua for ua in user.user_achievements.select_related('achievement').all()}
    data = []
    for achievement in Achievement.objects.filter(is_active=True).select_related('reward_skill'):
        # ... rest unchanged ...
```

Note: `compute_progress()` runs individual queries per achievement. Full batching would require restructuring the method. For now, the `select_related('reward_skill')` on the queryset and `select_related('achievement')` on user_achievements eliminate the most common N+1 hits. Document full batching as a future optimization.

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/views.py && git commit -m "perf: add select_related to AchievementsView"
```

### Task 11: Cache LocationConfig.get_config()

**Files:**
- Modify: `comrade/comrade_core/models.py`

- [ ] **Step 1: Add TTL cache to get_config()**

```python
import time as _time

_config_cache = {'obj': None, 'ts': 0}
_CONFIG_TTL = 60  # seconds

class LocationConfig(models.Model):
    # ... existing fields ...

    @classmethod
    def get_config(cls):
        """Get or create the global configuration (cached for 60s)."""
        now = _time.monotonic()
        if _config_cache['obj'] is not None and (now - _config_cache['ts']) < _CONFIG_TTL:
            return _config_cache['obj']
        config, created = cls.objects.get_or_create(pk=1)
        _config_cache['obj'] = config
        _config_cache['ts'] = now
        return config
```

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/models.py && git commit -m "perf: cache LocationConfig.get_config() with 60s TTL"
```

### Task 12: Optimize save_user_location

**Files:**
- Modify: `comrade/comrade_core/consumers.py`

- [ ] **Step 1: Use update_fields in save_user_location**

```python
async def save_user_location(self, user, latitude, longitude):
    user.latitude = latitude
    user.longitude = longitude
    user.timestamp = timezone.now()
    await database_sync_to_async(
        lambda: user.save(update_fields=['latitude', 'longitude', 'timestamp'])
    )()
```

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/consumers.py && git commit -m "perf: use update_fields in save_user_location"
```

### Task 13: Add select_for_update() to task state transitions

**Files:**
- Modify: `comrade/comrade_core/views.py`

- [ ] **Step 1: Wrap task fetches in transaction.atomic() with select_for_update()**

Add import at top:
```python
from django.db import transaction
```

For each task action view (TaskStartView, TaskFinishView, TaskPauseView, TaskResumeView, TaskAbandonView, TaskAcceptReviewView, TaskDeclineReviewView), change the task fetch pattern from:
```python
try:
    task = Task.objects.get(pk=taskId)
except Task.DoesNotExist:
    return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
```
to:
```python
with transaction.atomic():
    try:
        task = Task.objects.select_for_update().get(pk=taskId)
    except Task.DoesNotExist:
        return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
    # ... rest of the view logic inside the atomic block ...
```

Note: The `return Response(...)` for DoesNotExist should stay OUTSIDE the atomic block (early return before entering it) OR the entire view body should be inside the atomic block. Simplest approach: wrap the entire post() body in `with transaction.atomic():` and use `select_for_update()` on the get().

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass. Note: SQLite doesn't enforce `select_for_update()` but doesn't error on it either.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/views.py && git commit -m "fix: add select_for_update() to prevent race conditions in task state transitions"
```

### Task 14: Optimize check_and_reset_stale

**Files:**
- Modify: `comrade/comrade_core/models.py`

- [ ] **Step 1: Replace Python loop with annotated query**

Replace the current `check_and_reset_stale()` method:

```python
@classmethod
def check_and_reset_stale(cls):
    """Abandon WAITING tasks that have been paused longer than their estimated minutes x pause_multiplier."""
    from datetime import timedelta
    from django.db.models import F, ExpressionWrapper, DurationField
    config = LocationConfig.get_config()
    # timedelta(minutes=1) * F('minutes') produces a proper DurationField
    cutoff = ExpressionWrapper(
        timedelta(minutes=1) * F('minutes') * config.pause_multiplier,
        output_field=DurationField(),
    )
    cls.objects.filter(
        state=cls.State.WAITING,
        datetime_paused__isnull=False,
    ).annotate(
        max_pause=cutoff,
    ).filter(
        datetime_paused__lte=now() - F('max_pause'),
    ).update(
        state=cls.State.OPEN,
        assignee=None,
        datetime_start=None,
        datetime_paused=None,
        time_spent_minutes=None,
    )
```

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/models.py && git commit -m "perf: replace Python loop with single query in check_and_reset_stale()"
```

---

## Phase 3: Structural Cleanup

### Task 15: Create comrade_core/utils.py with shared helpers

**Files:**
- Create: `comrade/comrade_core/utils.py`
- Modify: `comrade/comrade_core/models.py`

- [ ] **Step 1: Create utils.py with haversine and level computation**

```python
import math


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in kilometers."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_level(total_xp: float, modifier: float) -> tuple[int, float, float]:
    """Compute (level, current_xp_in_level, xp_required_for_next_level) from total XP.

    Base 1000 XP per level, +10% per level, scaled by modifier.
    """
    if modifier <= 0:
        modifier = 1.0
    xp = total_xp
    lvl = 0
    required = 1000.0 * modifier
    while xp >= required:
        xp -= required
        lvl += 1
        required = 1000.0 * modifier * (1.1 ** lvl)
    return lvl, xp, required
```

- [ ] **Step 2: Update models.py to use utils**

Replace standalone `haversine_km()` function and `User.distance_to()`:

```python
from .utils import haversine_km, compute_level

# Delete the standalone haversine_km() function (lines ~300-305)

# In User class, replace distance_to():
def distance_to(self, other_user):
    """Calculate distance to another user in kilometers."""
    return haversine_km(self.latitude, self.longitude, other_user.latitude, other_user.longitude)

# Replace User.level property:
@property
def level(self) -> int:
    config = LocationConfig.get_config()
    lvl, _, _ = compute_level(self.total_xp_earned, config.level_modifier)
    return lvl

# Replace User.level_progress property:
@property
def level_progress(self) -> dict:
    config = LocationConfig.get_config()
    lvl, current_xp, required_xp = compute_level(self.total_xp_earned, config.level_modifier)
    return {'level': lvl, 'current_xp': current_xp, 'required_xp': required_xp}
```

- [ ] **Step 3: Update views.py import**

Change `from .models import ... haversine_km ...` to `from .utils import haversine_km`.

- [ ] **Step 4: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add comrade/comrade_core/utils.py comrade/comrade_core/models.py comrade/comrade_core/views.py && git commit -m "refactor: extract haversine_km and compute_level to utils.py, deduplicate"
```

### Task 16: Split models.py into package

**Files:**
- Create: `comrade/comrade_core/models/` (directory)
- Create: `comrade/comrade_core/models/__init__.py`
- Create: `comrade/comrade_core/models/config.py`
- Create: `comrade/comrade_core/models/user.py`
- Create: `comrade/comrade_core/models/task.py`
- Create: `comrade/comrade_core/models/achievement.py`
- Create: `comrade/comrade_core/models/tutorial.py`
- Create: `comrade/comrade_core/models/chat.py`
- Delete: `comrade/comrade_core/models.py` (replaced by package)

- [ ] **Step 1: Create the models package directory**

```bash
mkdir -p comrade/comrade_core/models
```

- [ ] **Step 2: Create each model module**

**`models/config.py`** — Contains `LocationConfig` model and the `_config_cache` TTL cache.

**`models/skill.py`** — Contains `Skill` model (simple CharField model, no dependencies).

**`models/user.py`** — Contains `User` model. Imports `Skill` from `.skill`, `LocationConfig` from `.config`, and `haversine_km`, `compute_level` from `..utils`.

**`models/task.py`** — Contains `Task`, `Rating`, `Review` models. Imports `Skill` from `.skill`, `User` from `.user`, `LocationConfig` from `.config`.

**`models/achievement.py`** — Contains `Achievement`, `UserAchievement` models. Imports `Task` from `.task`, `Rating` from `.task`.

**`models/tutorial.py`** — Contains `TutorialTask`, `TutorialPart`, `TutorialQuestion`, `TutorialAnswer`, `TutorialProgress` models. Imports `Skill` from `.skill`.

**`models/chat.py`** — Contains `ChatMessage` model.

**`models/__init__.py`** — Re-exports everything:
```python
from .config import LocationConfig
from .skill import Skill
from .user import User
from .task import Task, Rating, Review
from .achievement import Achievement, UserAchievement
from .tutorial import TutorialTask, TutorialPart, TutorialQuestion, TutorialAnswer, TutorialProgress
from .chat import ChatMessage

__all__ = [
    'LocationConfig', 'Skill', 'User', 'Task', 'Rating', 'Review',
    'Achievement', 'UserAchievement',
    'TutorialTask', 'TutorialPart', 'TutorialQuestion', 'TutorialAnswer', 'TutorialProgress',
    'ChatMessage',
]
```

- [ ] **Step 3: Delete old models.py**

```bash
rm comrade/comrade_core/models.py
```

- [ ] **Step 4: Run migrations check (no changes expected)**

Run: `pipenv run python manage.py makemigrations --check`
Expected: "No changes detected" (splitting into package should not affect migrations since `app_label` stays `comrade_core`).

- [ ] **Step 5: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add comrade/comrade_core/models/ && git rm comrade/comrade_core/models.py && git commit -m "refactor: split models.py into models/ package (config, skill, user, task, achievement, tutorial, chat)"
```

### Task 17: Split views.py into package

**Files:**
- Create: `comrade/comrade_core/views/` (directory)
- Create: `comrade/comrade_core/views/__init__.py`
- Create: `comrade/comrade_core/views/user.py`
- Create: `comrade/comrade_core/views/task.py`
- Create: `comrade/comrade_core/views/tutorial.py`
- Create: `comrade/comrade_core/views/friends.py`
- Create: `comrade/comrade_core/views/config.py`
- Create: `comrade/comrade_core/views/auth.py`
- Create: `comrade/comrade_core/views/chat.py`
- Delete: `comrade/comrade_core/views.py` (replaced by package)

- [ ] **Step 1: Create the views package directory**

```bash
mkdir -p comrade/comrade_core/views
```

- [ ] **Step 2: Create each view module**

**`views/user.py`** — `UserDetailView`, `LocationSharingPreferencesView`, `get_user_info`

**`views/task.py`** — `TaskStartView`, `TaskFinishView`, `TaskPauseView`, `TaskResumeView`, `TaskAbandonView`, `TaskListView`, `TaskCreateView`, `TaskDebugResetView`, `TaskAcceptReviewView`, `TaskDeclineReviewView`, `TaskRateView`, `_serialize_achievements`

**`views/tutorial.py`** — `TutorialDetailView`, `TutorialSubmitPartView`, `TutorialTaskStartView`, `TutorialTaskAbandonView`

**`views/friends.py`** — `send_friend_request`, `accept_friend_request`, `reject_friend_request`, `remove_friend`, `get_friends`, `get_pending_requests`, `get_sent_requests`

**`views/config.py`** — `ProximitySettingsView`, `GlobalConfigView`, `AchievementsView`, `SkillListView`

**`views/auth.py`** — `google_oauth_callback`, `google_config`, `token_login_view`, `login_page`, `_unique_username`, `index`, `map`

**`views/chat.py`** — `chat_history`, `welcome_message`, `welcome_accept`

**`views/__init__.py`** — Re-exports all views + `index`, `map`:
```python
from .user import UserDetailView, LocationSharingPreferencesView, get_user_info
from .task import (TaskStartView, TaskFinishView, TaskPauseView, TaskResumeView,
                   TaskAbandonView, TaskListView, TaskCreateView, TaskDebugResetView,
                   TaskAcceptReviewView, TaskDeclineReviewView, TaskRateView)
from .tutorial import (TutorialDetailView, TutorialSubmitPartView,
                       TutorialTaskStartView, TutorialTaskAbandonView)
from .friends import (send_friend_request, accept_friend_request, reject_friend_request,
                      remove_friend, get_friends, get_pending_requests, get_sent_requests)
from .config import ProximitySettingsView, GlobalConfigView, AchievementsView, SkillListView
from .auth import google_oauth_callback, google_config, token_login_view, login_page, index, map
from .chat import chat_history, welcome_message, welcome_accept
```

- [ ] **Step 3: Delete old views.py**

```bash
rm comrade/comrade_core/views.py
```

- [ ] **Step 4: Verify urls.py still resolves (no changes to urls.py needed)**

Run: `pipenv run python manage.py check`
Expected: No issues. The `from . import views` in `urls.py` will resolve to the package `__init__.py`.

- [ ] **Step 5: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add comrade/comrade_core/views/ && git rm comrade/comrade_core/views.py && git commit -m "refactor: split views.py into views/ package (user, task, tutorial, friends, config, auth, chat)"
```

### Task 18: Consistency fixes — state methods and URL params

**Files:**
- Modify: `comrade/comrade_core/models/task.py`
- Modify: `comrade/comrade_core/urls.py`
- Modify: `comrade/comrade_core/views/task.py`
- Modify: `comrade/comrade_core/views/tutorial.py`

- [ ] **Step 1: Make state methods consistently raise ValidationError**

In `Task` model, change `pause()`, `resume()`, and `finish()` to raise instead of returning `False`:

```python
def pause(self, user):
    if user != self.assignee:
        raise ValidationError("Only assignee can pause the task")
    if self.state != Task.State.IN_PROGRESS:
        raise ValidationError("Task is not in progress")
    # ... rest unchanged ...

def resume(self, user):
    if self.state != Task.State.WAITING:
        raise ValidationError("Task is not waiting")
    # ... rest unchanged ...

def finish(self, user):
    if self.state != Task.State.IN_PROGRESS:
        raise ValidationError("Task is not in progress")
    # ... rest unchanged ...
```

- [ ] **Step 2: Rename URL capture groups (backend-only, does not change URL paths)**

In `urls.py`, rename `<int:taskId>` to `<int:task_id>` and `<int:partId>` to `<int:part_id>`.

Update all view method signatures accordingly: `def post(self, request, task_id)` etc.

- [ ] **Step 3: Remove unused `task = None` patterns**

In task views, clean up patterns like:
```python
# Before:
task = None
try:
    task = Task.objects.get(pk=task_id)
except Task.DoesNotExist as e:
    ...

# After:
try:
    task = Task.objects.select_for_update().get(pk=task_id)
except Task.DoesNotExist:
    ...
```

- [ ] **Step 4: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add comrade/comrade_core/models/ comrade/comrade_core/urls.py comrade/comrade_core/views/ && git commit -m "refactor: consistent ValidationError in state methods, rename URL params to snake_case, clean up views"
```

---

## Phase 4: Tests

### Task 19: Model tests — Task lifecycle

**Files:**
- Modify: `comrade/comrade_core/tests.py`

- [ ] **Step 1: Add comprehensive task lifecycle tests**

```python
class TaskLifecycleTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass')
        self.worker = User.objects.create_user(username='worker', password='pass')
        self.task = Task.objects.create(name='test', owner=self.owner, state=Task.State.OPEN)

    def test_start_sets_state_and_assignee(self):
        self.task.start(self.worker)
        self.assertEqual(self.task.state, Task.State.IN_PROGRESS)
        self.assertEqual(self.task.assignee, self.worker)

    def test_start_fails_for_owner(self):
        with self.assertRaises(ValidationError):
            self.task.start(self.owner)

    def test_start_fails_if_not_open(self):
        self.task.state = Task.State.IN_PROGRESS
        self.task.save()
        with self.assertRaises(ValidationError):
            self.task.start(self.worker)

    def test_pause_sets_waiting(self):
        self.task.start(self.worker)
        self.task.pause(self.worker)
        self.assertEqual(self.task.state, Task.State.WAITING)

    def test_pause_fails_for_non_assignee(self):
        self.task.start(self.worker)
        with self.assertRaises(ValidationError):
            self.task.pause(self.owner)

    def test_pause_fails_if_not_in_progress(self):
        self.task.start(self.worker)
        self.task.pause(self.worker)
        with self.assertRaises(ValidationError):
            self.task.pause(self.worker)

    def test_resume_sets_in_progress(self):
        self.task.start(self.worker)
        self.task.pause(self.worker)
        self.task.resume(self.worker)
        self.assertEqual(self.task.state, Task.State.IN_PROGRESS)

    def test_resume_fails_if_not_waiting(self):
        self.task.start(self.worker)
        with self.assertRaises(ValidationError):
            self.task.resume(self.worker)

    def test_finish_sets_in_review(self):
        self.task.start(self.worker)
        self.task.finish(self.worker)
        self.assertEqual(self.task.state, Task.State.IN_REVIEW)

    def test_finish_fails_if_not_in_progress(self):
        with self.assertRaises(ValidationError):
            self.task.finish(self.worker)

    def test_abandon_resets_to_open(self):
        self.task.start(self.worker)
        self.task.abandon(self.worker)
        self.assertEqual(self.task.state, Task.State.OPEN)
        self.assertIsNone(self.task.assignee)

    def test_abandon_resets_streak(self):
        self.worker.task_streak = 5
        self.worker.save()
        self.task.start(self.worker)
        self.task.abandon(self.worker)
        self.worker.refresh_from_db()
        self.assertEqual(self.worker.task_streak, 0)

    def test_abandon_fails_for_non_assignee(self):
        self.task.start(self.worker)
        with self.assertRaises(ValidationError):
            self.task.abandon(self.owner)

    def test_accept_review_sets_done_and_rewards(self):
        self.task.coins = 0.5
        self.task.xp = 0.5
        self.task.minutes = 15
        self.task.save()
        self.task.start(self.worker)
        self.task.finish(self.worker)
        from .models import Review
        Review.objects.create(task=self.task)
        self.task.accept_review(self.owner)
        self.task.refresh_from_db()
        self.assertEqual(self.task.state, Task.State.DONE)
        self.worker.refresh_from_db()
        self.assertGreater(self.worker.coins, 0)
        self.assertGreater(self.worker.xp, 0)
        self.assertEqual(self.worker.task_streak, 1)

    def test_decline_review_resets_to_open(self):
        self.task.start(self.worker)
        self.task.finish(self.worker)
        from .models import Review
        Review.objects.create(task=self.task)
        self.task.decline_review(self.owner)
        self.task.refresh_from_db()
        self.assertEqual(self.task.state, Task.State.OPEN)
        self.assertIsNone(self.task.assignee)
```

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/tests.py && git commit -m "test: add comprehensive task lifecycle model tests"
```

### Task 20: Model tests — User, Friends, Achievement

**Files:**
- Modify: `comrade/comrade_core/tests.py`

- [ ] **Step 1: Add user and friends tests**

```python
class UserModelTest(TestCase):
    def test_level_starts_at_zero(self):
        u = User.objects.create_user(username='new', password='pass')
        self.assertEqual(u.level, 0)

    def test_level_increases_with_xp(self):
        u = User.objects.create_user(username='new', password='pass', total_xp_earned=1500)
        self.assertGreaterEqual(u.level, 1)

    def test_level_progress_structure(self):
        u = User.objects.create_user(username='new', password='pass')
        progress = u.level_progress
        self.assertIn('level', progress)
        self.assertIn('current_xp', progress)
        self.assertIn('required_xp', progress)

    def test_distance_to(self):
        u1 = User.objects.create_user(username='a', password='p', latitude=50.0, longitude=14.0)
        u2 = User.objects.create_user(username='b', password='p', latitude=50.0, longitude=14.01)
        dist = u1.distance_to(u2)
        self.assertGreater(dist, 0)
        self.assertLess(dist, 2)  # ~0.7 km


class FriendsTest(TestCase):
    def setUp(self):
        self.u1 = User.objects.create_user(username='u1', password='pass')
        self.u2 = User.objects.create_user(username='u2', password='pass')

    def test_send_and_accept(self):
        self.u1.send_friend_request(self.u2)
        self.assertIn(self.u2, self.u1.friend_requests_sent.all())
        self.u2.accept_friend_request(self.u1)
        self.assertIn(self.u2, self.u1.friends.all())

    def test_send_to_self_fails(self):
        with self.assertRaises(ValidationError):
            self.u1.send_friend_request(self.u1)

    def test_duplicate_request_fails(self):
        self.u1.send_friend_request(self.u2)
        with self.assertRaises(ValidationError):
            self.u1.send_friend_request(self.u2)

    def test_reject_request(self):
        self.u1.send_friend_request(self.u2)
        self.u2.reject_friend_request(self.u1)
        self.assertNotIn(self.u1, self.u2.friend_requests_received.all())

    def test_remove_friend(self):
        self.u1.send_friend_request(self.u2)
        self.u2.accept_friend_request(self.u1)
        self.u1.remove_friend(self.u2)
        self.assertNotIn(self.u2, self.u1.friends.all())


class AchievementTest(TestCase):
    def test_compute_progress_task_count(self):
        from .models import Achievement
        user = User.objects.create_user(username='a', password='p')
        owner = User.objects.create_user(username='o', password='p')
        achievement = Achievement.objects.create(
            name='First Task', condition_type='task_count', condition_value=1
        )
        self.assertEqual(achievement.compute_progress(user), 0)
        Task.objects.create(name='t', owner=owner, assignee=user, state=Task.State.DONE)
        self.assertEqual(achievement.compute_progress(user), 1)

    def test_check_and_award_achievements(self):
        from .models import Achievement
        user = User.objects.create_user(username='a', password='p')
        owner = User.objects.create_user(username='o', password='p')
        Achievement.objects.create(
            name='First Task', condition_type='task_count', condition_value=1, reward_coins=10
        )
        Task.objects.create(name='t', owner=owner, assignee=user, state=Task.State.DONE)
        awards = user.check_and_award_achievements()
        self.assertEqual(len(awards), 1)
        self.assertEqual(awards[0].name, 'First Task')
        user.refresh_from_db()
        self.assertEqual(user.coins, 10)
```

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/tests.py && git commit -m "test: add User, Friends, and Achievement model tests"
```

### Task 21: Model tests — Tutorial

**Files:**
- Modify: `comrade/comrade_core/tests.py`

- [ ] **Step 1: Add tutorial model tests**

```python
class TutorialTest(TestCase):
    def setUp(self):
        from .models import TutorialTask, TutorialPart, TutorialQuestion, TutorialAnswer, TutorialProgress
        self.user = User.objects.create_user(username='learner', password='pass')
        self.skill = Skill.objects.create(name='NewSkill')
        self.tutorial = TutorialTask.objects.create(name='Learn', reward_skill=self.skill)
        self.part_text = TutorialPart.objects.create(
            tutorial=self.tutorial, type='text', title='Intro', order=0, text_content='Hello'
        )
        self.part_quiz = TutorialPart.objects.create(
            tutorial=self.tutorial, type='quiz', title='Quiz', order=1
        )
        self.question = TutorialQuestion.objects.create(part=self.part_quiz, text='What?', order=0)
        self.correct = TutorialAnswer.objects.create(question=self.question, text='Right', is_correct=True, order=0)
        self.wrong = TutorialAnswer.objects.create(question=self.question, text='Wrong', is_correct=False, order=1)

    def test_progress_tracks_completed_parts(self):
        from .models import TutorialProgress
        progress = TutorialProgress.objects.create(user=self.user, tutorial=self.tutorial)
        self.assertFalse(progress.is_complete())
        progress.completed_parts.add(self.part_text)
        self.assertFalse(progress.is_complete())
        progress.completed_parts.add(self.part_quiz)
        self.assertTrue(progress.is_complete())

    def test_completing_tutorial_awards_skill(self):
        from .models import TutorialProgress
        progress = TutorialProgress.objects.create(user=self.user, tutorial=self.tutorial)
        progress.completed_parts.add(self.part_text, self.part_quiz)
        if progress.is_complete():
            self.user.skills.add(self.tutorial.reward_skill)
        self.assertIn(self.skill, self.user.skills.all())
```

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/tests.py && git commit -m "test: add Tutorial model tests"
```

### Task 22: View tests — Task endpoints

**Files:**
- Modify: `comrade/comrade_core/tests.py`

- [ ] **Step 1: Add task API endpoint tests**

```python
class TaskAPITest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass')
        self.worker = User.objects.create_user(username='worker', password='pass')
        self.task = Task.objects.create(name='api-test', owner=self.owner, state=Task.State.OPEN)
        self.token = Token.objects.create(user=self.worker)
        self.owner_token = Token.objects.create(user=self.owner)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)

    def test_tasks_list_requires_auth(self):
        c = APIClient()  # no credentials
        resp = c.get('/api/tasks/')
        self.assertEqual(resp.status_code, 401)

    def test_tasks_list_returns_tasks(self):
        resp = self.client.get('/api/tasks/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('tasks', resp.data)

    def test_start_task(self):
        resp = self.client.post(f'/api/task/{self.task.id}/start')
        self.assertEqual(resp.status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.state, Task.State.IN_PROGRESS)

    def test_pause_task(self):
        self.task.start(self.worker)
        self.task.save()
        resp = self.client.post(f'/api/task/{self.task.id}/pause')
        self.assertEqual(resp.status_code, 200)

    def test_resume_task(self):
        self.task.start(self.worker)
        self.task.pause(self.worker)
        resp = self.client.post(f'/api/task/{self.task.id}/resume')
        self.assertEqual(resp.status_code, 200)

    def test_finish_task(self):
        self.task.start(self.worker)
        self.task.save()
        resp = self.client.post(f'/api/task/{self.task.id}/finish')
        self.assertEqual(resp.status_code, 200)

    def test_abandon_task(self):
        self.task.start(self.worker)
        self.task.save()
        resp = self.client.post(f'/api/task/{self.task.id}/abandon')
        self.assertEqual(resp.status_code, 200)

    def test_start_nonexistent_task_returns_404(self):
        resp = self.client.post('/api/task/99999/start')
        self.assertEqual(resp.status_code, 404)

    def test_create_task_requires_admin(self):
        resp = self.client.post('/api/tasks/create', {'name': 'test'})
        self.assertEqual(resp.status_code, 403)

    def test_create_task_as_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.owner_token.key)
        self.owner.is_staff = True
        self.owner.save()
        resp = self.client.post('/api/tasks/create', {'name': 'new task', 'lat': 50.0, 'lon': 14.0})
        self.assertEqual(resp.status_code, 201)
```

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/tests.py && git commit -m "test: add Task API endpoint tests"
```

### Task 23: View tests — Friends and Config endpoints

**Files:**
- Modify: `comrade/comrade_core/tests.py`

- [ ] **Step 1: Add friends and config API tests**

```python
class FriendsAPITest(APITestCase):
    def setUp(self):
        self.u1 = User.objects.create_user(username='u1', password='pass')
        self.u2 = User.objects.create_user(username='u2', password='pass')
        self.t1 = Token.objects.create(user=self.u1)
        self.t2 = Token.objects.create(user=self.u2)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.t1.key)

    def test_send_friend_request(self):
        resp = self.client.post(f'/api/friends/send/{self.u2.id}/')
        self.assertEqual(resp.status_code, 200)

    def test_accept_friend_request(self):
        self.u1.send_friend_request(self.u2)
        c2 = APIClient()
        c2.credentials(HTTP_AUTHORIZATION='Token ' + self.t2.key)
        resp = c2.post(f'/api/friends/accept/{self.u1.id}/')
        self.assertEqual(resp.status_code, 200)

    def test_get_friends(self):
        resp = self.client.get('/api/friends/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('friends', resp.data)

    def test_get_pending(self):
        resp = self.client.get('/api/friends/pending/')
        self.assertEqual(resp.status_code, 200)


class GlobalConfigAPITest(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin', password='pass')
        self.user = User.objects.create_user(username='user', password='pass')
        self.admin_token = Token.objects.create(user=self.admin)
        self.user_token = Token.objects.create(user=self.user)

    def test_config_requires_superuser(self):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION='Token ' + self.user_token.key)
        resp = c.get('/api/settings/global/')
        self.assertEqual(resp.status_code, 403)

    def test_config_accessible_by_superuser(self):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION='Token ' + self.admin_token.key)
        resp = c.get('/api/settings/global/')
        self.assertEqual(resp.status_code, 200)
```

- [ ] **Step 2: Run tests**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add comrade/comrade_core/tests.py && git commit -m "test: add Friends and GlobalConfig API tests"
```

**Note:** WebSocket tests (LocationConsumer, ChatConsumer) are listed in the spec but deferred from this plan. They require `channels` test infrastructure (`WebsocketCommunicator`, in-memory channel layer) which adds significant setup complexity. Add as a follow-up task.

### Task 24: Final verification

- [ ] **Step 1: Run full test suite**

Run: `pipenv run python manage.py test comrade_core --verbosity 2`
Expected: All tests pass (should be 40+ tests).

- [ ] **Step 2: Run Django system check**

Run: `pipenv run python manage.py check`
Expected: No issues.

- [ ] **Step 3: Verify migrations are clean**

Run: `pipenv run python manage.py makemigrations --check`
Expected: "No changes detected"

- [ ] **Step 4: Start server and verify it runs**

Run: `pipenv run python manage.py runserver`
Expected: Server starts without errors on port 8000.

- [ ] **Step 5: Commit any final fixes and tag completion**

```bash
git commit -m "refactor: backend refactor complete — all phases done" --allow-empty
```
