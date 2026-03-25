from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models

from ..utils import haversine_km, compute_level
from .config import LocationConfig


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
        """Compute current level from total_xp_earned."""
        config = LocationConfig.get_config()
        lvl, _, _ = compute_level(self.total_xp_earned, config.level_modifier)
        return lvl

    @property
    def level_progress(self) -> dict:
        """Return current level, XP into current level, and XP required for next level."""
        config = LocationConfig.get_config()
        lvl, current_xp, required_xp = compute_level(self.total_xp_earned, config.level_modifier)
        return {'level': lvl, 'current_xp': current_xp, 'required_xp': required_xp}

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
        from .achievement import Achievement, UserAchievement
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
        """Calculate distance to another user in kilometers."""
        return haversine_km(self.latitude, self.longitude, other_user.latitude, other_user.longitude)
