import typing

from allauth.headless.tokens.sessions import SessionTokenStrategy
from django.http import HttpRequest
from rest_framework.authtoken.models import Token


class ComradeTokenStrategy(SessionTokenStrategy):

    def create_access_token(self, request: HttpRequest) -> typing.Optional[typing.Dict[str, typing.Any]]:
        token, _ = Token.objects.get_or_create(user=request.user)
        return token.key
