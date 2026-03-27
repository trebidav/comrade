from django.core.management.base import BaseCommand
from comrade_core.models import (
    Skill, Task, TutorialTask, TutorialPart, TutorialQuestion, TutorialAnswer,
    OnboardingTemplate,
)


class Command(BaseCommand):
    help = "Create onboarding tutorial chain + regular tasks for new users"

    def handle(self, *args, **options):
        # ── Skills ──
        explorer, _ = Skill.objects.get_or_create(name='Explorer')
        tasker, _ = Skill.objects.get_or_create(name='Tasker')
        critic, _ = Skill.objects.get_or_create(name='Critic')
        self.stdout.write(f"Skills: Explorer={explorer.id}, Tasker={tasker.id}, Critic={critic.id}")

        # ── Tutorial 1: What is Comrade? ──
        t1, created = TutorialTask.objects.get_or_create(
            name='What is Comrade?',
            defaults={'description': 'Learn what Comrade is all about', 'reward_skill': explorer},
        )
        if created:
            TutorialPart.objects.create(
                tutorial=t1, type='text', order=0,
                title='Welcome, Comrade!',
                text_content=(
                    "Comrade turns your neighborhood into a game.\n\n"
                    "Walk around, discover tasks on the map, earn skills, "
                    "and level up. Every task you complete earns you coins and XP.\n\n"
                    "Complete tutorials to unlock new skills — "
                    "skills open doors to more tasks and bigger rewards.\n\n"
                    "Ready? Let's start with a little puzzle..."
                ),
            )
            TutorialPart.objects.create(
                tutorial=t1, type='password', order=1,
                title='Unscramble this!',
                text_content='Unscramble these letters to reveal the name of the app:\n\nD - A - R - M - O - C - E',
                password='COMRADE',
            )
            self.stdout.write(self.style.SUCCESS(f"  Tutorial 1 created: {t1.name} (id={t1.id})"))
        else:
            self.stdout.write(f"  Tutorial 1 exists: {t1.name} (id={t1.id})")

        # ── Tutorial 2: How Tasks Work ──
        t2, created = TutorialTask.objects.get_or_create(
            name='How Tasks Work',
            defaults={'description': 'Learn how to pick up and complete tasks', 'reward_skill': tasker},
        )
        if created:
            t2.skill_execute.add(explorer)
            TutorialPart.objects.create(
                tutorial=t2, type='text', order=0,
                title='Tasks 101',
                text_content=(
                    "See those pins on the map? Each one is a task waiting for you.\n\n"
                    "1. Walk to a task location\n"
                    "2. Tap it and hit Start\n"
                    "3. Follow the instructions and finish it\n"
                    "4. Wait for the task owner to approve your work\n"
                    "5. Boom — coins and XP!\n\n"
                    "Some tasks need specific skills to start. "
                    "Complete more tutorials to unlock them.\n\n"
                    "Tip: Keep a streak going! Finishing tasks without "
                    "abandoning builds your streak multiplier."
                ),
            )
            self.stdout.write(self.style.SUCCESS(f"  Tutorial 2 created: {t2.name} (id={t2.id})"))
        else:
            self.stdout.write(f"  Tutorial 2 exists: {t2.name} (id={t2.id})")

        # ── Tutorial 3: Tell Us What You Think! ──
        t3, created = TutorialTask.objects.get_or_create(
            name='Tell Us What You Think!',
            defaults={'description': 'Rate your experience so far', 'reward_skill': critic},
        )
        if created:
            t3.skill_execute.add(tasker)
            quiz_part = TutorialPart.objects.create(
                tutorial=t3, type='quiz', order=0,
                title='Quick rating',
                text_content='How do you like Comrade so far?',
            )
            q = TutorialQuestion.objects.create(part=quiz_part, text='How do you like Comrade so far?', order=0)
            for i, label in enumerate(['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'], 1):
                TutorialAnswer.objects.create(question=q, text=label, is_correct=True, order=i)
            self.stdout.write(self.style.SUCCESS(f"  Tutorial 3 created: {t3.name} (id={t3.id})"))
        else:
            self.stdout.write(f"  Tutorial 3 exists: {t3.name} (id={t3.id})")

        # ── Onboarding Templates (tutorials) ──
        for order, tutorial in enumerate([t1, t2, t3]):
            obj, created = OnboardingTemplate.objects.get_or_create(
                tutorial=tutorial,
                defaults={'order': order, 'spawn_radius_meters': 150, 'is_active': True},
            )
            label = "created" if created else "exists"
            self.stdout.write(f"  OnboardingTemplate {label}: order={order} → {tutorial.name}")

        # ── Regular Tasks (ownerless, auto-accept) ──
        task1, created = Task.objects.get_or_create(
            name='Find Something Cool Nearby',
            defaults={
                'description': 'Take a photo of something interesting within 100m of this spot.',
                'state': Task.State.OPEN,
                'owner': None,
                'coins': 0.3,
                'xp': 0.2,
                'minutes': 10,
                'criticality': Task.Criticality.LOW,
                'require_photo': True,
            },
        )
        if created:
            task1.skill_read.add(explorer)
            self.stdout.write(self.style.SUCCESS(f"  Task created: {task1.name} (id={task1.id})"))
        else:
            self.stdout.write(f"  Task exists: {task1.name} (id={task1.id})")

        task2, created = Task.objects.get_or_create(
            name='Leave a Message for the Comrades',
            defaults={
                'description': 'Write a message for the Comrades. What would you tell them?',
                'state': Task.State.OPEN,
                'owner': None,
                'coins': 0.2,
                'xp': 0.3,
                'minutes': 5,
                'criticality': Task.Criticality.LOW,
                'require_comment': True,
            },
        )
        if created:
            task2.skill_read.add(tasker)
            self.stdout.write(self.style.SUCCESS(f"  Task created: {task2.name} (id={task2.id})"))
        else:
            self.stdout.write(f"  Task exists: {task2.name} (id={task2.id})")

        # ── Onboarding Templates (tasks) ──
        for order_offset, task_obj in enumerate([task1, task2], start=len([t1, t2, t3])):
            obj, created = OnboardingTemplate.objects.get_or_create(
                task=task_obj,
                defaults={'order': order_offset, 'spawn_radius_meters': 200, 'is_active': True},
            )
            label = "created" if created else "exists"
            self.stdout.write(f"  OnboardingTemplate {label}: order={order_offset} → {task_obj.name}")

        self.stdout.write(self.style.SUCCESS("\nOnboarding setup complete!"))
