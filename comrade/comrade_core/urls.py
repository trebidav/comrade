from django.urls import include, path
from django.urls import re_path

from . import consumers

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('google/', views.google, name='google'),
    path('user/', views.UserDetailView.as_view(), name='user_detail'),
    path('user/token/', views.login_view, name='login'),
    path('map/', views.map, name='map'),
    path('task/<int:taskId>/start', views.TaskStartView.as_view(), name='start_task'),
    path('task/<int:taskId>/finish', views.TaskFinishView.as_view(), name='finish_task'),
    path('tasks/', views.TaskListView.as_view(), name='task_list'),
    path('api/google-login/', views.google_login_view, name='google_login'),
    path('friends/send/<int:user_id>/', views.send_friend_request, name='send_friend_request'),
    path('friends/accept/<int:user_id>/', views.accept_friend_request, name='accept_friend_request'),
    path('friends/reject/<int:user_id>/', views.reject_friend_request, name='reject_friend_request'),
    path('friends/remove/<int:user_id>/', views.remove_friend, name='remove_friend'),
    path('friends/', views.get_friends, name='get_friends'),
    path('friends/pending/', views.get_pending_requests, name='get_pending_requests'),
    path('friends/sent/', views.get_sent_requests, name='get_sent_requests'),
]

websocket_urlpatterns = [
    re_path(r'ws/location/$', consumers.LocationConsumer.as_asgi()),
    re_path(r'ws/chat/(?P<room_name>\w+)/$', consumers.ChatConsumer.as_asgi()),

]
