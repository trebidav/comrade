import datetime
import math
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.timezone import now


class LocationConfig(models.Model):
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
        """Get or create the global configuration"""
        config, created = cls.objects.get_or_create(pk=1)
        return config

    def __str__(self):
        return f"Location config (sharing: {self.max_distance_km}km, task proximity: {self.task_proximity_km}km)"


class User(AbstractUser):
    class SharingLevel(models.TextChoices):
        NONE = 'none', 'No sharing'
        FRIENDS = 'friends', 'Share with friends'
        ALL = 'all', 'Share with everyone'

    def __str__(self) -> str:
        return self.username

    skills = models.ManyToManyField("Skill", blank=True)

    latitude = models.FloatField(blank=True, default=0)
    longitude = models.FloatField(blank=True, default=0)

    coins = models.FloatField(default=0)
    xp = models.FloatField(default=0)

    # Achievement tracking stats
    total_coins_earned = models.FloatField(default=0, help_text="Running total of all coins ever earned")
    total_xp_earned = models.FloatField(default=0, help_text="Running total of all XP ever earned")
    task_streak = models.IntegerField(default=0, help_text="Consecutive task completions without abandoning")

    timestamp = models.DateTimeField(auto_now_add=True)

    # Location sharing preferences
    location_sharing_level = models.CharField(
        max_length=10,
        choices=SharingLevel.choices,
        default=SharingLevel.ALL
    )
    location_share_with = models.ManyToManyField(
        'self',
        related_name='shared_locations',
        blank=True,
        symmetrical=False
    )
    location_preferences_updated = models.DateTimeField(auto_now=True)

    welcome_accepted = models.BooleanField(default=False, help_text="Whether the user has accepted the welcome message")

    profile_picture = models.URLField(blank=True, default='', help_text="URL to user's profile picture (e.g. from Google)")

    # Friends management
    friends = models.ManyToManyField(
        'self',
        blank=True,
        symmetrical=True
    )
    friend_requests_sent = models.ManyToManyField(
        'self',
        related_name='friend_requests_received',
        blank=True,
        symmetrical=False
    )

    @property
    def level(self) -> int:
        """Compute current level from total_xp_earned. Base 1000 XP per level, +10% per level, scaled by level_modifier."""
        config = LocationConfig.get_config()
        modifier = config.level_modifier if config.level_modifier > 0 else 1.0
        xp = self.total_xp_earned
        lvl = 0
        required = 1000.0 * modifier
        while xp >= required:
            xp -= required
            lvl += 1
            required = 1000.0 * modifier * (1.1 ** lvl)
        return lvl

    @property
    def level_progress(self) -> dict:
        """Return current level, XP into current level, and XP required for next level."""
        config = LocationConfig.get_config()
        modifier = config.level_modifier if config.level_modifier > 0 else 1.0
        xp = self.total_xp_earned
        lvl = 0
        required = 1000.0 * modifier
        while xp >= required:
            xp -= required
            lvl += 1
            required = 1000.0 * modifier * (1.1 ** lvl)
        return {'level': lvl, 'current_xp': xp, 'required_xp': required}

    def has_skill(self, skill_name):
        return self.skills.filter(name=skill_name).exists()

    def get_location_sharing_preferences(self):
        """Get current location sharing preferences"""
        return {
            'sharing_level': self.location_sharing_level,
            'share_with_users': list(self.location_share_with.values_list('id', flat=True))
        }

    def update_location_sharing_preferences(self, sharing_level=None, share_with_users=None):
        """Update location sharing preferences"""
        if sharing_level in dict(self.SharingLevel.choices):
            self.location_sharing_level = sharing_level
        
        if share_with_users is not None:
            self.location_share_with.set(share_with_users)
        
        self.save()

    # Friend management methods
    def send_friend_request(self, user):
        """Send a friend request to another user"""
        if user == self:
            raise ValidationError("Cannot send friend request to yourself")
        if user in self.friends.all():
            raise ValidationError("Already friends with this user")
        if user in self.friend_requests_sent.all():
            raise ValidationError("Friend request already sent")
        if self in user.friend_requests_sent.all():
            raise ValidationError("This user has already sent you a friend request")
        
        self.friend_requests_sent.add(user)
        return True

    def accept_friend_request(self, user):
        """Accept a friend request from another user"""
        if user not in self.friend_requests_received.all():
            raise ValidationError("No friend request from this user")
        
        self.friends.add(user)
        self.friend_requests_received.remove(user)
        return True

    def reject_friend_request(self, user):
        """Reject a friend request from another user"""
        if user not in self.friend_requests_received.all():
            raise ValidationError("No friend request from this user")
        
        self.friend_requests_received.remove(user)
        return True

    def remove_friend(self, user):
        """Remove a friend"""
        if user not in self.friends.all():
            raise ValidationError("Not friends with this user")
        
        self.friends.remove(user)
        return True

    def get_friends(self):
        """Get list of friends"""
        return self.friends.all()

    def get_pending_friend_requests(self):
        """Get list of pending friend requests"""
        return self.friend_requests_received.all()

    def get_sent_friend_requests(self):
        """Get list of sent friend requests"""
        return self.friend_requests_sent.all()

    def is_friend_with(self, user):
        """Check if user is friends with another user"""
        return user in self.friends.all()

    def has_pending_request_from(self, user):
        """Check if user has a pending friend request from another user"""
        return user in self.friend_requests_received.all()

    def has_sent_request_to(self, user):
        """Check if user has sent a friend request to another user"""
        return user in self.friend_requests_sent.all()

    def check_and_award_achievements(self) -> list:
        """Check all active achievements and award newly unlocked ones. Returns list of newly awarded Achievement objects."""
        earned_ids = set(self.user_achievements.values_list('achievement_id', flat=True))
        new_awards = []
        for achievement in Achievement.objects.filter(is_active=True).exclude(id__in=earned_ids):
            progress = achievement.compute_progress(self)
            if progress >= achievement.condition_value:
                UserAchievement.objects.create(user=self, achievement=achievement, progress=progress)
                update_fields = []
                if achievement.reward_coins > 0:
                    self.coins = models.F('coins') + achievement.reward_coins
                    self.total_coins_earned = models.F('total_coins_earned') + achievement.reward_coins
                    update_fields.extend(['coins', 'total_coins_earned'])
                if achievement.reward_xp > 0:
                    self.xp = models.F('xp') + achievement.reward_xp
                    self.total_xp_earned = models.F('total_xp_earned') + achievement.reward_xp
                    update_fields.extend(['xp', 'total_xp_earned'])
                if update_fields:
                    self.save(update_fields=update_fields)
                    self.refresh_from_db()
                if achievement.reward_skill:
                    self.skills.add(achievement.reward_skill)
                new_awards.append(achievement)
        return new_awards

    def distance_to(self, other_user):
        """Calculate distance to another user in kilometers using Haversine formula"""
        from math import radians, sin, cos, sqrt, atan2

        # Convert latitude and longitude to radians
        lat1, lon1 = radians(self.latitude), radians(self.longitude)
        lat2, lon2 = radians(other_user.latitude), radians(other_user.longitude)

        # Haversine formula
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance = 6371 * c  # Earth's radius in km * c

        return distance

    def get_nearby_users(self):
        """Get users within the configured distance"""
        config = LocationConfig.get_config()
        nearby_users = []
        
        for user in User.objects.exclude(id=self.id):
            if user.location_sharing_level == User.SharingLevel.ALL:
                distance = self.distance_to(user)
                if distance <= config.max_distance_km:
                    nearby_users.append(user)
        
        return nearby_users


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class Skill(models.Model):
    name = models.CharField(max_length=32)

    def __str__(self) -> str:
        return self.name


