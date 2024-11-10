from django.db.models import Sum
from comrade_core.models import Task, User

# Get the user instance
user = User.objects.get(username='david')

# Get all tasks owned by this user with state 'done'
tasks_done_by_user = user.task_set.filter(state=5)

# Sum the contribution field
total_contribution_done = tasks_done_by_user.aggregate(Sum('contribution'))['contribution__sum']

print(f"Total Contribution for done tasks: {total_contribution_done}")