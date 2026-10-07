from rest_framework import serializers

from apps.profiles.models import (
    Country, Interest, PrivacySettings, Profession, Profile, Skill, SocialLink, UserInterest, UserPreferences, UserSkill,
)


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ("code", "name", "region", "is_african")


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("id", "slug", "name", "kind", "is_technology")


class InterestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interest
        fields = ("id", "slug", "name")


class ProfessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profession
        fields = ("id", "slug", "name")


class UserSkillSerializer(serializers.ModelSerializer):
    skill = SkillSerializer(read_only=True)
    skill_id = serializers.PrimaryKeyRelatedField(queryset=Skill.objects.filter(is_active=True), source="skill", write_only=True)

    class Meta:
        model = UserSkill
        fields = ("id", "skill", "skill_id", "level", "years_experience")

    def validate_level(self, value: int) -> int:
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Le niveau doit etre compris entre 1 et 5.")
        return value


class UserInterestSerializer(serializers.ModelSerializer):
    interest = InterestSerializer(read_only=True)

    class Meta:
        model = UserInterest
        fields = ("id", "interest")


class SocialLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialLink
        fields = ("id", "provider", "url", "handle", "is_verified")
        read_only_fields = ("is_verified",)


class ProfilePublicSerializer(serializers.ModelSerializer):
    """Lecture publique. Les champs soumis a confidentialite sont filtres par le selector, pas ici."""

    username = serializers.CharField(source="user.username", read_only=True)
    country = CountrySerializer(read_only=True)

    class Meta:
        model = Profile
        fields = ("user_id", "username", "display_name", "headline", "bio", "avatar_key", "cover_key",
                  "country", "region", "city", "languages", "availability", "is_verified")
        read_only_fields = fields


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Ecriture : liste blanche explicite -> pas de mass-assignment (is_verified interdit)."""

    class Meta:
        model = Profile
        fields = ("display_name", "headline", "bio", "avatar_key", "cover_key", "country", "region", "city",
                  "languages", "profession", "availability")


class PreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ("language", "time_zone", "theme")


class PrivacySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivacySettings
        exclude = ("user",)
        read_only_fields = ("updated_at",)