class Task(models.Model):
    class Criticality(models.IntegerChoices):
        LOW = 1
        MEDIUM = 2
        HIGH = 3

    class State(models.IntegerChoices):
        UNAVAILABLE = 0
        OPEN = 1
        IN_PROGRESS = 2
        WAITING = 3
        IN_REVIEW = 4
        DONE = 5

    def __str__(self) -> str:
        return self.name

    # basic info
    name = models.CharField(max_length=64, blank=False)
    description = models.CharField(max_length=200, blank=True)

    # permissions
    skill_read = models.ManyToManyField(Skill, related_name="read", blank=True)
    skill_write = models.ManyToManyField(Skill, related_name="write", blank=True)
    skill_execute = models.ManyToManyField(Skill, related_name="execute", blank=True)

    # task state
    state = models.IntegerField(choices=State, default=1, blank=True)
    owner = models.ForeignKey(
        "comrade_core.User",
        null=True,
        blank=True,
        on_delete=models.RESTRICT,
        related_name="owned_tasks",
    )
    assignee = models.ForeignKey(
        "comrade_core.User",
        null=True,
        blank=True,
        on_delete=models.RESTRICT,
        related_name="assigned_tasks",
    )

    # location
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)

    # respawn
    respawn = models.BooleanField(default=False)
    respawn_time = models.TimeField(
        default=datetime.time(10, 0, 0),
        help_text="Fixed time of day when the task respawns (used when respawn_offset is not set)"
    )
    respawn_offset = models.IntegerField(
        null=True, blank=True,
        help_text="Minutes after task completion to respawn. If set, overrides respawn_time."
    )
    datetime_respawn = models.DateTimeField(
        null=True, blank=True,
        help_text="Computed datetime when this task will next become Open again"
    )

    # values
    coins = models.FloatField(
        blank=True,
        null=True,
        validators=[MaxValueValidator(1.0), MinValueValidator(0.0)],
    )
    criticality = models.IntegerField(choices=Criticality, default=1)
    xp = models.FloatField(
        blank=True,
        null=True,
        validators=[MaxValueValidator(1.0), MinValueValidator(0.0)],
    )

    # completion
    photo = models.FileField(upload_to='task_photos/', null=True, blank=True)
    require_photo = models.BooleanField(default=False)
    require_comment = models.BooleanField(default=False)
    time_spent_minutes = models.FloatField(null=True, blank=True, help_text="Actual time spent, reported by assignee on finish")

    # time tracking
    minutes = models.IntegerField(
        default=10, validators=[MaxValueValidator(480), MinValueValidator(1)]
    )
    datetime_start = models.DateTimeField(auto_now_add=False, blank=True, null=True)
    datetime_finish = models.DateTimeField(auto_now_add=False, blank=True, null=True)
    datetime_paused = models.DateTimeField(null=True, blank=True, help_text="When the task entered WAITING state")

    def start(self, user: User):
        if user == self.owner:
            raise ValidationError("Owner cannot start the task")
        if self.state != Task.State.OPEN:
            raise ValidationError("Task is not open")

        required_skills = self.skill_execute.all()
        if required_skills.exists():
            has_all_skills = user.skills.filter(id__in=required_skills).count() == required_skills.count()
            if not has_all_skills:
                raise ValidationError("User does not have required skills")

        # Pause any task currently in progress for this user
        for other in Task.objects.filter(assignee=user, state=Task.State.IN_PROGRESS):
            other._accumulate_time()
            other.state = Task.State.WAITING
            other.datetime_paused = now()
            other.save(update_fields=['state', 'time_spent_minutes', 'datetime_start', 'datetime_paused'])

        self.state = Task.State.IN_PROGRESS
        self.datetime_start = now()
        self.datetime_paused = None
        self.time_spent_minutes = None
        self.assignee = user
        self.save()

    def _accumulate_time(self):
        """Add elapsed time since datetime_start into time_spent_minutes."""
        if self.datetime_start is not None:
            elapsed_minutes = (now() - self.datetime_start).total_seconds() / 60
            self.time_spent_minutes = (self.time_spent_minutes or 0) + elapsed_minutes
            self.datetime_start = None

    def pause(self, user: User):
        if user != self.assignee:
            raise ValidationError("Only assignee can pause the task")

        if self.state != Task.State.IN_PROGRESS:
            return False

        self._accumulate_time()
        self.state = Task.State.WAITING
        self.datetime_paused = now()
        self.save(update_fields=['state', 'time_spent_minutes', 'datetime_start', 'datetime_paused'])

    def resume(self, user: User):
        if self.state != Task.State.WAITING:
            return False

        if user != self.assignee:
            raise ValidationError("Only assignee can resume the task")

        # Pause any other in-progress task for this user (accumulate their time first)
        for other in Task.objects.filter(assignee=user, state=Task.State.IN_PROGRESS).exclude(pk=self.pk):
            other._accumulate_time()
            other.state = Task.State.WAITING
            other.datetime_paused = now()
            other.save(update_fields=['state', 'time_spent_minutes', 'datetime_start', 'datetime_paused'])

        self.state = Task.State.IN_PROGRESS
        self.datetime_start = now()
        self.datetime_paused = None
        self.save(update_fields=['state', 'datetime_start', 'datetime_paused'])

    def finish(self, user: User):
        if self.state != Task.State.IN_PROGRESS:
            return False

        if user != self.owner and user != self.assignee:
            raise ValidationError("Only owner and assignee can finish the task")

        self._accumulate_time()
        self.datetime_finish = now()
        self.state = Task.State.IN_REVIEW
        self.save()

    def review(self, user: User):
        if self.state != Task.State.IN_REVIEW:
            return False

        if user == self.owner:
            raise ValidationError("Owner cannot review the task")

        has_required_skills = user.skills.filter(
            id__in=self.skill_write.all()
        ).exists()
        if not has_required_skills:
            raise ValidationError("User does not have required skills")

        r = Review(done=1)
        r.task = self
        r.save()
        self.state = Task.State.DONE
        self.save()

    def _can_review(self, user: 'User') -> bool:
        if user == self.owner:
            return True
        if user == self.assignee:
            return False
        write_skills = self.skill_write.all()
        return write_skills.exists() and user.skills.filter(id__in=write_skills).exists()

    def accept_review(self, user: 'User') -> list:
        if self.state != Task.State.IN_REVIEW:
            raise ValidationError("Task is not in review")
        if not self._can_review(user):
            raise ValidationError("Only the owner or a user with the required write skill can accept a review")
        self.reviews.filter(status='pending').update(status='accepted')
        self.state = Task.State.DONE
        if self.time_spent_minutes is not None:
            self.minutes = max(1, round((self.minutes + self.time_spent_minutes) / 2))
        self._schedule_respawn()
        self.save()
        new_achievements = []
        if self.assignee is not None:
            update_fields = []
            config = LocationConfig.get_config()
            time_multiplier = (self.minutes / config.time_modifier_minutes) if config.time_modifier_minutes > 0 else 1.0
            criticality_factor = 1.0 + (self.criticality - 1) * config.criticality_percentage
            if self.coins is not None:
                earned_coins = self.coins * config.coins_modifier * time_multiplier
                self.assignee.coins = models.F('coins') + earned_coins
                self.assignee.total_coins_earned = models.F('total_coins_earned') + earned_coins
                update_fields.extend(['coins', 'total_coins_earned'])
            if self.xp is not None:
                earned_xp = self.xp * config.xp_modifier * time_multiplier * criticality_factor
                self.assignee.xp = models.F('xp') + earned_xp
                self.assignee.total_xp_earned = models.F('total_xp_earned') + earned_xp
                update_fields.extend(['xp', 'total_xp_earned'])
            self.assignee.task_streak = models.F('task_streak') + 1
            update_fields.append('task_streak')
            self.assignee.save(update_fields=update_fields)
            self.assignee.refresh_from_db()
            new_achievements = self.assignee.check_and_award_achievements()
        return new_achievements

    def decline_review(self, user: 'User'):
        if self.state != Task.State.IN_REVIEW:
            raise ValidationError("Task is not in review")
        if not self._can_review(user):
            raise ValidationError("Only the owner or a user with the required write skill can decline a review")
        self.reviews.filter(status='pending').update(status='declined')
        self.state = Task.State.OPEN
        self.assignee = None
        self.datetime_start = None
        self.datetime_finish = None
        self.save()

    def abandon(self, user: User):
        if user != self.assignee:
            raise ValidationError("Only the assignee can abandon the task")
        if self.state not in (Task.State.IN_PROGRESS, Task.State.WAITING):
            raise ValidationError("Task cannot be abandoned in its current state")
        user.task_streak = 0
        user.save(update_fields=['task_streak'])
        self.state = Task.State.OPEN
        self.assignee = None
        self.datetime_start = None
        self.save()

    def _schedule_respawn(self):
        """Set datetime_respawn based on respawn_offset or fixed respawn_time."""
        if not self.respawn:
            return
        if self.respawn_offset is not None:
            self.datetime_respawn = now() + timedelta(minutes=self.respawn_offset)
        else:
            today = now().date()
            tz = now().tzinfo
            respawn_dt = datetime.datetime.combine(today, self.respawn_time).replace(tzinfo=tz)
            if respawn_dt <= now():
                respawn_dt += timedelta(days=1)
            self.datetime_respawn = respawn_dt

    @classmethod
    def check_and_respawn(cls):
        """Reset all DONE tasks whose respawn time has passed back to OPEN."""
        cls.objects.filter(
            respawn=True,
            state=cls.State.DONE,
            datetime_respawn__lte=now(),
        ).update(
            state=cls.State.OPEN,
            assignee=None,
            datetime_start=None,
            datetime_finish=None,
            time_spent_minutes=None,
            photo='',
        )

    @classmethod
    def check_and_reset_stale(cls):
        """Abandon WAITING tasks that have been paused longer than their estimated minutes × pause_multiplier."""
        config = LocationConfig.get_config()
        stale = cls.objects.filter(
            state=cls.State.WAITING,
            datetime_paused__isnull=False,
        ).select_related('assignee')
        for task in stale:
            paused_minutes = (now() - task.datetime_paused).total_seconds() / 60
            if paused_minutes >= task.minutes * config.pause_multiplier:
                task.state = cls.State.OPEN
                task.assignee = None
                task.datetime_start = None
                task.datetime_paused = None
                task.time_spent_minutes = None
                task.save(update_fields=['state', 'assignee', 'datetime_start', 'datetime_paused', 'time_spent_minutes'])

    def debug_reset(self):
        """Debug method to reset task to OPEN state"""
        self.state = Task.State.OPEN
        self.assignee = None
        self.datetime_start = None
        self.datetime_finish = None
        self.save()
        self.reviews.filter(status=Review.Status.PENDING).delete()


