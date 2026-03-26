import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import BugReport, BugReportScreenshot

logger = logging.getLogger(__name__)


class BugReportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        description = (request.data.get('description') or '').strip()
        if not description:
            return Response({"error": "Description is required"}, status=status.HTTP_400_BAD_REQUEST)

        report = BugReport.objects.create(
            user=request.user,
            description=description,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            url=request.data.get('url', '')[:500],
            screen_size=request.data.get('screen_size', '')[:20],
            location=request.data.get('location', '')[:50],
        )

        for i, key in enumerate(sorted(k for k in request.FILES if k.startswith('screenshot'))):
            BugReportScreenshot.objects.create(
                bug_report=report,
                image=request.FILES[key],
                order=i,
            )

        logger.info("Bug report #%d by user %d (%s): %s", report.id, request.user.id, request.user.username, description[:100])
        return Response({"message": "Bug report submitted", "id": report.id}, status=status.HTTP_201_CREATED)
