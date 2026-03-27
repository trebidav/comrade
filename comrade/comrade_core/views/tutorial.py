import logging

from django.utils.timezone import now
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import GlobalConfig, TutorialTask, TutorialPart, TutorialAnswer, TutorialProgress, UserOnboardingTutorial
from ..serializers import TutorialTaskDetailSerializer
from ..utils import haversine_km
from ..ws_events import send_user_stats, send_achievements
from .task import _serialize_achievements

logger = logging.getLogger(__name__)


class TutorialDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        try:
            tutorial = TutorialTask.objects.get(pk=task_id)
        except TutorialTask.DoesNotExist:
            return Response({"error": "Tutorial not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = TutorialTaskDetailSerializer(tutorial, context={'request': request})
        return Response(serializer.data)


class TutorialSubmitPartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, task_id, part_id):
        try:
            tutorial = TutorialTask.objects.get(pk=task_id)
            part = tutorial.parts.get(pk=part_id)
        except (TutorialTask.DoesNotExist, TutorialPart.DoesNotExist):
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            progress = TutorialProgress.objects.get(
                user=request.user, tutorial=tutorial, state=TutorialProgress.State.IN_PROGRESS
            )
        except TutorialProgress.DoesNotExist:
            return Response({"error": "Tutorial not started"}, status=status.HTTP_403_FORBIDDEN)

        # Validate part by type
        if part.type == TutorialPart.Type.QUIZ:
            submitted = request.data.get('answers', {})  # {str(question_id): answer_id}
            for question in part.questions.all():
                answer_id = submitted.get(str(question.id))
                if not answer_id:
                    return Response({"error": "Question not answered", "question_id": question.id}, status=status.HTTP_400_BAD_REQUEST)
                try:
                    answer = question.answers.get(pk=answer_id)
                except TutorialAnswer.DoesNotExist:
                    return Response({"error": "Invalid answer"}, status=status.HTTP_400_BAD_REQUEST)
                if not answer.is_correct:
                    return Response({"error": "Wrong answer", "question_id": question.id}, status=status.HTTP_400_BAD_REQUEST)

        elif part.type == TutorialPart.Type.PASSWORD:
            if request.data.get('password', '') != part.password:
                return Response({"error": "Incorrect password"}, status=status.HTTP_400_BAD_REQUEST)

        elif part.type == TutorialPart.Type.FILE_UPLOAD:
            if not request.FILES.get('file'):
                return Response({"error": "A file is required"}, status=status.HTTP_400_BAD_REQUEST)

        elif part.type == TutorialPart.Type.FREETEXT:
            text = request.data.get('text', '')
            if len(text) < part.freetext_min_length:
                return Response(
                    {"error": f"Text must be at least {part.freetext_min_length} characters"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if len(text) > part.freetext_max_length:
                return Response(
                    {"error": f"Text must be at most {part.freetext_max_length} characters"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Mark part complete
        progress.completed_parts.add(part)

        if progress.is_complete():
            progress.datetime_finish = now()

            if tutorial.owner is None:
                # No owner — award skill immediately
                request.user.skills.add(tutorial.reward_skill)
                progress.state = TutorialProgress.State.DONE
                progress.save()
                new_achievements = request.user.check_and_award_achievements()
                send_user_stats(request.user)
                send_achievements(request.user.id, new_achievements)
                logger.info("Tutorial %d completed by user %d (%s) — auto-accepted", tutorial.id, request.user.id, request.user.username)
                return Response({
                    "completed": True,
                    "reward_skill": tutorial.reward_skill.name,
                    "new_achievements": _serialize_achievements(new_achievements),
                })
            else:
                # Owner set — enter pending review
                progress.review_status = TutorialProgress.ReviewStatus.PENDING
                progress.save()
                logger.info("Tutorial %d completed by user %d (%s) — pending review by owner %d", tutorial.id, request.user.id, request.user.username, tutorial.owner_id)
                return Response({
                    "completed": True,
                    "pending_review": True,
                    "reward_skill": tutorial.reward_skill.name,
                })

        return Response({"completed": False, "part_id": part.id})


class TutorialTaskStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, task_id):
        try:
            tutorial = TutorialTask.objects.get(pk=task_id)
        except TutorialTask.DoesNotExist:
            return Response({"error": "Tutorial task not found"}, status=status.HTTP_404_NOT_FOUND)

        # Use per-user onboarding location if available
        try:
            uo = UserOnboardingTutorial.objects.get(user=request.user, tutorial=tutorial)
            tutorial_lat, tutorial_lon = uo.lat, uo.lon
        except UserOnboardingTutorial.DoesNotExist:
            tutorial_lat, tutorial_lon = tutorial.lat, tutorial.lon

        # Proximity check
        if tutorial_lat is not None and tutorial_lon is not None:
            config = GlobalConfig.get_config()
            user_lat = float(request.data.get('latitude', request.user.latitude))
            user_lon = float(request.data.get('longitude', request.user.longitude))
            distance_km = haversine_km(user_lat, user_lon, tutorial_lat, tutorial_lon)
            if distance_km > config.task_proximity_km:
                return Response(
                    {"error": f"Too far from task ({int(distance_km * 1000)}m away, max {int(config.task_proximity_km * 1000)}m)"},
                    status=status.HTTP_412_PRECONDITION_FAILED,
                )

        # Skill check
        required_skills = tutorial.skill_execute.all()
        if required_skills.exists():
            if request.user.skills.filter(id__in=required_skills).count() < required_skills.count():
                return Response({"error": "Missing required skills"}, status=status.HTTP_412_PRECONDITION_FAILED)

        progress, created = TutorialProgress.objects.get_or_create(
            user=request.user,
            tutorial=tutorial,
            defaults={'state': TutorialProgress.State.IN_PROGRESS},
        )
        if not created and progress.state == TutorialProgress.State.DONE:
            return Response({"error": "Tutorial already completed"}, status=status.HTTP_412_PRECONDITION_FAILED)

        return Response({"message": "Tutorial started!"}, status=status.HTTP_200_OK)


class TutorialTaskAbandonView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, task_id):
        try:
            tutorial = TutorialTask.objects.get(pk=task_id)
        except TutorialTask.DoesNotExist:
            return Response({"error": "Tutorial task not found"}, status=status.HTTP_404_NOT_FOUND)

        deleted, _ = TutorialProgress.objects.filter(
            user=request.user, tutorial=tutorial, state=TutorialProgress.State.IN_PROGRESS
        ).delete()
        if not deleted:
            return Response({"error": "Tutorial not in progress"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"message": "Tutorial abandoned."}, status=status.HTTP_200_OK)


class TutorialAcceptReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, task_id):
        try:
            tutorial = TutorialTask.objects.get(pk=task_id)
        except TutorialTask.DoesNotExist:
            return Response({"error": "Tutorial not found"}, status=status.HTTP_404_NOT_FOUND)

        if tutorial.owner != request.user:
            return Response({"error": "Only the owner can accept reviews"}, status=status.HTTP_403_FORBIDDEN)

        try:
            progress = TutorialProgress.objects.get(
                tutorial=tutorial, review_status=TutorialProgress.ReviewStatus.PENDING,
            )
        except TutorialProgress.DoesNotExist:
            return Response({"error": "No pending review"}, status=status.HTTP_404_NOT_FOUND)

        progress.review_status = TutorialProgress.ReviewStatus.ACCEPTED
        progress.state = TutorialProgress.State.DONE
        progress.save()

        # Award skill and check achievements
        progress.user.skills.add(tutorial.reward_skill)
        new_achievements = progress.user.check_and_award_achievements()
        send_user_stats(progress.user)
        send_achievements(progress.user.id, new_achievements)

        logger.info("Tutorial %d review accepted for user %d by owner %d", tutorial.id, progress.user.id, request.user.id)
        return Response({
            "message": "Tutorial review accepted, skill awarded.",
            "new_achievements": _serialize_achievements(new_achievements),
        }, status=status.HTTP_200_OK)


class TutorialDeclineReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, task_id):
        try:
            tutorial = TutorialTask.objects.get(pk=task_id)
        except TutorialTask.DoesNotExist:
            return Response({"error": "Tutorial not found"}, status=status.HTTP_404_NOT_FOUND)

        if tutorial.owner != request.user:
            return Response({"error": "Only the owner can decline reviews"}, status=status.HTTP_403_FORBIDDEN)

        try:
            progress = TutorialProgress.objects.get(
                tutorial=tutorial, review_status=TutorialProgress.ReviewStatus.PENDING,
            )
        except TutorialProgress.DoesNotExist:
            return Response({"error": "No pending review"}, status=status.HTTP_404_NOT_FOUND)

        # Reset progress — user must redo the tutorial
        progress.review_status = TutorialProgress.ReviewStatus.DECLINED
        progress.state = TutorialProgress.State.IN_PROGRESS
        progress.completed_parts.clear()
        progress.datetime_finish = None
        progress.save()

        logger.info("Tutorial %d review declined for user %d by owner %d", tutorial.id, progress.user.id, request.user.id)
        return Response({"message": "Tutorial review declined, progress reset."}, status=status.HTTP_200_OK)