class Rating(models.Model):
    task = models.ForeignKey(
        "comrade_core.Task", default=None, on_delete=models.RESTRICT, blank=True
    )
    user = models.ForeignKey(
        "comrade_core.User", null=True, blank=True, on_delete=models.SET_NULL
    )
    happiness = models.FloatField(default=1)
    time = models.FloatField(default=1)
    feedback = models.TextField(blank=True, default="")

    def __str__(self) -> str:
        return f'Rating of task "{self.task}"'


class Review(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'

    task = models.ForeignKey(
        "comrade_core.Task", on_delete=models.CASCADE, related_name='reviews'
    )
    comment = models.TextField(blank=True, default='')
    photo = models.FileField(upload_to='review_photos/', null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'Review of task "{self.task}" [{self.status}]'


# ── Achievement models ─────────────────────────────────────────────────────────

class Achievement(models.Model):
    CONDITION_TASK_COUNT = 'task_count'
    CONDITION_TASK_COUNT_SKILL = 'task_count_skill'
    CONDITION_TASK_COUNT_CRITICALITY = 'task_count_criticality'
    CONDITION_TASK_STREAK = 'task_streak'
    CONDITION_XP_TOTAL = 'xp_total'
    CONDITION_COINS_TOTAL = 'coins_total'
    CONDITION_SKILL_COUNT = 'skill_count'
    CONDITION_TUTORIAL_COUNT = 'tutorial_count'
    CONDITION_TASKS_CREATED = 'tasks_created'
    CONDITION_RATINGS_GIVEN = 'ratings_given'
    CONDITION_FRIENDS_COUNT = 'friends_count'

    CONDITION_CHOICES = [
        (CONDITION_TASK_COUNT, 'Total tasks completed'),
        (CONDITION_TASK_COUNT_SKILL, 'Tasks completed with specific skill (filter: skill_name)'),
        (CONDITION_TASK_COUNT_CRITICALITY, 'Tasks completed with min criticality (filter: min_criticality)'),
        (CONDITION_TASK_STREAK, 'Consecutive task streak (no abandons)'),
        (CONDITION_XP_TOTAL, 'Total XP ever earned'),
        (CONDITION_COINS_TOTAL, 'Total coins ever earned'),
        (CONDITION_SKILL_COUNT, 'Number of skills owned'),
        (CONDITION_TUTORIAL_COUNT, 'Tutorials completed'),
        (CONDITION_TASKS_CREATED, 'Tasks created by user'),
        (CONDITION_RATINGS_GIVEN, 'Ratings given'),
        (CONDITION_FRIENDS_COUNT, 'Number of friends'),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=10, blank=True, help_text='Emoji icon shown in UI')

    condition_type = models.CharField(max_length=50, choices=CONDITION_CHOICES)
    condition_value = models.FloatField(help_text='Threshold value to unlock this achievement')
    condition_filter = models.JSONField(
        null=True, blank=True,
        help_text='Extra filter params as JSON, e.g. {"skill_name": "Medical"} or {"min_criticality": 2}'
    )

    reward_coins = models.FloatField(default=0, help_text='Bonus coins awarded on unlock')
    reward_xp = models.FloatField(default=0, help_text='Bonus XP awarded on unlock')
    reward_skill = models.ForeignKey(
        'Skill', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='achievement_rewards',
        help_text='Skill granted on unlock (optional)'
    )

    is_secret = models.BooleanField(default=False, help_text='Hidden until unlocked')
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0, help_text='Display order')

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        prefix = f'{self.icon} ' if self.icon else ''
        return f'{prefix}{self.name}'

    def compute_progress(self, user) -> float:
        """Return user's current progress value toward this achievement's threshold."""
        f = self.condition_filter or {}
        ct = self.condition_type

        if ct == self.CONDITION_TASK_COUNT:
            return Task.objects.filter(assignee=user, state=Task.State.DONE).count()

        if ct == self.CONDITION_TASK_COUNT_SKILL:
            skill_name = f.get('skill_name', '')
            return Task.objects.filter(
                assignee=user, state=Task.State.DONE, skill_execute__name=skill_name
            ).distinct().count()

        if ct == self.CONDITION_TASK_COUNT_CRITICALITY:
            min_crit = f.get('min_criticality', 1)
            return Task.objects.filter(
                assignee=user, state=Task.State.DONE, criticality__gte=min_crit
            ).count()

        if ct == self.CONDITION_TASK_STREAK:
            return user.task_streak

        if ct == self.CONDITION_XP_TOTAL:
            return user.total_xp_earned

        if ct == self.CONDITION_COINS_TOTAL:
            return user.total_coins_earned

        if ct == self.CONDITION_SKILL_COUNT:
            return user.skills.count()

        if ct == self.CONDITION_TUTORIAL_COUNT:
            return TutorialProgress.objects.filter(user=user, state=TutorialProgress.State.DONE).count()

        if ct == self.CONDITION_TASKS_CREATED:
            return Task.objects.filter(owner=user).count()

        if ct == self.CONDITION_RATINGS_GIVEN:
            return Rating.objects.filter(user=user).count()

        if ct == self.CONDITION_FRIENDS_COUNT:
            return user.friends.count()

        return 0


class UserAchievement(models.Model):
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='user_achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name='user_achievements')
    datetime_earned = models.DateTimeField(auto_now_add=True)
    progress = models.FloatField(default=0, help_text='Progress value at time of earning')

    class Meta:
        unique_together = ['user', 'achievement']
        ordering = ['-datetime_earned']

    def __str__(self):
        return f'{self.user.username} – {self.achievement.name}'


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatMessage(models.Model):
    sender = models.ForeignKey('User', on_delete=models.CASCADE, related_name='chat_messages')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender.username}: {self.text[:50]}'


