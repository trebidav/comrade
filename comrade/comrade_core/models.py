from django.db import models
from django.utils.timezone import now
from django.core.validators import MaxValueValidator, MinValueValidator

class Skill(models.Model):
    title = models.CharField(max_length=32)
    def __str__(self) -> str:
        return self.title

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
        return self.title

    # basic info
    title = models.CharField(max_length=64, blank=True)
    description = models.CharField(max_length=200, blank=True)

    # permissions
    skill_read = models.ManyToManyField(Skill, related_name='read')
    skill_write = models.ManyToManyField(Skill, related_name='write')
    skill_execute = models.ManyToManyField(Skill, related_name='execute')

    # task state
    state = models.IntegerField(choices=State, default=1, blank=True)

    # location
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)
    respawn = models.BooleanField(default=False)

    # values
    base_value = models.FloatField(blank=True, null=True)
    criticality = models.IntegerField(choices=Criticality, default=1)
    contribution = models.FloatField(blank=True, null=True, validators=[MaxValueValidator(1.0), MinValueValidator(0.0)])

    # time tracking
    minutes = models.IntegerField(default=10, validators=[MaxValueValidator(480), MinValueValidator(1)])
    datetime_start = models.DateTimeField(auto_now_add=False, blank=True, null=True)
    datetime_finish  = models.DateTimeField(auto_now_add=False, blank=True, null=True)

    def start(self):
        self.state = 2
        self.datetime_start = now()
        self.save()

    def finish(self):
        self.datetime_finish = now()
        self.save()

    def rate(self):
        if self.state != 2:
            return False
        r = Review()
        r.task = self
        r.save()
        self.state=4
        self.save()

    def review(self):
        if self.state != 4:
            return False
        r = Review()
        r.task = self
        r.save()
        self.state=5
        self.save()

class Rating(models.Model):
    task = models.ForeignKey(Task, default=None, on_delete=models.RESTRICT, blank=True)
    happines = models.FloatField(default = 3)
    time = models.IntegerField(default = 10)
    def __str__(self) -> str:
        return "Rating of task \""+ self.task + "\""
    
class Review(models.Model):
    task = models.ForeignKey(Task, default=None, on_delete=models.RESTRICT, blank=True)
    done = models.FloatField(validators=[MaxValueValidator(1.0), MinValueValidator(0.0)])
    def __str__(self) -> str:
        return "Review of task \""+ self.task + "\""