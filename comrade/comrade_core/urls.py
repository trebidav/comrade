import django_eventstream
from django.urls import include, path

from . import views

urlpatterns = [
    path("send/", views.send, name="send"),
    path("task/start/", views.start_task, name="task_start"),
    path("frontend/", views.index, name="index"),
    path("events/", views.Notify.as_view(), name="notify"),
    #    path("events/", include(django_eventstream.urls), {"channels": ["test"]}),
    path("events_old/", views.sse_stream, name="sse_stream"),
]
