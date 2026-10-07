from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.accounts.models import USERNAME_RE, Device, LoginHistory, User


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    username = serializers.RegexField(USERNAME_RE)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    display_name = serializers.CharField(max_length=80, required=False)

    def validate_email(self, value: str) -> str:
        return value.lower()

    def validate_username(self, value: str) -> str:
        return value.lower()

    def validate(self, attrs):
        validate_password(attrs["password"], user=User(email=attrs["email"], username=attrs["username"]))
        return attrs


class UserPublicSerializer(serializers.ModelSerializer):
    """Representation LECTURE publique : n'expose jamais email, statut interne, etc."""

    class Meta:
        model = User
        fields = ("id", "username")
        read_only_fields = fields


class UserSelfSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "status", "email_verified_at", "date_joined")
        read_only_fields = fields


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ("id", "platform", "label", "is_trusted", "first_seen_at", "last_seen_at")
        read_only_fields = fields


class LoginHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginHistory
        fields = ("id", "success", "method", "ip_address", "user_agent", "country_code", "created_at")
        read_only_fields = fields
