import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comrade_core', '0010_tutorial_models'),
    ]

    operations = [
        # 1. Remove old task FK and add new standalone fields to TutorialTask
        migrations.RemoveField(model_name='tutorialtask', name='task'),
        migrations.AddField(
            model_name='tutorialtask',
            name='name',
            field=models.CharField(default='', max_length=64),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='tutorialtask',
            name='description',
            field=models.CharField(blank=True, max_length=200, default=''),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='tutorialtask',
            name='lat',
            field=models.FloatField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='tutorialtask',
            name='lon',
            field=models.FloatField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='tutorialtask',
            name='owner',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='owned_tutorial_tasks',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='tutorialtask',
            name='skill_execute',
            field=models.ManyToManyField(
                blank=True,
                related_name='tutorial_tasks_execute',
                to='comrade_core.skill',
            ),
        ),

        # 2. Update TutorialProgress: add state, datetime_start, datetime_finish
        migrations.AddField(
            model_name='tutorialprogress',
            name='state',
            field=models.IntegerField(
                choices=[(2, 'In Progress'), (5, 'Done')],
                default=2,
            ),
        ),
        migrations.AddField(
            model_name='tutorialprogress',
            name='datetime_start',
            field=models.DateTimeField(default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='tutorialprogress',
            name='datetime_finish',
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]
