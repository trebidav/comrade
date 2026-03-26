from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import GlobalConfig, Achievement, Skill
from ..serializers import SkillSerializer


class ProximitySettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config = GlobalConfig.get_config()
        return Response({
            'radius_km': config.task_proximity_km,
            'max_distance_km': config.max_distance_km,
            'coins_modifier': config.coins_modifier,
            'xp_modifier': config.xp_modifier,
            'time_modifier_minutes': config.time_modifier_minutes,
            'criticality_percentage': config.criticality_percentage,
            'pause_multiplier': config.pause_multiplier,
        }, status=status.HTTP_200_OK)


class GlobalConfigView(APIView):
    permission_classes = [IsAuthenticated]

    FIELDS = ['max_distance_km', 'task_proximity_km', 'coins_modifier', 'xp_modifier',
              'time_modifier_minutes', 'criticality_percentage', 'pause_multiplier', 'level_modifier']

    def get(self, request):
        if not request.user.is_superuser:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        config = GlobalConfig.get_config()
        return Response({f: getattr(config, f) for f in self.FIELDS})

    def patch(self, request):
        if not request.user.is_superuser:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        config = GlobalConfig.get_config()
        updated = []
        for field in self.FIELDS:
            if field in request.data:
                try:
                    setattr(config, field, float(request.data[field]))
                    updated.append(field)
                except (ValueError, TypeError):
                    return Response({"error": f"Invalid value for {field}"}, status=status.HTTP_400_BAD_REQUEST)
        if updated:
            config.save(update_fields=updated)
        return Response({f: getattr(config, f) for f in self.FIELDS})


class AchievementsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        earned_map = {ua.achievement_id: ua for ua in user.user_achievements.select_related('achievement').all()}
        data = []
        for achievement in Achievement.objects.filter(is_active=True).select_related('reward_skill'):
            ua = earned_map.get(achievement.id)
            earned = ua is not None
            if achievement.is_secret and not earned:
                data.append({
                    'id': achievement.id,
                    'name': '???',
                    'description': 'Secret achievement — keep playing to discover it',
                    'icon': '🔒',
                    'is_secret': True,
                    'earned': False,
                    'datetime_earned': None,
                    'progress': None,
                    'threshold': achievement.condition_value,
                    'reward_coins': 0,
                    'reward_xp': 0,
                    'reward_skill': None,
                })
            else:
                progress = ua.progress if ua else achievement.compute_progress(user)
                data.append({
                    'id': achievement.id,
                    'name': achievement.name,
                    'description': achievement.description,
                    'icon': achievement.icon,
                    'is_secret': achievement.is_secret,
                    'earned': earned,
                    'datetime_earned': ua.datetime_earned.isoformat() if ua else None,
                    'progress': progress,
                    'threshold': achievement.condition_value,
                    'reward_coins': achievement.reward_coins,
                    'reward_xp': achievement.reward_xp,
                    'reward_skill': achievement.reward_skill.name if achievement.reward_skill else None,
                })
        return Response({'achievements': data})


class SkillListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        skills = Skill.objects.all().order_by('name')
        serializer = SkillSerializer(skills, many=True)
        return Response({'skills': serializer.data}, status=status.HTTP_200_OK)
