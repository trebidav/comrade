from django.db import models
from django.utils.timezone import now


class TutorialTask(models.Model):
    """Standalone tutorial task -- not linked to the regular Task model."""
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
