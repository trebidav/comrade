from django.shortcuts import render
from django.http import HttpResponse
from django_eventstream import send_event



def index(request):
    send_event("test", "message", {"text": "hello world1"})
    return HttpResponse(status=200)
