from django.urls import path, include
import django_eventstream

from . import views

urlpatterns = [
    path("send/", views.send, name="send"),
    path("frontend/", views.index, name="index"),
#    path("events/", include(django_eventstream.urls), {"channels": ["test"]}),
    path("events/", views.sse_stream, name='sse_stream'),

]
