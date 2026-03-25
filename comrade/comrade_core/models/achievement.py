from django.db import models


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
        from .task import Task, Rating
        from .tutorial import TutorialProgress

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
