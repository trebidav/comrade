from comrade_core.models import Task, User
from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from rest_framework import serializers


class UserSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = User
        fields = ["url", "username", "email", "groups"]


class GroupSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Group
        fields = ["url", "name"]


class TaskSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Task
        fields = ["title"]

User = get_user_model()

class UserDetailSerializer(serializers.ModelSerializer):
    skills = serializers.StringRelatedField(many=True)  # Assuming skills have a __str__ method

    class Meta:
        model = User
        fields = ["id", "username", "skills"]