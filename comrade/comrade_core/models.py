from django.db import models

class Task(models.Model):
    name = models.CharField(max_length=200)
    description_text = models.CharField(max_length=200)
