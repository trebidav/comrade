"""
WebSocket event broadcast utilities.

Call these from synchronous Django views to push real-time events
to connected users via the LocationConsumer channel groups.
"""

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def _send_to_user(user_id: int, event: dict):
    """Send a WebSocket event to a specific user's channel group."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(f"location_{user_id}", event)


def _display_name(user) -> str:
    return f"{user.first_name} {user.last_name}".strip() or user.username


def send_task_update(task, action: str, exclude_user_id: int | None = None):
    """Broadcast task state change to owner and assignee (excluding the actor).

    Also sends tasks_changed to all connected users so their task lists refresh.
    """
    event = {
        "type": "task_update",
        "taskId": task.id,
        "state": task.state,
        "assignee": task.assignee_id,
        "assigneeName": _display_name(task.assignee) if task.assignee else None,
        "owner": task.owner_id,
        "datetimeStart": task.datetime_start.isoformat() if task.datetime_start else None,
        "datetimeFinish": task.datetime_finish.isoformat() if task.datetime_finish else None,
        "datetimePaused": task.datetime_paused.isoformat() if task.datetime_paused else None,
        "action": action,
    }
    recipients = set()
    if task.owner_id:
        recipients.add(task.owner_id)
    if task.assignee_id:
        recipients.add(task.assignee_id)
    if exclude_user_id:
        recipients.discard(exclude_user_id)
    for uid in recipients:
        _send_to_user(uid, event)
    # Notify all users that task list has changed
    send_tasks_changed()


def send_user_stats(user):
    """Push updated coins/XP/level/skills to a specific user."""
    event = {
        "type": "user_stats_update",
        "coins": float(user.coins),
        "xp": float(user.xp),
        "totalCoinsEarned": float(user.total_coins_earned),
        "totalXpEarned": float(user.total_xp_earned),
        "taskStreak": user.task_streak,
        "level": user.level,
        "levelProgress": user.level_progress,
        "skills": list(user.skills.values_list('name', flat=True)),
    }
    _send_to_user(user.id, event)


def send_achievements(user_id: int, achievements: list):
    """Push newly earned achievements to the correct user via WebSocket."""
    if not achievements:
        return
    event = {
        "type": "achievement_earned",
        "achievements": [
            {"id": a.id, "name": a.name, "icon": a.icon, "description": a.description}
            for a in achievements
        ],
    }
    _send_to_user(user_id, event)


def send_tutorial_review_accepted(user_id: int, tutorial_id: int, tutorial_name: str, reward_skill_name: str):
    """Notify user their tutorial review was accepted."""
    _send_to_user(user_id, {
        "type": "tutorial_review_accepted",
        "tutorialId": tutorial_id,
        "tutorialName": tutorial_name,
        "rewardSkillName": reward_skill_name,
    })


def send_tutorial_review_declined(user_id: int, tutorial_id: int, tutorial_name: str, reason: str):
    """Notify user their tutorial review was declined."""
    _send_to_user(user_id, {
        "type": "tutorial_review_declined",
        "tutorialId": tutorial_id,
        "tutorialName": tutorial_name,
        "reason": reason,
    })


def send_tasks_changed():
    """Broadcast to all connected users that the task list has changed.

    This is a lightweight signal — the frontend debounces and re-fetches /api/tasks/.
    Use for changes that affect task visibility across multiple users (e.g., task creation,
    state changes, skill-based visibility changes).
    """
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)('public_locations', {
        "type": "tasks_changed",
    })


def send_friend_event(target_user_id: int, event: dict):
    """Send a friend-system event to a specific user."""
    _send_to_user(target_user_id, event)
