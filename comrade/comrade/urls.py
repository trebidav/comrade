"""
URL configuration for comrade project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from comrade_core import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('comrade_core.urls')),  # Include all comrade_core URLs
    path('accounts/', include('allauth.urls')),  # allauth URLs for social auth
    path('login/', views.login_page, name='login_page'),  # Keep our custom login page
    path('map/', views.map, name='map'),
    path('api/user/info/', views.get_user_info, name='get_user_info'),
]
