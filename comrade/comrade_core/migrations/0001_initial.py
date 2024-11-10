# Generated by Django 5.0.9 on 2024-11-10 13:53

import datetime
import django.contrib.auth.models
import django.contrib.auth.validators
import django.core.validators
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="Skill",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=32)),
            ],
        ),
        migrations.CreateModel(
            name="User",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("password", models.CharField(max_length=128, verbose_name="password")),
                (
                    "last_login",
                    models.DateTimeField(
                        blank=True, null=True, verbose_name="last login"
                    ),
                ),
                (
                    "is_superuser",
                    models.BooleanField(
                        default=False,
                        help_text="Designates that this user has all permissions without explicitly assigning them.",
                        verbose_name="superuser status",
                    ),
                ),
                (
                    "username",
                    models.CharField(
                        error_messages={
                            "unique": "A user with that username already exists."
                        },
                        help_text="Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.",
                        max_length=150,
                        unique=True,
                        validators=[
                            django.contrib.auth.validators.UnicodeUsernameValidator()
                        ],
                        verbose_name="username",
                    ),
                ),
                (
                    "first_name",
                    models.CharField(
                        blank=True, max_length=150, verbose_name="first name"
                    ),
                ),
                (
                    "last_name",
                    models.CharField(
                        blank=True, max_length=150, verbose_name="last name"
                    ),
                ),
                (
                    "email",
                    models.EmailField(
                        blank=True, max_length=254, verbose_name="email address"
                    ),
                ),
                (
                    "is_staff",
                    models.BooleanField(
                        default=False,
                        help_text="Designates whether the user can log into this admin site.",
                        verbose_name="staff status",
                    ),
                ),
                (
                    "is_active",
                    models.BooleanField(
                        default=True,
                        help_text="Designates whether this user should be treated as active. Unselect this instead of deleting accounts.",
                        verbose_name="active",
                    ),
                ),
                (
                    "date_joined",
                    models.DateTimeField(
                        default=django.utils.timezone.now, verbose_name="date joined"
                    ),
                ),
                ("latitude", models.FloatField(blank=True)),
                ("longitude", models.FloatField(blank=True)),
                ("timestamp", models.DateTimeField(auto_now_add=True)),
                (
                    "groups",
                    models.ManyToManyField(
                        blank=True,
                        help_text="The groups this user belongs to. A user will get all permissions granted to each of their groups.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.group",
                        verbose_name="groups",
                    ),
                ),
                (
                    "user_permissions",
                    models.ManyToManyField(
                        blank=True,
                        help_text="Specific permissions for this user.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.permission",
                        verbose_name="user permissions",
                    ),
                ),
                ("skills", models.ManyToManyField(blank=True, to="comrade_core.skill")),
            ],
            options={
                "verbose_name": "user",
                "verbose_name_plural": "users",
                "abstract": False,
            },
            managers=[
                ("objects", django.contrib.auth.models.UserManager()),
            ],
        ),
        migrations.CreateModel(
            name="Task",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=64)),
                ("description", models.CharField(blank=True, max_length=200)),
                (
                    "state",
                    models.IntegerField(
                        blank=True,
                        choices=[
                            (0, "Unavailable"),
                            (1, "Open"),
                            (2, "In Progress"),
                            (3, "Waiting"),
                            (4, "In Review"),
                            (5, "Done"),
                        ],
                        default=1,
                    ),
                ),
                ("lat", models.FloatField(blank=True, null=True)),
                ("lon", models.FloatField(blank=True, null=True)),
                ("respawn", models.BooleanField(default=False)),
                ("respawn_time", models.TimeField(default=datetime.time(10, 0))),
                ("base_value", models.FloatField(blank=True, null=True)),
                (
                    "criticality",
                    models.IntegerField(
                        choices=[(1, "Low"), (2, "Medium"), (3, "High")], default=1
                    ),
                ),
                (
                    "contribution",
                    models.FloatField(
                        blank=True,
                        null=True,
                        validators=[
                            django.core.validators.MaxValueValidator(1.0),
                            django.core.validators.MinValueValidator(0.0),
                        ],
                    ),
                ),
                (
                    "minutes",
                    models.IntegerField(
                        default=10,
                        validators=[
                            django.core.validators.MaxValueValidator(480),
                            django.core.validators.MinValueValidator(1),
                        ],
                    ),
                ),
                ("datetime_start", models.DateTimeField(blank=True, null=True)),
                ("datetime_finish", models.DateTimeField(blank=True, null=True)),
                (
                    "assignee",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.RESTRICT,
                        related_name="assigned_tasks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.RESTRICT,
                        related_name="owned_tasks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "skill_execute",
                    models.ManyToManyField(
                        related_name="execute", to="comrade_core.skill"
                    ),
                ),
                (
                    "skill_read",
                    models.ManyToManyField(
                        related_name="read", to="comrade_core.skill"
                    ),
                ),
                (
                    "skill_write",
                    models.ManyToManyField(
                        related_name="write", to="comrade_core.skill"
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Review",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "done",
                    models.FloatField(
                        validators=[
                            django.core.validators.MaxValueValidator(1.0),
                            django.core.validators.MinValueValidator(0.0),
                        ]
                    ),
                ),
                (
                    "task",
                    models.ForeignKey(
                        blank=True,
                        default=None,
                        on_delete=django.db.models.deletion.RESTRICT,
                        to="comrade_core.task",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Rating",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("happiness", models.FloatField(default=1)),
                ("time", models.FloatField(default=1)),
                (
                    "task",
                    models.ForeignKey(
                        blank=True,
                        default=None,
                        on_delete=django.db.models.deletion.RESTRICT,
                        to="comrade_core.task",
                    ),
                ),
            ],
        ),
    ]
