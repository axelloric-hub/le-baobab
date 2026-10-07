from rest_framework import serializers

from apps.friends.models import Block, Follow, Friendship


class FriendRequestSerializer(serializers.ModelSerializer):
    requester_username = serializers.CharField(source="requested_by.username", read_only=True)

    class Meta:
        model = Friendship
        fields = ("id", "status", "requested_by", "requester_username", "created_at", "responded_at")
        read_only_fields = fields


class FriendRespondSerializer(serializers.Serializer):
    accept = serializers.BooleanField()


class FollowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Follow
        fields = ("id", "follower", "followee", "created_at")
        read_only_fields = fields


class BlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = Block
        fields = ("id", "blocked", "created_at")
        read_only_fields = fields
