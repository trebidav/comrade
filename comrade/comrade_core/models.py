from django.db import models

class Task(models.Model):
    description_text = models.CharField(max_length=200)