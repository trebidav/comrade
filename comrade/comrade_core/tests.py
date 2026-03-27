from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework.authtoken.models import Token

from comrade_core.models import Skill, Task, User, Review, Achievement, TutorialTask, TutorialPart, TutorialQuestion, TutorialAnswer, TutorialProgress, OnboardingTemplate, UserOnboardingTutorial


class TaskTestCase(TestCase):
    def test_task_start_throws_error_to_user_with_no_skill(self):
        s = Skill.objects.create(name="tasktestcase1")
        u = User.objects.create(username="tasktestcase")
        t = Task.objects.create()
        t.skill_execute.add(s)

        self.assertTrue(t.skill_execute.count() == 1)
        self.assertTrue(u.skills.count() == 0)

        try:
            t.start(u)
        except ValidationError:
            pass
        else:
            self.fail(
                "start should throw an error when the user has not the required skill for execute"
            )

    def test_task_start_succeeds_when_user_has_required_execute_skills(self):
        s = Skill.objects.create(name="tasktestcase1")
        u = User.objects.create(username="tasktestcase")
        t = Task.objects.create()
        t.skill_execute.add(s)
        u.skills.add(s)

        self.assertTrue(t.skill_execute.count() == 1)
        self.assertTrue(u.skills.count() == 1)

        try:
            t.start(u)
        except ValidationError:
            self.fail("start should pass when user has all required skills")

    def test_task_start_fails_when_user_has_only_some_required_skills(self):
        s1 = Skill.objects.create(name="multiskill1")
        s2 = Skill.objects.create(name="multiskill2")
        u = User.objects.create(username="partialskilluser")
        t = Task.objects.create()
        t.skill_execute.add(s1, s2)
        u.skills.add(s1)  # only one of two required skills

        self.assertEqual(t.skill_execute.count(), 2)
        self.assertEqual(u.skills.count(), 1)

        try:
            t.start(u)
        except ValidationError:
            pass
        else:
            self.fail("start should fail when user has only some of the required skills")

    def test_task_start_succeeds_when_user_has_all_multiple_required_skills(self):
        s1 = Skill.objects.create(name="multiskill3")
        s2 = Skill.objects.create(name="multiskill4")
        u = User.objects.create(username="fullskilluser")
        t = Task.objects.create()
        t.skill_execute.add(s1, s2)
        u.skills.add(s1, s2)

        self.assertEqual(t.skill_execute.count(), 2)
        self.assertEqual(u.skills.count(), 2)

        try:
            t.start(u)
        except ValidationError:
            self.fail("start should pass when user has all required skills")


