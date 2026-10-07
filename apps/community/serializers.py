from rest_framework import serializers

from apps.community.models import Channel, Community, Group, GroupInvitation, GroupJoinRequest, GroupMember, GroupRole


class CommunitySerializer(serializers.ModelSerializer):
    group_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Community
        fields = ("id", "slug", "name", "description", "privacy", "avatar_key", "cover_key", "created_at", "group_count")
        read_only_fields = ("id", "created_at", "group_count")


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ("id", "community", "slug", "name", "description", "privacy", "join_policy", "avatar_key", "member_count", "created_at")
        read_only_fields = ("id", "member_count", "created_at")


class GroupRoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SlugRelatedField(many=True, read_only=True, slug_field="code")

    class Meta:
        model = GroupRole
        fields = ("id", "name", "position", "is_default", "permissions")


class GroupMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = GroupMember
        fields = ("id", "user", "username", "role", "role_name", "joined_at")
        read_only_fields = fields


class GroupInvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupInvitation
        fields = ("id", "group", "invited_by", "status", "expires_at", "created_at")
        read_only_fields = fields


class GroupJoinRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupJoinRequest
        fields = ("id", "group", "user", "message", "status", "created_at")
        read_only_fields = ("id", "group", "user", "status", "created_at")


class ChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = ("id", "group", "community", "slug", "name", "topic", "type", "created_at")
        read_only_fields = ("id", "created_at")
