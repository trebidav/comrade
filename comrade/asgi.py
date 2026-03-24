import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from comrade_core import urls  # Import your routing configuration

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'comrade.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),  # Handle HTTP requests
    "websocket": AuthMiddlewareStack(  # Handle WebSocket connections
        URLRouter(
            urls.websocket_urlpatterns  # Define WebSocket routes
        )
    ),
}) 