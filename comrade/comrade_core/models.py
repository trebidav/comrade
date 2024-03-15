from django.db import models


class Task(models.Model):
    title = models.CharField(max_length=64)
    description = models.CharField(max_length=200)

    lat = models.FloatField(null=True)
    lon = models.FloatField(null=True)

    # state

    # criticality
    # contribution_factor
    # difficulty

    # computed_value
    # base_value