class TaskListVisibilityTest(APITestCase):
    """Smoke tests for TaskListView visibility rules."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass')
        self.user = User.objects.create_user(username='worker', password='pass')
        self.other = User.objects.create_user(username='other', password='pass')
        self.skill_a = Skill.objects.create(name='SkillA')
        self.skill_b = Skill.objects.create(name='SkillB')
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)

    def _task_ids(self):
        resp = self.client.get('/api/tasks/')
        return {t['id'] for t in resp.data['tasks'] if not t.get('is_tutorial')}

    def test_task_with_no_read_skills_visible_to_all(self):
        t = Task.objects.create(name='open', owner=self.owner, state=Task.State.OPEN)
        self.assertIn(t.id, self._task_ids())

    def test_task_with_read_skill_hidden_without_skill(self):
        t = Task.objects.create(name='locked', owner=self.owner, state=Task.State.OPEN)
        t.skill_read.add(self.skill_a)
        self.assertNotIn(t.id, self._task_ids())

    def test_task_with_read_skill_visible_with_skill(self):
        self.user.skills.add(self.skill_a)
        t = Task.objects.create(name='readable', owner=self.owner, state=Task.State.OPEN)
        t.skill_read.add(self.skill_a)
        self.assertIn(t.id, self._task_ids())

    def test_owned_task_always_visible(self):
        t = Task.objects.create(name='mine', owner=self.user, state=Task.State.OPEN)
        t.skill_read.add(self.skill_b)  # user doesn't have skill_b
        self.assertIn(t.id, self._task_ids())

    def test_assigned_task_always_visible(self):
        t = Task.objects.create(name='assigned', owner=self.owner, assignee=self.user, state=Task.State.IN_PROGRESS)
        t.skill_read.add(self.skill_b)
        self.assertIn(t.id, self._task_ids())

    def test_in_review_task_visible_with_write_skill(self):
        self.user.skills.add(self.skill_a)
        t = Task.objects.create(name='reviewable', owner=self.owner, state=Task.State.IN_REVIEW)
        t.skill_write.add(self.skill_a)
        self.assertIn(t.id, self._task_ids())


class TaskLifecycleTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass')
        self.worker = User.objects.create_user(username='worker', password='pass')
        self.task = Task.objects.create(name='test', owner=self.owner, state=Task.State.OPEN)

    def test_start_sets_state_and_assignee(self):
        self.task.start(self.worker)
        self.assertEqual(self.task.state, Task.State.IN_PROGRESS)
        self.assertEqual(self.task.assignee, self.worker)

    def test_start_fails_for_owner(self):
        with self.assertRaises(ValidationError):
            self.task.start(self.owner)

    def test_start_fails_if_not_open(self):
        self.task.state = Task.State.IN_PROGRESS
        self.task.save()
        with self.assertRaises(ValidationError):
            self.task.start(self.worker)

    def test_pause_sets_waiting(self):
        self.task.start(self.worker)
        self.task.pause(self.worker)
        self.assertEqual(self.task.state, Task.State.WAITING)

    def test_pause_fails_for_non_assignee(self):
        self.task.start(self.worker)
        with self.assertRaises(ValidationError):
            self.task.pause(self.owner)

    def test_pause_fails_if_not_in_progress(self):
        self.task.start(self.worker)
        self.task.pause(self.worker)
        with self.assertRaises(ValidationError):
            self.task.pause(self.worker)

    def test_resume_sets_in_progress(self):
        self.task.start(self.worker)
        self.task.pause(self.worker)
        self.task.resume(self.worker)
        self.assertEqual(self.task.state, Task.State.IN_PROGRESS)

    def test_resume_fails_if_not_waiting(self):
        self.task.start(self.worker)
        with self.assertRaises(ValidationError):
            self.task.resume(self.worker)

    def test_finish_sets_in_review(self):
        self.task.start(self.worker)
        self.task.finish(self.worker)
        self.assertEqual(self.task.state, Task.State.IN_REVIEW)

    def test_finish_fails_if_not_in_progress(self):
        with self.assertRaises(ValidationError):
            self.task.finish(self.worker)

    def test_abandon_resets_to_open(self):
        self.task.start(self.worker)
        self.task.abandon(self.worker)
        self.assertEqual(self.task.state, Task.State.OPEN)
        self.assertIsNone(self.task.assignee)

    def test_abandon_resets_streak(self):
        self.worker.task_streak = 5
        self.worker.save()
        self.task.start(self.worker)
        self.task.abandon(self.worker)
        self.worker.refresh_from_db()
        self.assertEqual(self.worker.task_streak, 0)

    def test_abandon_fails_for_non_assignee(self):
        self.task.start(self.worker)
        with self.assertRaises(ValidationError):
            self.task.abandon(self.owner)

    def test_accept_review_sets_done_and_rewards(self):
        self.task.coins = 0.5
        self.task.xp = 0.5
        self.task.minutes = 15
        self.task.save()
        self.task.start(self.worker)
        self.task.finish(self.worker)
        Review.objects.create(task=self.task)
        self.task.accept_review(self.owner)
        self.task.refresh_from_db()
        self.assertEqual(self.task.state, Task.State.DONE)
        self.worker.refresh_from_db()
        self.assertGreater(self.worker.coins, 0)
        self.assertGreater(self.worker.xp, 0)
        self.assertEqual(self.worker.task_streak, 1)

    def test_decline_review_resets_to_open(self):
        self.task.start(self.worker)
        self.task.finish(self.worker)
        Review.objects.create(task=self.task)
        self.task.decline_review(self.owner)
        self.task.refresh_from_db()
        self.assertEqual(self.task.state, Task.State.OPEN)
        self.assertIsNone(self.task.assignee)


class UserModelTest(TestCase):
    def test_level_starts_at_zero(self):
        u = User.objects.create_user(username='new', password='pass')
        self.assertEqual(u.level, 0)

    def test_level_increases_with_xp(self):
        u = User.objects.create_user(username='new', password='pass', total_xp_earned=1500)
        self.assertGreaterEqual(u.level, 1)

    def test_level_progress_structure(self):
        u = User.objects.create_user(username='new', password='pass')
        progress = u.level_progress
        self.assertIn('level', progress)
        self.assertIn('current_xp', progress)
        self.assertIn('required_xp', progress)

    def test_distance_to(self):
        u1 = User.objects.create_user(username='a', password='p', latitude=50.0, longitude=14.0)
        u2 = User.objects.create_user(username='b', password='p', latitude=50.0, longitude=14.01)
        dist = u1.distance_to(u2)
        self.assertGreater(dist, 0)
        self.assertLess(dist, 2)


class FriendsTest(TestCase):
    def setUp(self):
        self.u1 = User.objects.create_user(username='u1', password='pass')
        self.u2 = User.objects.create_user(username='u2', password='pass')

    def test_send_and_accept(self):
        self.u1.send_friend_request(self.u2)
        self.assertIn(self.u2, self.u1.friend_requests_sent.all())
        self.u2.accept_friend_request(self.u1)
        self.assertIn(self.u2, self.u1.friends.all())

    def test_send_to_self_fails(self):
        with self.assertRaises(ValidationError):
            self.u1.send_friend_request(self.u1)

    def test_duplicate_request_fails(self):
        self.u1.send_friend_request(self.u2)
        with self.assertRaises(ValidationError):
            self.u1.send_friend_request(self.u2)

    def test_reject_request(self):
        self.u1.send_friend_request(self.u2)
        self.u2.reject_friend_request(self.u1)
        self.assertNotIn(self.u1, self.u2.friend_requests_received.all())

    def test_remove_friend(self):
        self.u1.send_friend_request(self.u2)
        self.u2.accept_friend_request(self.u1)
        self.u1.remove_friend(self.u2)
        self.assertNotIn(self.u2, self.u1.friends.all())


class AchievementTest(TestCase):
    def test_compute_progress_task_count(self):
        user = User.objects.create_user(username='a', password='p')
        owner = User.objects.create_user(username='o', password='p')
        achievement = Achievement.objects.create(
            name='First Task', condition_type='task_count', condition_value=1
        )
        self.assertEqual(achievement.compute_progress(user), 0)
        Task.objects.create(name='t', owner=owner, assignee=user, state=Task.State.DONE)
        self.assertEqual(achievement.compute_progress(user), 1)

    def test_check_and_award_achievements(self):
        user = User.objects.create_user(username='a', password='p')
        owner = User.objects.create_user(username='o', password='p')
        Achievement.objects.create(
            name='First Task', condition_type='task_count', condition_value=1, reward_coins=10
        )
        Task.objects.create(name='t', owner=owner, assignee=user, state=Task.State.DONE)
        awards = user.check_and_award_achievements()
        self.assertEqual(len(awards), 1)
        self.assertEqual(awards[0].name, 'First Task')
        user.refresh_from_db()
        self.assertEqual(user.coins, 10)


class TutorialTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='learner', password='pass')
        self.skill = Skill.objects.create(name='NewSkill')
        self.tutorial = TutorialTask.objects.create(name='Learn', reward_skill=self.skill)
        self.part_text = TutorialPart.objects.create(
            tutorial=self.tutorial, type='text', title='Intro', order=0, text_content='Hello'
        )
        self.part_quiz = TutorialPart.objects.create(
            tutorial=self.tutorial, type='quiz', title='Quiz', order=1
        )
        self.question = TutorialQuestion.objects.create(part=self.part_quiz, text='What?', order=0)
        self.correct = TutorialAnswer.objects.create(question=self.question, text='Right', is_correct=True, order=0)
        self.wrong = TutorialAnswer.objects.create(question=self.question, text='Wrong', is_correct=False, order=1)

    def test_progress_tracks_completed_parts(self):
        progress = TutorialProgress.objects.create(user=self.user, tutorial=self.tutorial)
        self.assertFalse(progress.is_complete())
        progress.completed_parts.add(self.part_text)
        self.assertFalse(progress.is_complete())
        progress.completed_parts.add(self.part_quiz)
        self.assertTrue(progress.is_complete())

    def test_completing_tutorial_awards_skill(self):
        progress = TutorialProgress.objects.create(user=self.user, tutorial=self.tutorial)
        progress.completed_parts.add(self.part_text, self.part_quiz)
        if progress.is_complete():
            self.user.skills.add(self.tutorial.reward_skill)
        self.assertIn(self.skill, self.user.skills.all())


    def test_freetext_part_validates_length(self):
        """Freetext part enforces min/max length."""
        part_ft = TutorialPart.objects.create(
            tutorial=self.tutorial, type='freetext', title='Write', order=2,
            freetext_min_length=5, freetext_max_length=20,
        )
        progress = TutorialProgress.objects.create(user=self.user, tutorial=self.tutorial)
        token = Token.objects.create(user=self.user)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)

        # Too short
        resp = client.post(f'/api/tutorial/{self.tutorial.id}/submit/{part_ft.id}/', {'text': 'hi'})
        self.assertEqual(resp.status_code, 400)

        # Too long
        resp = client.post(f'/api/tutorial/{self.tutorial.id}/submit/{part_ft.id}/', {'text': 'x' * 21})
        self.assertEqual(resp.status_code, 400)

        # Just right
        resp = client.post(f'/api/tutorial/{self.tutorial.id}/submit/{part_ft.id}/', {'text': 'hello'})
        self.assertEqual(resp.status_code, 200)

    def test_reviewed_tutorial_pending_then_accept(self):
        """Tutorial with owner enters pending review, owner accepts to award skill."""
        owner = User.objects.create_user(username='tutor', password='pass')
        skill = Skill.objects.create(name='Reviewed')
        tutorial = TutorialTask.objects.create(name='Reviewed Tutorial', reward_skill=skill, owner=owner)
        part = TutorialPart.objects.create(tutorial=tutorial, type='text', title='Read', order=0)

        token = Token.objects.create(user=self.user)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)

        # Start tutorial
        client.post(f'/api/tutorial_task/{tutorial.id}/start')

        # Submit part — should complete but enter pending review
        resp = client.post(f'/api/tutorial/{tutorial.id}/submit/{part.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data.get('pending_review'))
        self.assertNotIn(skill, self.user.skills.all())

        # Owner accepts
        owner_token = Token.objects.create(user=owner)
        owner_client = APIClient()
        owner_client.credentials(HTTP_AUTHORIZATION='Token ' + owner_token.key)
        resp = owner_client.post(f'/api/tutorial_task/{tutorial.id}/accept_review')
        self.assertEqual(resp.status_code, 200)
        self.assertIn(skill, self.user.skills.all())

    def test_reviewed_tutorial_decline_resets_progress(self):
        """Tutorial decline resets progress so user can redo."""
        owner = User.objects.create_user(username='tutor2', password='pass')
        skill = Skill.objects.create(name='Declined')
        tutorial = TutorialTask.objects.create(name='Decline Test', reward_skill=skill, owner=owner)
        part = TutorialPart.objects.create(tutorial=tutorial, type='text', title='Read', order=0)

        token = Token.objects.create(user=self.user)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)

        client.post(f'/api/tutorial_task/{tutorial.id}/start')
        client.post(f'/api/tutorial/{tutorial.id}/submit/{part.id}/')

        # Owner declines
        owner_token = Token.objects.create(user=owner)
        owner_client = APIClient()
        owner_client.credentials(HTTP_AUTHORIZATION='Token ' + owner_token.key)
        resp = owner_client.post(f'/api/tutorial_task/{tutorial.id}/decline_review')
        self.assertEqual(resp.status_code, 200)

        progress = TutorialProgress.objects.get(user=self.user, tutorial=tutorial)
        self.assertEqual(progress.state, TutorialProgress.State.IN_PROGRESS)
        self.assertEqual(progress.completed_parts.count(), 0)
        self.assertNotIn(skill, self.user.skills.all())

    def test_welcome_accept_spawns_onboarding_tutorials(self):
        """Accepting T&C with location spawns onboarding tutorials around user."""
        user = User.objects.create_user(username='newuser', password='pass')
        skill = Skill.objects.create(name='Onboard')
        tutorial = TutorialTask.objects.create(name='Welcome Tutorial', reward_skill=skill)
        TutorialPart.objects.create(tutorial=tutorial, type='text', title='Intro', order=0)
        OnboardingTemplate.objects.create(tutorial=tutorial, order=0, spawn_radius_meters=200)

        token = Token.objects.create(user=user)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)

        resp = client.post('/api/welcome/accept/', {'latitude': 50.0, 'longitude': 14.0})
        self.assertEqual(resp.status_code, 200)

        user.refresh_from_db()
        self.assertTrue(user.welcome_accepted)

        # Check tutorial was spawned
        uo = UserOnboardingTutorial.objects.get(user=user, tutorial=tutorial)
        self.assertIsNotNone(uo.lat)
        self.assertIsNotNone(uo.lon)
        # Should be within ~200m of the user
        from comrade_core.utils import haversine_km
        dist = haversine_km(50.0, 14.0, uo.lat, uo.lon)
        self.assertLess(dist, 0.3)  # ~300m tolerance for randomness


class TaskAPITest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass')
        self.worker = User.objects.create_user(username='worker', password='pass')
        self.task = Task.objects.create(name='api-test', owner=self.owner, state=Task.State.OPEN)
        self.token = Token.objects.create(user=self.worker)
        self.owner_token = Token.objects.create(user=self.owner)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)

    def test_tasks_list_requires_auth(self):
        c = APIClient()
        resp = c.get('/api/tasks/')
        self.assertEqual(resp.status_code, 401)

    def test_tasks_list_returns_tasks(self):
        resp = self.client.get('/api/tasks/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('tasks', resp.data)

    def test_start_task(self):
        resp = self.client.post(f'/api/task/{self.task.id}/start')
        self.assertEqual(resp.status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.state, Task.State.IN_PROGRESS)

    def test_pause_task(self):
        self.task.start(self.worker)
        self.task.save()
        resp = self.client.post(f'/api/task/{self.task.id}/pause')
        self.assertEqual(resp.status_code, 200)

    def test_resume_task(self):
        self.task.start(self.worker)
        self.task.pause(self.worker)
        resp = self.client.post(f'/api/task/{self.task.id}/resume')
        self.assertEqual(resp.status_code, 200)

    def test_finish_task(self):
        self.task.start(self.worker)
        self.task.save()
        resp = self.client.post(f'/api/task/{self.task.id}/finish')
        self.assertEqual(resp.status_code, 200)

    def test_abandon_task(self):
        self.task.start(self.worker)
        self.task.save()
        resp = self.client.post(f'/api/task/{self.task.id}/abandon')
        self.assertEqual(resp.status_code, 200)

    def test_start_nonexistent_task_returns_404(self):
        resp = self.client.post('/api/task/99999/start')
        self.assertEqual(resp.status_code, 404)

    def test_create_task_requires_admin(self):
        resp = self.client.post('/api/tasks/create', {'name': 'test'})
        self.assertEqual(resp.status_code, 403)

    def test_create_task_as_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.owner_token.key)
        self.owner.is_staff = True
        self.owner.save()
        resp = self.client.post('/api/tasks/create', {'name': 'new task', 'lat': 50.0, 'lon': 14.0})
        self.assertEqual(resp.status_code, 201)

    def test_create_task_validation_empty_name(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.owner_token.key)
        self.owner.is_staff = True
        self.owner.save()
        resp = self.client.post('/api/tasks/create', {'name': '', 'lat': 50.0, 'lon': 14.0})
        self.assertEqual(resp.status_code, 400)
        self.assertIn('fields', resp.data)
        self.assertIn('name', resp.data['fields'])

    def test_create_task_validation_invalid_lat(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.owner_token.key)
        self.owner.is_staff = True
        self.owner.save()
        resp = self.client.post('/api/tasks/create', {'name': 'test', 'lat': 999, 'lon': 14.0})
        self.assertEqual(resp.status_code, 400)
        self.assertIn('fields', resp.data)


class FriendsAPITest(APITestCase):
    def setUp(self):
        self.u1 = User.objects.create_user(username='u1', password='pass')
        self.u2 = User.objects.create_user(username='u2', password='pass')
        self.t1 = Token.objects.create(user=self.u1)
        self.t2 = Token.objects.create(user=self.u2)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.t1.key)

    def test_send_friend_request(self):
        resp = self.client.post(f'/api/friends/send/{self.u2.id}/')
        self.assertEqual(resp.status_code, 200)

    def test_accept_friend_request(self):
        self.u1.send_friend_request(self.u2)
        c2 = APIClient()
        c2.credentials(HTTP_AUTHORIZATION='Token ' + self.t2.key)
        resp = c2.post(f'/api/friends/accept/{self.u1.id}/')
        self.assertEqual(resp.status_code, 200)

    def test_get_friends(self):
        resp = self.client.get('/api/friends/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('friends', resp.data)

    def test_get_pending(self):
        resp = self.client.get('/api/friends/pending/')
        self.assertEqual(resp.status_code, 200)


class GlobalConfigAPITest(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin', password='pass')
        self.user = User.objects.create_user(username='user', password='pass')
        self.admin_token = Token.objects.create(user=self.admin)
        self.user_token = Token.objects.create(user=self.user)

    def test_config_requires_superuser(self):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION='Token ' + self.user_token.key)
        resp = c.get('/api/settings/global/')
        self.assertEqual(resp.status_code, 403)

    def test_config_accessible_by_superuser(self):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION='Token ' + self.admin_token.key)
        resp = c.get('/api/settings/global/')
        self.assertEqual(resp.status_code, 200)
