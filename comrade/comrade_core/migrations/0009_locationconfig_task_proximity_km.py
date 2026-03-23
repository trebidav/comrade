from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comrade_core', '0008_update_review'),
    ]

    operations = [
        migrations.AddField(
            model_name='locationconfig',
            name='task_proximity_km',
            field=models.FloatField(default=1.0, help_text='Radius in kilometers within which a user can start/resume tasks'),
        ),
    ]
