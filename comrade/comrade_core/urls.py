import django_eventstream
from django.urls import include, path
from django.urls import re_path
from . import consumers

from . import views

urlpatterns = [
    path('user/', views.UserDetailView.as_view(), name='user_detail'),
    path('user/token/', views.login_view, name='login'),
]

websocket_urlpatterns = [
    re_path(r'ws/location/$', consumers.LocationConsumer.as_asgi()),
    re_path(r'ws/chat/(?P<room_name>\w+)/$', consumers.ChatConsumer.as_asgi()),

]