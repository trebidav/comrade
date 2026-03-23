# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (Django)
```bash
# From /comrade/comrade/ (the Django project root, where manage.py lives)
pipenv shell
pipenv sync
python manage.py runserver          # Start dev server on :8000
python manage.py makemigrations     # After any model changes
python manage.py migrate            # Apply migrations
python manage.py test               # Run tests
pytest                              # Alternative test runner
```

### Frontend (React/Vite)
```bash
# From /comrade/client/
npm install
npm run dev     # Start dev server on :3000 (proxies /api, /ws, /media to :8000)
npm run build   # Production build to dist/
```

### Required Services
Redis must be running on localhost:6379 for WebSocket channels to work.

### After any backend change
Always run `makemigrations` + `migrate` + restart the backend.

## Architecture Overview

**Comrade** is a gamified, location-based community task manager with a pip-boy (Fallout-inspired) dark green UI theme.

### Stack
- **Backend**: Django 5 + Django REST Framework + Django Channels (WebSockets via Redis)
- **Frontend**: React 19 + TypeScript + Vite + Leaflet (maps) + Tailwind CSS v4
- **Auth**: Google OAuth via django-allauth → returns DRF Token, stored in `localStorage`
- **DB**: SQLite (dev)

### Project Layout
```
comrade/          ← Django project config (settings.py, urls.py, asgi.py)
comrade_core/     ← Main app (models, views, serializers, consumers, urls)
client/           ← React frontend (Vite)
  src/
    api.ts              ← Axios instance + all TypeScript types + utility functions
    components/         ← All React UI components
    hooks/              ← useLocationSocket.ts, useChatSocket.ts
```

### URL / API Structure
The Vite dev server proxies `/api`, `/ws`, `/media` to Django on :8000.

Key API paths (all under `/api/` prefix via Django):
- `GET /tasks/` — returns both regular tasks + tutorial tasks merged in one list
- `POST /task/<id>/<action>` — start, finish, pause, resume, abandon, rate
- `POST /tutorial_task/<id>/start|abandon` — tutorial-specific lifecycle
- `GET /tutorial/<id>/`, `POST /tutorial/<id>/submit/<partId>/` — tutorial step-through
- `GET /skills/` — list all skills
- `WS /ws/location/` — real-time location + chat (token auth via query param)

### Key Models (`comrade_core/models.py`)
- **User** (extends AbstractUser): has `skills` (M2M), `friends` (M2M), `latitude/longitude`, `location_sharing_level`
- **Task**: `state` (0=Unavailable, 1=Open, 2=InProgress, 3=Waiting, 4=InReview, 5=Done), `skill_read/write/execute` (M2M), `owner/assignee` FKs
- **TutorialTask**: standalone model (not linked to Task), has `reward_skill`, `skill_execute`. Visible to users who don't yet have `reward_skill`.
- **TutorialPart**: `type` = text | video | quiz | password | file_upload
- **TutorialProgress**: per-user tutorial state (IN_PROGRESS=2, DONE=5), `completed_parts` M2M
- **Rating**, **Review**: post-task feedback models

### Tutorial Task ID Offset
To avoid React key collisions between Task PKs and TutorialTask PKs, the serializer adds `TUTORIAL_ID_OFFSET = 100000` to all TutorialTask IDs. Frontend uses `realTaskId(task)` (from `api.ts`) to strip the offset before making API calls.

### Task List Response
`TaskListView` merges regular tasks and tutorial tasks into one array:
```python
return Response({"tasks": list(task_serializer.data) + list(tutorial_serializer.data)})
```
All items share the `Task` TypeScript interface; tutorials set `is_tutorial: true` and use `in_progress` (bool) instead of `state`/`assignee`.

### Active Task Detection (Frontend)
```ts
tasks.find(t => t.is_tutorial ? t.in_progress : (t.state === 2 && t.assignee === user.id))
```

### WebSocket (Location)
`useLocationSocket.ts` connects to `ws://localhost:8000/ws/location/?token=<token>`, sends GPS every 5s and heartbeats. Receives friend/public locations and chat messages. `LocationConsumer` in `consumers.py` broadcasts based on each user's `location_sharing_level`.

### Django Admin
Every model field must appear in the admin (`list_display`, `list_filter`, `fieldsets`). See `comrade_core/admin.py`.


# Comrade: OpenSource task manager for any community. Gamified.

### Main idea

Comrade App is a community-driven task management platform designed to empower users by organizing and coordinating execution of location-based tasks. With real-time updates and skill-based task assignments, it enhances collaboration, streamlines task management, and fosters active community involvement.

The app is tailored for community workers, volunteers, and organizations that prioritize efficient task coordination. This includes non-profit organizations, local community groups, event planners, and individuals eager to contribute to community service.

Using an interactive map, users can easily locate tasks that align with their skills and proximity. By encouraging skill development, the platform ensures tasks are matched with qualified individuals

### Possible ways to use:

- **Disaster Response Coordination:** In the event of a natural disaster, community organizations can use the app to assign tasks such as delivering supplies, providing medical assistance, or coordinating evacuations based on the skills of volunteers.
- **Local Business Support:** Small businesses can post tasks for community members to assist with, such as promoting their services, helping with deliveries, or organizing events, thereby fostering local economic growth.
- **Environmental Initiatives:** Users can participate in environmental cleanup efforts, tree planting, or conservation projects, with tasks assigned based on skills like landscaping or environmental science.
- **Event Planning and Management:** Organizers can create tasks for community events (e.g., festivals, fairs) and assign roles to volunteers based on their skills, ensuring that all aspects of the event are covered efficiently.
- **P2P Work:** Users with specific skills can offer to solve problems and Comrade can facilitate task assignments, review and reward.

### Key features include:

- Map based user interface
- Interactions with location-based tasks
- Real-time updates on task availability and locations of other users
- Community chat and notifications for seamless communication and coordination
- Gamification elements introduce rewards, achievements, and game-like features to create a more engaging user experience
- Reward system

# MVP – Looking for contributors!

First milestone is to reach MVP stage by implementing the minimal required functionality so the application can be demonstrated in a very simplified way.

## Basic functionality

- **User Authentication:** Secure login using Google OAuth, providing users with an API token for subsequent requests.
- **Skill Management:** Users can have multiple skills, which determine their eligibility to pick up tasks.
- **Real-Time Location Tracking:** Users can send their GPS location through WebSockets, allowing the app to reflect their current position on a map.
- **Task Management:** Users can create, manage and execute tasks based on skill requirements.
- **Interactive Map View:** Tasks are displayed on a map, making it easy for users to find and navigate to nearby tasks.


## MVP issues

Issues that should be addressed in the MVP are tracked in the milestone:

https://github.com/trebidav/comrade/milestone/1

## Contributing

**Currently looking for contributors!** 
- Django & Django-rest framework developers
- JavaScript & React developers
- Software Architects and Game Designers

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.


Feel free to comment on the Issues or contribute with ideas if you don't know where to start.

# Install

Use `pipenv` for dependency management 
```
brew install pipenv
```

Run `pre-commit` hooks before opening MR
```
brew install pre-commit
```

Run server
```
pipenv shell
pipenv sync
cd comrade
python manage.py runserver
```

# License

Comrade © 2024 by David Trebicky is licensed under [CC BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/)
