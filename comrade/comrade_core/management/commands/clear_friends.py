from django.core.management.base import BaseCommand
from comrade_core.models import User

class Command(BaseCommand):
    help = 'Clears all friend relationships'

    def handle(self, *args, **options):
        # Clear all friend relationships
        for user in User.objects.all():
            user.friends.clear()
            user.friend_requests_sent.clear()
            user.friend_requests_received.clear()
            
        self.stdout.write(self.style.SUCCESS('Successfully cleared all friend relationships')) 