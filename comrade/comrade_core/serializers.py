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


class TaskSerializer(serializers.ModelSerializer):
    skill_execute_names = serializers.SerializerMethodField()
    skill_read_names = serializers.SerializerMethodField()
    skill_write_names = serializers.SerializerMethodField()
    assignee_name = serializers.SerializerMethodField()
    
    def get_skill_execute_names(self, obj):
        return [skill.name for skill in obj.skill_execute.all()]
    
    def get_skill_read_names(self, obj):
        return [skill.name for skill in obj.skill_read.all()]
    
    def get_skill_write_names(self, obj):
        return [skill.name for skill in obj.skill_write.all()]
    
    def get_assignee_name(self, obj):
        if obj.assignee:
            return f"{obj.assignee.first_name} {obj.assignee.last_name}".strip() or obj.assignee.username
        return None
    
    class Meta:
        model = Task
        fields = "__all__"