# Generated by Django 5.0.3 on 2024-03-10 08:03

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("comrade_core", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="task",
            old_name="description_text",
            new_name="description",
        ),
        migrations.AddField(
            model_name="task",
            name="title",
            field=models.CharField(default="test", max_length=64),
            preserve_default=False,
        ),
    ]
