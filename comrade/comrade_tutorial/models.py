from comrade_core.models import Skill as CoreSkill
from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class TaskTemplate(models.Model):
    description = models.TextField()
    video_url = models.URLField()
    name = models.CharField(max_length=64)
    reward = models.ForeignKey("Reward", on_delete=models.SET_NULL)


class Reward(models.Model):
    skill = models.ForeignKey(CoreSkill, on_delete=models.RESTRICT)


class Task(models.Model):
    owner = models.ForeignKey(User, on_delete=models.SET_NULL)
    assignee = models.ForeignKey(User, on_delete=models.CASCADE)
    template = models.ForeignKey("TaskTemplate", on_delete=models.CASCADE)


class TaskSolutionPhoto(models.Model):
    task_solution = models.ForeignKey("TaskSolution", on_delete=models.CASCADE)
    file = models.FileField()
    description = models.TextField()


class TaskSolutionText(models.Model):
    task_solution = models.ForeignKey("TaskSolution", on_delete=models.CASCADE)


class TaskSolution(models.Model):
    task = models.ForeignKey("Task", on_delete=models.RESTRICT)
