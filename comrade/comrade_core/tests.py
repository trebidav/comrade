from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework.authtoken.models import Token

from comrade_core.models import Skill, Task, User


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
