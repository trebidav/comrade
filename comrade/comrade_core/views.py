import asyncio
import random

from django.shortcuts import render
from django.http import HttpResponse, StreamingHttpResponse
from django_eventstream import send_event


def index(request):
    return render(request, 'index.html')

def send(request):
    send_event("test", "message", {"text": str(request.GET.get('message'))})
    return HttpResponse("Sending message from query param message - " + str(request.GET.get('message')))

async def sse_stream(request):
    """
    Sends server-sent events to the client.
    """
    async def event_stream():
        emojis = ["🚀", "🐎", "🌅", "🦾", "🍇"]
        i = 0
        while True:
            yield f'data: {random.choice(emojis)} {i}\n\n'
            i += 1
            await asyncio.sleep(1)

    return StreamingHttpResponse(event_stream(), content_type='text/event-stream')