# ── Tutorial models ────────────────────────────────────────────────────────────

class TutorialTask(models.Model):
    """Standalone tutorial task — not linked to the regular Task model."""
    name = models.CharField(max_length=64)
    description = models.CharField(max_length=200, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)
    reward_skill = models.ForeignKey('Skill', on_delete=models.CASCADE, related_name='tutorial_rewards')
    skill_execute = models.ManyToManyField('Skill', blank=True, related_name='tutorial_tasks_execute')

    def __str__(self):
        return f"Tutorial: {self.name} → {self.reward_skill.name}"


class TutorialPart(models.Model):
    class Type(models.TextChoices):
        TEXT = 'text', 'Text Page'
        VIDEO = 'video', 'Video Page'
        QUIZ = 'quiz', 'Quiz Page'
        PASSWORD = 'password', 'Password Page'
        FILE_UPLOAD = 'file_upload', 'File Upload Page'

    tutorial = models.ForeignKey(TutorialTask, on_delete=models.CASCADE, related_name='parts')
    type = models.CharField(max_length=20, choices=Type.choices)
    title = models.CharField(max_length=200, blank=True)
    order = models.PositiveIntegerField(default=0)

    # Text / Video
    text_content = models.TextField(blank=True, help_text="Content for Text page type (markdown supported)")
    video_url = models.URLField(blank=True, help_text="Video URL for Video page type")

    # Password
    password = models.CharField(max_length=200, blank=True, help_text="Correct password for Password page type")

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Part {self.order}: {self.get_type_display()} – {self.title or self.tutorial.name}"


class TutorialQuestion(models.Model):
    part = models.ForeignKey(TutorialPart, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField()
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.text[:60]


class TutorialAnswer(models.Model):
    question = models.ForeignKey(TutorialQuestion, on_delete=models.CASCADE, related_name='answers')
    text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{'✓' if self.is_correct else '✗'} {self.text[:40]}"


class TutorialProgress(models.Model):
    class State(models.IntegerChoices):
        IN_PROGRESS = 2, 'In Progress'
        DONE = 5, 'Done'

    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='tutorial_progress')
    tutorial = models.ForeignKey(TutorialTask, on_delete=models.CASCADE, related_name='progress')
    state = models.IntegerField(choices=State.choices, default=State.IN_PROGRESS)
    completed_parts = models.ManyToManyField(TutorialPart, blank=True)
    datetime_start = models.DateTimeField(default=now)
    datetime_finish = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['user', 'tutorial']

    def __str__(self):
        return f"{self.user.username} – {self.tutorial.name}"

    def is_complete(self):
        total = self.tutorial.parts.count()
        return total > 0 and self.completed_parts.count() >= total
