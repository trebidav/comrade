import time as _time

from django.db import models


_config_cache = {'obj': None, 'ts': 0}
_CONFIG_TTL = 60  # seconds


class GlobalConfig(models.Model):
    """Global configuration for location sharing, task proximity, and rewards"""
    max_distance_km = models.FloatField(
        default=1.0,
        help_text="Maximum distance in kilometers for location sharing"
    )
    task_proximity_km = models.FloatField(
        default=0.2,
        help_text="Radius in kilometers within which a user can start/resume tasks"
    )
    coins_modifier = models.FloatField(
        default=100.0,
        help_text="Global multiplier applied to all coin rewards (coins 0–1 × this = final coins)"
    )
    criticality_percentage = models.FloatField(
        default=0.10,
        help_text="Bonus multiplier per criticality step: Low=+0%, Medium=+1×cp, High=+2×cp (e.g. 0.10 → Low×1.0, Medium×1.10, High×1.20)"
    )
    xp_modifier = models.FloatField(
        default=1.0,
        help_text="Global multiplier applied to all XP rewards (e.g. 2.0 = double XP)"
    )
    time_modifier_minutes = models.FloatField(
        default=15.0,
        help_text="Every this many minutes a task is worth, rewards are multiplied by 1 (e.g. task.minutes=45, modifier=15 → ×3)"
    )
    pause_multiplier = models.FloatField(
        default=1.0,
        help_text="Multiplier for stale pause timeout (task.minutes × this = minutes before auto-reset)"
    )
    level_modifier = models.FloatField(
        default=1.0,
        help_text="Multiplier for level XP requirements (base 1000 XP per level, +10% per level)"
    )
    welcome_message = models.TextField(
        blank=True,
        default=(
            "Welcome to Comrade!\n\n"
            "Here's how to get started:\n\n"
            "1. Complete tutorials on the map to gain new skills\n"
            "2. Skills unlock tasks — the more skills you have, the more tasks you can pick up\n"
            "3. Walk to a task location, start it, and follow the instructions to complete it\n"
            "4. After finishing a task, the task owner reviews your work\n"
            "5. Once approved, you earn Coins and XP as a reward\n"
            "6. Keep completing tasks to build streaks and unlock achievements\n\n"
            "The more skills you earn, the more opportunities open up. Good luck, Comrade!"
        ),
        help_text="Welcome message shown to users after login. Supports plain text with newlines."
    )
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Global Configuration"
        verbose_name_plural = "Global Configuration"

    @classmethod
    def get_config(cls):
        """Get or create the global configuration (cached for 60s)."""
        now_ts = _time.monotonic()
        if _config_cache['obj'] is not None and (now_ts - _config_cache['ts']) < _CONFIG_TTL:
            return _config_cache['obj']
        config, created = cls.objects.get_or_create(pk=1)
        _config_cache['obj'] = config
        _config_cache['ts'] = now_ts
        return config

    def __str__(self):
        return f"Global config (sharing: {self.max_distance_km}km, task proximity: {self.task_proximity_km}km)"
