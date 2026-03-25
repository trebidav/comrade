import json
import urllib.parse
import urllib.request

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.response import Response


def index(request):
    return render(request, "index.html")


@ensure_csrf_cookie
def login_page(request):
    """Render the login page"""
    if request.user.is_authenticated:
        return redirect('map')
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            from django.contrib.auth import login
            login(request, user)
            return redirect('map')
        return render(request, "login.html", {'error': 'Invalid username or password'})
    return render(request, "login.html")


@ensure_csrf_cookie
@login_required
def map(request):
    """Render the map page"""
    # Create or get token
    token, created = Token.objects.get_or_create(user=request.user)

    # Get friends list
    friends = request.user.get_friends()

    # Prepare user data
    user_data = {
        'id': request.user.id,
        'email': request.user.email,
        'name': f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username,
        'friends': [{'id': friend.id, 'name': f"{friend.first_name} {friend.last_name}".strip() or friend.username} for friend in friends],
        'skills': list(request.user.skills.values_list('name', flat=True))
    }

    # Set CSRF cookie
    from django.middleware.csrf import get_token
    get_token(request)

    context = {
        'api_token': token.key,
        'user': json.dumps(user_data)
    }

    return render(request, "map.html", context=context)


@api_view(["POST"])
def token_login_view(request):
    """Token-based login for the React frontend"""
    username = request.data.get("username")
    password = request.data.get("password")
    user = authenticate(username=username, password=password)
    if user is not None:
        token, created = Token.objects.get_or_create(user=user)
        return Response({"token": token.key}, status=status.HTTP_200_OK)
    return Response({"error": "Invalid Credentials"}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
def google_config(request):
    """Return Google OAuth client ID to the React frontend."""
    return Response({'client_id': settings.GOOGLE_CLIENT_ID})


@csrf_exempt
def google_oauth_callback(request):
    """Exchange Google OAuth code for a DRF token and redirect to the SPA."""
    error = request.GET.get('error')
    code = request.GET.get('code')

    if error or not code:
        return redirect('/?google_error=access_denied')

    # Exchange the authorization code for tokens
    data = urllib.parse.urlencode({
        'code': code,
        'client_id': settings.GOOGLE_CLIENT_ID,
        'client_secret': settings.GOOGLE_CLIENT_SECRET,
        'redirect_uri': settings.GOOGLE_REDIRECT_URI,
        'grant_type': 'authorization_code',
    }).encode()

    req = urllib.request.Request(
        'https://oauth2.googleapis.com/token',
        data=data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req) as resp:
            token_data = json.loads(resp.read())
    except Exception:
        return redirect('/?google_error=token_exchange_failed')

    raw_id_token = token_data.get('id_token')
    if not raw_id_token:
        return redirect('/?google_error=no_id_token')

    # Verify the id_token and extract user info
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    try:
        id_info = google_id_token.verify_oauth2_token(
            raw_id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception:
        return redirect('/?google_error=invalid_token')

    email = id_info.get('email')
    if not email:
        return redirect('/?google_error=no_email')

    # Get or create the Django user
    UserModel = get_user_model()
    user, created = UserModel.objects.get_or_create(
        email=email,
        defaults={
            'username': _unique_username(UserModel, email),
            'first_name': id_info.get('given_name', ''),
            'last_name': id_info.get('family_name', ''),
        },
    )
    # Update profile info from Google on every login
    update_fields = []
    if not user.first_name:
        user.first_name = id_info.get('given_name', '')
        user.last_name = id_info.get('family_name', '')
        update_fields += ['first_name', 'last_name']
    picture = id_info.get('picture', '')
    if picture and user.profile_picture != picture:
        user.profile_picture = picture
        update_fields.append('profile_picture')
    if update_fields:
        user.save(update_fields=update_fields)

    drf_token, _ = Token.objects.get_or_create(user=user)
    return redirect(f'/?google_token={drf_token.key}')


def _unique_username(UserModel, email: str) -> str:
    base = email.split('@')[0][:100]
    username = base
    counter = 1
    while UserModel.objects.filter(username=username).exists():
        username = f'{base}{counter}'
        counter += 1
    return username
