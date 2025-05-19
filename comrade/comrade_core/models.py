import datetime
import math

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.timezone import now


class LocationConfig(models.Model):
    """Global configuration for location sharing"""
    max_distance_km = models.FloatField(
        default=1.0,  # Default 1km radius
        help_text="Maximum distance in kilometers for location sharing"
    )
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Location Configuration"
        verbose_name_plural = "Location Configuration"

    @classmethod
    def get_config(cls):
        """Get or create the global configuration"""
        config, created = cls.objects.get_or_create(pk=1)
        return config

    def __str__(self):
        return f"Location sharing config (max distance: {self.max_distance_km}km)"


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
