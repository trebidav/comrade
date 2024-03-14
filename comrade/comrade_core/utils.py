from django_eventstream.channelmanager import DefaultChannelManager

class AdminChannelManager(DefaultChannelManager):
    def can_read_channel(self, user, channel):
        # require auth for prefixed channels
        # if channel.startswith('_') and user is None:
        #     return False
        if user.username == "admin":
            return True
        return False