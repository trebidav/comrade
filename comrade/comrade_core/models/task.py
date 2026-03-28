import datetime
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.timezone import now

from .config import GlobalConfig


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
    skill_read = models.ManyToManyField("Skill", related_name="read", blank=True)
    skill_write = models.ManyToManyField("Skill", related_name="write", blank=True)
    skill_execute = models.ManyToManyField("Skill", related_name="execute", blank=True)

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

    def start(self, user):
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

    def pause(self, user):
        if user != self.assignee:
            raise ValidationError("Only assignee can pause the task")

        if self.state != Task.State.IN_PROGRESS:
            raise ValidationError("Task is not in progress")

        self._accumulate_time()
        self.state = Task.State.WAITING
        self.datetime_paused = now()
        self.save(update_fields=['state', 'time_spent_minutes', 'datetime_start', 'datetime_paused'])

    def resume(self, user):
        if self.state != Task.State.WAITING:
            raise ValidationError("Task is not waiting")

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

    def finish(self, user):
        if self.state != Task.State.IN_PROGRESS:
            raise ValidationError("Task is not in progress")

        if user != self.owner and user != self.assignee:
            raise ValidationError("Only owner and assignee can finish the task")

        self._accumulate_time()
        self.datetime_finish = now()
        self.state = Task.State.IN_REVIEW
        self.save()

    def _can_review(self, user) -> bool:
        if self.owner is None:
            return True  # No owner = auto-accept allowed by anyone
        if user == self.owner:
            return True
        if user == self.assignee:
            return False
        write_skills = self.skill_write.all()
        return write_skills.exists() and user.skills.filter(id__in=write_skills).exists()

    def accept_review(self, user) -> list:
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
            config = GlobalConfig.get_config()
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

    def decline_review(self, user):
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

    def abandon(self, user):
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
        """Abandon WAITING tasks that have been paused longer than their estimated minutes x pause_multiplier."""
        from datetime import timedelta as _td
        from django.db.models import F, ExpressionWrapper, DurationField
        config = GlobalConfig.get_config()
        cutoff = ExpressionWrapper(
            _td(minutes=1) * F('minutes') * config.pause_multiplier,
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
