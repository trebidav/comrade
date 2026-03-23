from django.core.exceptions import ValidationError
from django.test import TestCase

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
