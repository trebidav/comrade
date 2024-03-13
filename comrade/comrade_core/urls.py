from django.urls import path, include
import django_eventstream

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("events/", include(django_eventstream.urls), {"channels": ["test"]}),
]
