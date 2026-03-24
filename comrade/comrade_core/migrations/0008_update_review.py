from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('comrade_core', '0007_alter_task_skill_execute_alter_task_skill_read_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='review',
            name='done',
        ),
        migrations.AddField(
            model_name='review',
            name='comment',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='review',
            name='photo',
            field=models.FileField(blank=True, null=True, upload_to='review_photos/'),
        ),
        migrations.AddField(
            model_name='review',
            name='status',
            field=models.CharField(
                choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('declined', 'Declined')],
                default='pending',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='review',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='review',
            name='task',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='reviews',
                to='comrade_core.task',
            ),
        ),
    ]
