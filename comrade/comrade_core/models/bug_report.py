from django.db import models


class BugReport(models.Model):
    user = models.ForeignKey('comrade_core.User', on_delete=models.CASCADE, related_name='bug_reports')
    description = models.TextField()
    user_agent = models.CharField(max_length=500, blank=True, default='')
    url = models.CharField(max_length=500, blank=True, default='')
    screen_size = models.CharField(max_length=20, blank=True, default='')
    location = models.CharField(max_length=50, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Bug #{self.id} by {self.user.username} ({self.created_at:%Y-%m-%d %H:%M})"


class BugReportScreenshot(models.Model):
    bug_report = models.ForeignKey(BugReport, on_delete=models.CASCADE, related_name='screenshots')
    image = models.FileField(upload_to='bug_reports/')
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Screenshot {self.order} for Bug #{self.bug_report_id}"
