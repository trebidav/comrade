import datetime

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.timezone import now


class User(AbstractUser):
    def __str__(self) -> str:
        return self.username

    skills = models.ManyToManyField("Skill", blank=True)

    latitude = models.FloatField(blank=True, default=0)
    longitude = models.FloatField(blank=True, default=0)

    timestamp = models.DateTimeField(auto_now_add=True)

    def has_skill(self, skill_name):
        return self.skills.filter(name=skill_name).exists()


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
    skill_read = models.ManyToManyField(Skill, related_name="read")
    skill_write = models.ManyToManyField(Skill, related_name="write")
    skill_execute = models.ManyToManyField(Skill, related_name="execute")

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
    respawn_time = models.TimeField(default=datetime.time(10, 0, 0))

    # values
    base_value = models.FloatField(blank=True, null=True)
    criticality = models.IntegerField(choices=Criticality, default=1)
    contribution = models.FloatField(
        blank=True,
        null=True,
        validators=[MaxValueValidator(1.0), MinValueValidator(0.0)],
    )

    # time tracking
    minutes = models.IntegerField(
        default=10, validators=[MaxValueValidator(480), MinValueValidator(1)]
    )
    datetime_start = models.DateTimeField(auto_now_add=False, blank=True, null=True)
    datetime_finish = models.DateTimeField(auto_now_add=False, blank=True, null=True)

    def start(self, user: User):
        if user == self.owner:
            raise ValidationError("Owner cannot start the task")
        if self.state != Task.State.OPEN:
            raise ValidationError("Task is not open")

        has_required_skills = user.skills.filter(
            id__in=self.skill_execute.all()
        ).exists()

        if not has_required_skills:
            raise ValidationError("User does not have required skills")

        self.state = Task.State.IN_PROGRESS
        self.datetime_start = now()
        self.assignee = user
        self.save()

    def pause(self, user: User):
        if user != self.assignee:
            raise ValidationError("Only assignee can pause the task")

        if self.state != Task.State.IN_PROGRESS:
            return False
        
        self.state = Task.State.WAITING
        self.save()

    def resume(self, user: User):
        if self.state != Task.State.WAITING:
            return False
        
        if user != self.assignee:
            raise ValidationError("Only assignee can resume the task")
        
        self.state = Task.State.IN_PROGRESS
        self.save()

    def finish(self, user: User):
        if self.state != Task.State.IN_PROGRESS:
            return False

        if user != self.owner or user != self.assignee:
            raise ValidationError("Only owner and assignee can finish the task")

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


class Rating(models.Model):
    task = models.ForeignKey(
        "comrade_core.Task", default=None, on_delete=models.RESTRICT, blank=True
    )
    happiness = models.FloatField(default=1)
    time = models.FloatField(default=1)

    def __str__(self) -> str:
        return 'Rating of task "' + self.task + '"'


class Review(models.Model):
    task = models.ForeignKey(
        "comrade_core.Task", default=None, on_delete=models.RESTRICT, blank=True
    )
    done = models.FloatField(
        validators=[MaxValueValidator(1.0), MinValueValidator(0.0)]
    )

    def __str__(self) -> str:
        return 'Review of task "' + self.task + '"'
