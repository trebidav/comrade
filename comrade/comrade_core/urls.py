from django.urls import include, path
from django.urls import re_path

from . import consumers
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('user/', views.UserDetailView.as_view(), name='user_detail'),
    path('map/', views.map, name='map'),
    path('task/<int:task_id>/start', views.TaskStartView.as_view(), name='start_task'),
    path('task/<int:task_id>/finish', views.TaskFinishView.as_view(), name='finish_task'),
    path('task/<int:task_id>/pause', views.TaskPauseView.as_view(), name='pause_task'),
    path('task/<int:task_id>/abandon', views.TaskAbandonView.as_view(), name='abandon_task'),
    path('task/<int:task_id>/resume', views.TaskResumeView.as_view(), name='resume_task'),
    path('task/<int:task_id>/accept_review', views.TaskAcceptReviewView.as_view(), name='accept_review_task'),
    path('task/<int:task_id>/decline_review', views.TaskDeclineReviewView.as_view(), name='decline_review_task'),
    path('task/<int:task_id>/reset', views.TaskDebugResetView.as_view(), name='reset_task'),
    path('task/<int:task_id>/rate', views.TaskRateView.as_view(), name='rate_task'),
    path('tasks/', views.TaskListView.as_view(), name='task_list'),
    path('tasks/create', views.TaskCreateView.as_view(), name='create_task'),
    path('skills/', views.SkillListView.as_view(), name='skill_list'),
    path('achievements/', views.AchievementsView.as_view(), name='achievements'),
    path('settings/proximity/', views.ProximitySettingsView.as_view(), name='proximity_settings'),
    path('settings/global/', views.GlobalConfigView.as_view(), name='global_config'),
    path('tutorial/<int:task_id>/', views.TutorialDetailView.as_view(), name='tutorial_detail'),
    path('tutorial/<int:task_id>/submit/<int:part_id>/', views.TutorialSubmitPartView.as_view(), name='tutorial_submit_part'),
    path('tutorial_task/<int:task_id>/start', views.TutorialTaskStartView.as_view(), name='start_tutorial_task'),
    path('tutorial_task/<int:task_id>/abandon', views.TutorialTaskAbandonView.as_view(), name='abandon_tutorial_task'),
    path('friends/send/<int:user_id>/', views.send_friend_request, name='send_friend_request'),
    path('friends/accept/<int:user_id>/', views.accept_friend_request, name='accept_friend_request'),
    path('friends/reject/<int:user_id>/', views.reject_friend_request, name='reject_friend_request'),
    path('friends/remove/<int:user_id>/', views.remove_friend, name='remove_friend'),
    path('friends/', views.get_friends, name='get_friends'),
    path('friends/pending/', views.get_pending_requests, name='get_pending_requests'),
    path('friends/sent/', views.get_sent_requests, name='get_sent_requests'),
    path('location/preferences/', views.LocationSharingPreferencesView.as_view(), name='location_preferences'),
    path('user/token/', views.token_login_view, name='token_login'),
    path('chat/history/', views.chat_history, name='chat_history'),
    path('welcome/', views.welcome_message, name='welcome_message'),
    path('welcome/accept/', views.welcome_accept, name='welcome_accept'),
]

websocket_urlpatterns = [
    re_path(r'ws/location/$', consumers.LocationConsumer.as_asgi()),
]
