from django.db import models
from django.utils.timezone import now


class TutorialTask(models.Model):
    """Standalone tutorial task — not linked to the regular Task model."""
    name = models.CharField(max_length=64)
    description = models.CharField(max_length=200, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)
    reward_skill = models.ForeignKey('Skill', on_delete=models.CASCADE, related_name='tutorial_rewards')
    skill_execute = models.ManyToManyField('Skill', blank=True, related_name='tutorial_tasks_execute')
    owner = models.ForeignKey(
        'comrade_core.User', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='owned_tutorials',
        help_text="If set, tutorial completion requires owner review before skill is awarded",
    )

    def __str__(self):
        return f"Tutorial: {self.name} → {self.reward_skill.name}"


class TutorialPart(models.Model):
    class Type(models.TextChoices):
        TEXT = 'text', 'Text Page'
        VIDEO = 'video', 'Video Page'
        QUIZ = 'quiz', 'Quiz Page'
        PASSWORD = 'password', 'Password Page'
        FILE_UPLOAD = 'file_upload', 'File Upload Page'
        FREETEXT = 'freetext', 'Free Text Page'

    tutorial = models.ForeignKey(TutorialTask, on_delete=models.CASCADE, related_name='parts')
    type = models.CharField(max_length=20, choices=Type.choices)
    title = models.CharField(max_length=200, blank=True)
    order = models.PositiveIntegerField(default=0)

    # Text / Video
    text_content = models.TextField(blank=True, help_text="Content for Text page type (markdown supported)")
    video_url = models.URLField(blank=True, help_text="Video URL for Video page type")

    # Password
    password = models.CharField(max_length=200, blank=True, help_text="Correct password for Password page type")

    # Freetext
    freetext_min_length = models.PositiveIntegerField(default=0, help_text="Minimum characters for Freetext (0 = empty accepted)")
    freetext_max_length = models.PositiveIntegerField(default=1000, help_text="Maximum characters for Freetext")

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

    class ReviewStatus(models.TextChoices):
        PENDING = 'pending', 'Pending Review'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'

    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='tutorial_progress')
    tutorial = models.ForeignKey(TutorialTask, on_delete=models.CASCADE, related_name='progress')
    state = models.IntegerField(choices=State.choices, default=State.IN_PROGRESS)
    completed_parts = models.ManyToManyField(TutorialPart, blank=True)
    datetime_start = models.DateTimeField(default=now)
    datetime_finish = models.DateTimeField(null=True, blank=True)
    review_status = models.CharField(
        max_length=10, choices=ReviewStatus.choices, null=True, blank=True, default=None,
        help_text="Set to 'pending' when tutorial has an owner requiring review",
    )

    class Meta:
        unique_together = ['user', 'tutorial']

    def __str__(self):
        return f"{self.user.username} – {self.tutorial.name}"

    def is_complete(self):
        total = self.tutorial.parts.count()
        return total > 0 and self.completed_parts.count() >= total


class TutorialReview(models.Model):
    """Per-user review submission for tutorials with owners."""
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'

    tutorial = models.ForeignKey(TutorialTask, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='tutorial_reviews')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"TutorialReview: {self.user.username} – {self.tutorial.name} [{self.status}]"


class OnboardingTemplate(models.Model):
    """Admin-configured template: which items to spawn when a user accepts T&C.

    Set either `tutorial` or `task` (not both). The chosen item is spawned
    at a random position around the user on T&C acceptance.
    """
    tutorial = models.ForeignKey(
        TutorialTask, null=True, blank=True, on_delete=models.CASCADE,
        related_name='onboarding_templates',
    )
    task = models.ForeignKey(
        'comrade_core.Task', null=True, blank=True, on_delete=models.CASCADE,
        related_name='onboarding_templates',
    )
    order = models.PositiveIntegerField(default=0)
    spawn_radius_meters = models.PositiveIntegerField(default=100, help_text="Max distance from user to spawn")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        item = self.tutorial or self.task
        return f"Onboarding #{self.order}: {item}"


class UserOnboardingTutorial(models.Model):
    """Per-user spawned tutorial instance with personalized location."""
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='onboarding_tutorials')
    tutorial = models.ForeignKey(TutorialTask, on_delete=models.CASCADE, related_name='user_onboarding')
    lat = models.FloatField()
    lon = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'tutorial']

    def __str__(self):
        return f"{self.user.username} – {self.tutorial.name} @ ({self.lat:.5f}, {self.lon:.5f})"


class UserOnboardingTask(models.Model):
    """Per-user spawned task instance with personalized location."""
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='onboarding_tasks')
    task = models.ForeignKey('comrade_core.Task', on_delete=models.CASCADE, related_name='user_onboarding')
    lat = models.FloatField()
    lon = models.FloatField()
    completed = models.BooleanField(default=False, help_text="Set to True when user finishes this task (persists through respawn)")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'task']

    def __str__(self):
        return f"{self.user.username} – {self.task.name} @ ({self.lat:.5f}, {self.lon:.5f})"
