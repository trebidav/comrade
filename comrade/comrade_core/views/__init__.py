from .user import UserDetailView, LocationSharingPreferencesView, get_user_info
from .task import (TaskStartView, TaskFinishView, TaskPauseView, TaskResumeView,
                   TaskAbandonView, TaskListView, TaskCreateView, TaskDebugResetView,
                   TaskAcceptReviewView, TaskDeclineReviewView, TaskRateView)
from .tutorial import (TutorialDetailView, TutorialSubmitPartView,
                       TutorialTaskStartView, TutorialTaskAbandonView,
                       TutorialAcceptReviewView, TutorialDeclineReviewView,
                       TutorialPendingReviewView, TutorialCreateView)
from .friends import (send_friend_request, accept_friend_request, reject_friend_request,
                      remove_friend, get_friends, get_pending_requests, get_sent_requests)
from .config import ProximitySettingsView, GlobalConfigView, AchievementsView, SkillListView
from .auth import google_oauth_callback, google_config, token_login_view, index, map
from .chat import chat_history, welcome_message, welcome_accept
from .bug_report import BugReportView
