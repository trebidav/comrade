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
]

websocket_urlpatterns = [
    re_path(r'ws/location/$', consumers.LocationConsumer.as_asgi()),
    re_path(r'ws/chat/(?P<room_name>\w+)/$', consumers.ChatConsumer.as_asgi()),

]
