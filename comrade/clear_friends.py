import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'comrade.settings')
django.setup()

from comrade_core.models import User

def clear_friends():
    # Clear all friend relationships
    for user in User.objects.all():
        print(f"Clearing friends for {user.username}")
        user.friends.clear()
        user.friend_requests_sent.clear()
        user.friend_requests_received.clear()
        
    print("Successfully cleared all friend relationships")

if __name__ == "__main__":
    clear_friends() 