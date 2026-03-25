from django.db import models


class ChatMessage(models.Model):
    sender = models.ForeignKey('User', on_delete=models.CASCADE, related_name='chat_messages')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender.username}: {self.text[:50]}'
