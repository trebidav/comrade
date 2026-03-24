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
    """Broadcast task state change to owner and assignee (excluding the actor)."""
    event = {
        "type": "task_update",
        "task_id": task.id,
        "state": task.state,
        "assignee": task.assignee_id,
        "assignee_name": _display_name(task.assignee) if task.assignee else None,
        "owner": task.owner_id,
        "datetime_start": task.datetime_start.isoformat() if task.datetime_start else None,
        "datetime_finish": task.datetime_finish.isoformat() if task.datetime_finish else None,
        "datetime_paused": task.datetime_paused.isoformat() if task.datetime_paused else None,
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


def send_user_stats(user):
    """Push updated coins/XP/level/skills to a specific user."""
    event = {
        "type": "user_stats_update",
        "coins": float(user.coins),
        "xp": float(user.xp),
        "total_coins_earned": float(user.total_coins_earned),
        "total_xp_earned": float(user.total_xp_earned),
        "task_streak": user.task_streak,
        "level": user.level,
        "level_progress": user.level_progress,
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


def send_friend_event(target_user_id: int, event: dict):
    """Send a friend-system event to a specific user."""
    _send_to_user(target_user_id, event)
