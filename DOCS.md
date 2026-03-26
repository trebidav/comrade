# Comrade — Application Documentation

Comrade is a gamified, location-based community task management platform. Users complete real-world tasks, earn skills through tutorials, gain coins/XP, and unlock achievements. The app uses an interactive map, real-time location sharing, and a friend-based social system.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [User System](#user-system)
3. [Task System](#task-system)
4. [Tutorial System](#tutorial-system)
5. [Gamification](#gamification)
6. [Friends & Social](#friends--social)
7. [Chat](#chat)
8. [Real-Time (WebSocket)](#real-time-websocket)
9. [Bug Reporting](#bug-reporting)
10. [Admin Configuration](#admin-configuration)
11. [Authentication](#authentication)
12. [API Reference](#api-reference)
13. [Frontend Components](#frontend-components)
14. [Themes & Map Tiles](#themes--map-tiles)
15. [Deployment](#deployment)

---

## Architecture Overview

**Stack:**
- Backend: Django 5 + Django REST Framework + Django Channels (ASGI via Daphne)
- Frontend: React 19 + TypeScript + Vite + Leaflet (maps) + Tailwind CSS v4
- Database: SQLite (dev) / PostgreSQL (prod)
- Cache/Queue: Redis (WebSocket channel layer)
- Auth: Google OAuth → DRF Token
- Monitoring: Better Stack (Sentry SDK for backend + JS tag for frontend)

**Project Layout:**
```
comrade/                          # Git repo root
  comrade/                        # Django project config (settings, urls, asgi)
  comrade_core/                   # Main Django app
    models/                       # Split into: config, skill, user, task, achievement, tutorial, chat, bug_report
    views/                        # Split into: auth, user, task, tutorial, friends, config, chat, bug_report
    consumers.py                  # WebSocket consumers
    ws_events.py                  # WebSocket event broadcasting utilities
    serializers.py                # DRF serializers
    urls.py                       # URL routing (REST + WebSocket)
    admin.py                      # Django admin configuration
    utils.py                      # Shared utilities (haversine, level computation)
    tests.py                      # 56 tests
  client/                         # React frontend (Vite)
    src/
      api.ts                      # Axios client + TypeScript types + utilities
      components/                 # 40+ React components (mobile + desktop variants)
      hooks/                      # useLocationSocket (WebSocket hook)
      theme.ts                    # Theme + map tile configuration
```

---

## User System

### Model: `User` (extends Django AbstractUser)

| Field | Type | Description |
|-------|------|-------------|
| `skills` | M2M Skill | Skills the user has earned |
| `latitude`, `longitude` | Float | Current GPS position |
| `coins`, `xp` | Float | Current balance |
| `total_coins_earned`, `total_xp_earned` | Float | Lifetime totals (for achievements) |
| `task_streak` | Int | Consecutive completions without abandoning |
| `location_sharing_level` | Enum | `none` / `friends` / `all` |
| `friends` | M2M User (symmetric) | Mutual friend connections |
| `friend_requests_sent` | M2M User | Outgoing pending requests |
| `welcome_accepted` | Bool | Whether user has seen the welcome message |
| `profile_picture` | URL | From Google OAuth profile |

### Level System

Levels are computed from `total_xp_earned`:
- Base: 1000 XP per level
- Scaling: +10% per level (1.1^level)
- Global modifier: `GlobalConfig.level_modifier`
- Formula: `required_xp = 1000 * modifier * (1.1 ^ level)`

The `level` and `level_progress` are computed properties (not stored).

---

## Task System

### Model: `Task`

Tasks are location-based work items with a state machine lifecycle.

### State Machine

```
OPEN (1) → IN_PROGRESS (2) → WAITING (3) → IN_PROGRESS (2)
                ↓                                   ↓
          IN_REVIEW (4)                        OPEN (abandon)
                ↓
    DONE (5) or OPEN (declined)
```

| State | Value | Description |
|-------|-------|-------------|
| UNAVAILABLE | 0 | Not shown |
| OPEN | 1 | Available to start |
| IN_PROGRESS | 2 | Being worked on |
| WAITING | 3 | Paused by assignee |
| IN_REVIEW | 4 | Submitted, awaiting owner approval |
| DONE | 5 | Completed and approved |

### Task Lifecycle

1. **Start** — User must have all `skill_execute` skills. Must be within `task_proximity_km` of the task location. Any other in-progress tasks for this user are auto-paused.
2. **Pause** — Assignee only. Accumulates elapsed time. Enters WAITING state.
3. **Resume** — Assignee only. Must be within proximity again. Resumes from WAITING.
4. **Finish** — Owner or assignee. Optionally requires photo and/or comment. Creates a Review record. Enters IN_REVIEW.
5. **Accept Review** — Owner or user with write skill. Awards coins/XP to assignee. Increments streak. Checks achievements. Schedules respawn if enabled. Enters DONE.
6. **Decline Review** — Resets to OPEN, clears assignee.
7. **Abandon** — Assignee only (from IN_PROGRESS or WAITING). Resets streak to 0. Resets to OPEN.

### Stale Task Auto-Reset

WAITING tasks are automatically reset to OPEN if paused longer than `minutes × pause_multiplier`. Checked on every `GET /api/tasks/` request.

### Task Respawn

Completed tasks with `respawn=true` automatically return to OPEN after:
- `respawn_offset` minutes (if set), OR
- At the fixed `respawn_time` (next occurrence)

### Skill-Based Visibility

A task is visible to a user if ANY of these are true:
1. User is the task owner
2. User is the task assignee
3. Task is IN_REVIEW and user has a matching write skill
4. Task has no read skills (visible to everyone)
5. Task has read skills and user has at least one matching read skill

### Reward Formula

When a review is accepted:
```
time_multiplier = task.minutes / config.time_modifier_minutes
criticality_factor = 1.0 + (task.criticality - 1) * config.criticality_percentage

earned_coins = task.coins * config.coins_modifier * time_multiplier
earned_xp = task.xp * config.xp_modifier * time_multiplier * criticality_factor
```

Criticality levels: LOW (1), MEDIUM (2), HIGH (3).

### Task Proximity

Users must be within `GlobalConfig.task_proximity_km` (default 200m) of the task to start or resume it. Distance is calculated using the Haversine formula.

---

## Tutorial System

Tutorials are standalone learning tasks (separate from regular Tasks) that award a skill on completion.

### Models

**TutorialTask** — A tutorial with a name, location, prerequisite skills (`skill_execute`), and a `reward_skill`.

**TutorialPart** — A step within a tutorial. Types:
| Type | Validation |
|------|-----------|
| `text` | None (informational) |
| `video` | None (informational) |
| `quiz` | All questions must be answered correctly |
| `password` | Exact string match (case-sensitive) |
| `file_upload` | File must be provided |

**TutorialProgress** — Tracks which parts a user has completed. When all parts are done, the `reward_skill` is added to the user.

### Visibility

Tutorial tasks only appear in the task list for users who do NOT already have the `reward_skill`. Tutorial IDs are offset by 100,000 in the API to avoid collision with regular Task IDs.

---

## Gamification

### Achievements

Achievements are milestones that unlock based on user activity. Each has a condition type, threshold value, and optional rewards.

**Condition Types:**

| Type | What it measures | Filter |
|------|-----------------|--------|
| `task_count` | Total tasks completed | — |
| `task_count_skill` | Tasks with specific skill | `{"skill_name": "Medical"}` |
| `task_count_criticality` | Tasks above min criticality | `{"min_criticality": 2}` |
| `task_streak` | Consecutive completions | — |
| `xp_total` | Lifetime XP earned | — |
| `coins_total` | Lifetime coins earned | — |
| `skill_count` | Number of skills | — |
| `tutorial_count` | Tutorials completed | — |
| `tasks_created` | Tasks created (admin) | — |
| `ratings_given` | Ratings submitted | — |
| `friends_count` | Number of friends | — |

**Rewards:** Bonus coins, bonus XP, and/or a new skill.

**Secret Achievements:** Hidden until earned. Shown as "???" with a lock icon.

Achievements are checked after: task review acceptance, tutorial completion, rating submission, friend acceptance.

### Ratings

After task completion, users can rate the experience:
- `happiness` (1-5): Satisfaction
- `time` (1-5): Time estimate accuracy
- `feedback` (text): Optional comment

---

## Friends & Social

### Friend Request Flow

1. User A sends request to User B → `friend_requests_sent` M2M
2. User B sees pending request → `friend_requests_received` (reverse relation)
3. User B accepts → both added to symmetric `friends` M2M, request removed
4. Either can reject (deletes request) or remove (deletes friendship)

### Validation Rules
- Cannot send request to yourself
- Cannot send duplicate requests
- Cannot send if other user already sent you a request
- Cannot send if already friends

### WebSocket Notifications
Friend events push real-time notifications:
- `friend_request_received` — to target user
- `friend_request_accepted` — to requesting user
- `friend_request_rejected` — to requesting user
- `friend_removed` — to removed user
- `friend_online` — to all friends on connect
- `user_offline` — to all friends on disconnect

---

## Chat

### How it works

Chat messages are sent through the WebSocket (`LocationConsumer`), not a separate endpoint. Messages are persisted to the `ChatMessage` model and broadcast to all friends.

- **Send:** Client sends `{type: 'chat_message', message: '...'}` via WebSocket
- **Server:** Creates `ChatMessage` record, broadcasts to each friend's channel group
- **Receive:** Friends get `{type: 'chat_message', message, sender, msgId, timestamp}`
- **History:** `GET /api/chat/history/` returns last 100 messages from user + friends

The frontend uses optimistic updates with negative temporary IDs, replaced by server-confirmed `msgId` on delivery.

---

## Real-Time (WebSocket)

### Connection

Single WebSocket per user: `ws://<host>/ws/location/?token=<auth_token>`

On connect:
- Joins per-user group `location_{user_id}` (for targeted messages)
- Joins shared `public_locations` group (for broadcast)
- Caches friends list (invalidated on friend accept/remove events)
- Notifies friends of online status

### Client → Server Messages

| Type | Payload | Action |
|------|---------|--------|
| `heartbeat` | — | Returns `heartbeat_response` |
| `location_update` | `{latitude, longitude, accuracy}` | Saves location, broadcasts to friends/public |
| `chat_message` | `{message}` | Persists and broadcasts to friends |
| `preferences` | `{preferences: {sharing_level}}` | Updates location sharing level |

### Server → Client Events

| Event | Source | Data |
|-------|--------|------|
| `friend_location` | Consumer | `{userId, name, lat, lon, accuracy, friends, skills, profilePicture}` |
| `public_location` | Consumer | `{userId, name, lat, lon, accuracy}` |
| `user_offline` | Consumer | `{userId}` |
| `friend_online` | Consumer | `{userId, name}` |
| `chat_message` | Consumer | `{message, sender, msgId, timestamp}` |
| `task_update` | ws_events | `{taskId, state, assignee, assigneeName, owner, datetimeStart, datetimeFinish, datetimePaused, action}` |
| `user_stats_update` | ws_events | `{coins, xp, totalCoinsEarned, totalXpEarned, taskStreak, level, levelProgress, skills}` |
| `achievement_earned` | ws_events | `{achievements: [{id, name, icon, description}]}` |
| `friend_request_received` | views | `{fromUser: {id, username}}` |
| `friend_request_accepted` | views | `{user: {id, username}}` |
| `friend_request_rejected` | views | `{userId}` |
| `friend_removed` | views | `{userId}` |
| `friend_details` | views | `{userId, name, friends, skills}` |
| `preferences_updated` | Consumer | `{status, preferences}` |

### Location Broadcasting

- **Sharing level `none`:** Location saved but never shared
- **Sharing level `friends`:** Detailed updates sent to each friend individually
- **Sharing level `all`:** Detailed updates to friends + basic update to `public_locations` group (single broadcast instead of per-user)

### Performance Optimizations

- Friends list cached on consumer instance, refreshed on friend accept/remove events
- User profile refreshed from DB every 60s (not every location ping)
- Public broadcast uses shared channel group (O(1) instead of O(N))

---

## Bug Reporting

Users can submit bug reports from within the app.

### Model: `BugReport`

| Field | Type | Description |
|-------|------|-------------|
| `user` | FK User | Who submitted |
| `description` | Text | User's description of the issue |
| `user_agent` | Char 500 | Auto-captured browser/OS string |
| `url` | Char 500 | Page URL when submitted |
| `screen_size` | Char 20 | e.g. "375x812" |
| `location` | Char 50 | GPS coordinates if available |
| `created_at` | DateTime | Submission timestamp |

### Model: `BugReportScreenshot`

Multiple screenshots can be attached to each report.

### UI

- **Mobile:** Circular bug icon button in top-left corner of the map
- **Desktop:** "Report Bug" button above "Center on Me" in bottom-right

Reports are only visible in Django admin (not shown to users).

---

## Admin Configuration

### GlobalConfig (Singleton)

All gamification and proximity parameters are controlled from Django admin.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `max_distance_km` | 1.0 | Maximum distance for location sharing |
| `task_proximity_km` | 0.2 | Radius to start/resume tasks (200m) |
| `coins_modifier` | 100.0 | Global coin reward multiplier |
| `xp_modifier` | 1.0 | Global XP reward multiplier |
| `time_modifier_minutes` | 15.0 | Minutes per reward unit |
| `criticality_percentage` | 0.10 | Bonus per criticality step (10%) |
| `pause_multiplier` | 1.0 | Max pause = minutes × this |
| `level_modifier` | 1.0 | XP requirement scaling |
| `welcome_message` | (default text) | Shown to new users on first login |

Configuration is cached for 60 seconds to reduce DB queries.

### Admin Panels

All models are registered with comprehensive list displays, filters, search, and inline editing where appropriate:

- **Users:** Stats, location, skills, friends, achievement inlines
- **Tasks:** Full field display with all state/reward/respawn fields
- **Tutorials:** Nested editing (Task → Parts → Questions → Answers)
- **Achievements:** Editable ordering, active toggle
- **Reviews:** Bulk accept/decline actions
- **Bug Reports:** Read-only with inline screenshots

---

## Authentication

### Google OAuth Flow

1. Frontend redirects to Google with client ID
2. Google redirects back to `/api/accounts/google/login/callback/` with authorization code
3. Backend exchanges code for ID token via Google's token endpoint
4. Backend verifies ID token signature and extracts email
5. Backend creates or finds User by email, updates profile picture
6. Backend creates DRF Token, redirects to `/?google_token=<token>`
7. Frontend stores token in `localStorage`, uses for all API calls

### API Authentication

All API endpoints use `TokenAuthentication`. The token is sent as:
```
Authorization: Token <key>
```

Session authentication is disabled to avoid CSRF issues with cross-origin requests.

---

## API Reference

All endpoints are prefixed with `/api/`.

### Tasks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks/` | List visible tasks + tutorials |
| POST | `/tasks/create` | Create task (admin only) |
| POST | `/task/<id>/start` | Start a task |
| POST | `/task/<id>/pause` | Pause current task |
| POST | `/task/<id>/resume` | Resume paused task |
| POST | `/task/<id>/finish` | Submit for review |
| POST | `/task/<id>/accept_review` | Accept review (owner/write) |
| POST | `/task/<id>/decline_review` | Decline review |
| POST | `/task/<id>/abandon` | Abandon task |
| POST | `/task/<id>/rate` | Rate completed task |
| POST | `/task/<id>/reset` | Debug reset (owner only) |

### Tutorials

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tutorial/<id>/` | Get tutorial with parts |
| POST | `/tutorial/<id>/submit/<part_id>/` | Submit a part answer |
| POST | `/tutorial_task/<id>/start` | Start tutorial |
| POST | `/tutorial_task/<id>/abandon` | Abandon tutorial |

### Friends

| Method | Path | Description |
|--------|------|-------------|
| GET | `/friends/` | List friends |
| GET | `/friends/pending/` | Incoming requests |
| GET | `/friends/sent/` | Outgoing requests |
| POST | `/friends/send/<user_id>/` | Send request |
| POST | `/friends/accept/<user_id>/` | Accept request |
| POST | `/friends/reject/<user_id>/` | Reject request |
| POST | `/friends/remove/<user_id>/` | Remove friend |

### User & Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/user/` | Current user details |
| POST | `/user/token/` | Username/password login |
| GET | `/auth/google-config/` | Google OAuth client ID |
| GET | `/accounts/google/login/callback/` | OAuth callback |
| GET | `/location/preferences/` | Get sharing settings |
| POST | `/location/preferences/` | Update sharing settings |

### Other

| Method | Path | Description |
|--------|------|-------------|
| GET | `/skills/` | List all skills |
| GET | `/achievements/` | List achievements + progress |
| GET | `/settings/proximity/` | Public config values |
| GET | `/settings/global/` | All config (superuser) |
| PATCH | `/settings/global/` | Update config (superuser) |
| GET | `/chat/history/` | Last 100 messages |
| GET | `/welcome/` | Welcome message |
| POST | `/welcome/accept/` | Mark welcome as seen |
| POST | `/bug-report/` | Submit bug report |

### WebSocket

| Path | Description |
|------|-------------|
| `ws://<host>/ws/location/?token=<key>` | Location, chat, and real-time events |

---

## Frontend Components

### Map Views
- **MapViewMobile** — Full-screen map with bottom sheets for task details, chat, and task list
- **MapViewDesktop** — Split layout with side panels for tasks, chat, and user info
- **MapView** — Shared map logic (legacy, being phased out)

### Task UI
- **TasksSidebar / TasksSidebarDesktop** — Filterable task list with distance, criticality, and skill matching
- **ActiveTaskPanel / ActiveTaskPanelDesktop** — Current task with timer, pause/resume/finish actions
- **CreateTaskModal / CreateTaskModalDesktop** — Admin task creation form with skill selection
- **TutorialPanel / TutorialPanelDesktop** — Step-through tutorial UI with quiz/password/file upload handling

### User & Social
- **UserInfoPanel / UserInfoPanelDesktop** — Level bar, coins, XP, skills, streak display
- **AccountModal / AccountModalDesktop** — Profile settings, location sharing preferences, logout
- **FriendRequestsModal / FriendRequestsModalDesktop** — Pending friend request management
- **AchievementsPanel / AchievementsPanelDesktop** — Achievement grid with progress bars

### Modals & Overlays
- **RatingModal** — Post-task happiness/time rating
- **WelcomeModal** — First-login onboarding message
- **BugReportModal** — Bug report with screenshot upload
- **AchievementToast** — Pop-up notification for newly earned achievements
- **BottomSheet** — Mobile slide-up panel component

### Utilities
- **Chat / ChatDesktop** — Real-time friend chat with message history
- **Legend / LegendDesktop** — Map icon legend
- **Login** — Google OAuth login screen
- **Icons** — SVG icon components (tasks, chat, person, center, plus, bug, etc.)
- **Skeleton** — Loading placeholder

---

## Themes & Map Tiles

### Themes

Two visual themes, switchable at runtime via CSS variables:

| Theme | Style | Colors |
|-------|-------|--------|
| `pipboy` | Fallout-inspired dark | Dark green/black, terminal aesthetic |
| `desert` | Egyptian gold warm | Warm beiges, gold accents |

### Map Tiles

| Theme | Primary | Fallback |
|-------|---------|----------|
| `pipboy` | Google Maps Night style | CartoDB dark_all |
| `desert` | Google Maps Retro style | CartoDB voyager |

Google Maps Tiles API requires `VITE_GOOGLE_MAPS_API_KEY`. If not set, falls back to free CartoDB tiles.

Google tile sessions last 23 hours with automatic renewal. Failed requests trigger a 5-minute backoff before retry.

---

## Deployment

### Production (Railway)

**Build pipeline:**
1. `npm install` + `npm run build` → React build in `client/dist/`
2. `collectstatic` → copies to `comrade/staticfiles/`
3. `migrate --noinput` → applies pending migrations
4. `daphne -b 0.0.0.0 -p $PORT comrade.asgi:application` → starts ASGI server

**Services:**
| Service | Details |
|---------|---------|
| App | Django/Daphne ASGI (serves API + WebSocket + React SPA) |
| Database | PostgreSQL (Railway plugin) |
| Redis | Redis (Railway plugin, external proxy) |

**Static files** served by WhiteNoise directly from Daphne. React SPA (`index.html`) served for all non-API/admin/static routes.

### Local Development

```bash
# Terminal 1 — Redis
redis-server

# Terminal 2 — Django
cd comrade && pipenv run python manage.py runserver    # :8000

# Terminal 3 — Vite
cd client && npm run dev                                # :3000
```

Access at **http://localhost:3000**. Vite proxies `/api`, `/ws`, `/media` to Django.

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | `True` (dev) / `False` (prod) |
| `ALLOWED_HOSTS` | Comma-separated hostnames |
| `DATABASE_URL` | PostgreSQL URL (prod only) |
| `REDIS_URL` | Redis URL |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key (optional) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated trusted origins |

### Monitoring

- **Backend errors:** Sentry SDK → Better Stack (`comrade_core` logger at INFO in prod)
- **Frontend errors:** Sentry React SDK → Better Stack (production only)
- **Frontend metrics:** Better Stack JS tag (web vitals, session replays)
