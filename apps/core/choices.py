"""Enumerations partagees entre domaines (confidentialite uniforme partout)."""
from django.db import models


class Visibility(models.TextChoices):
    PUBLIC = "public", "Public"
    FOLLOWERS = "followers", "Abonnes"
    FRIENDS = "friends", "Amis"
    CLOSE_FRIENDS = "close_friends", "Amis proches"
    GROUP_MEMBERS = "group_members", "Membres du groupe"
    CUSTOM = "custom", "Audience personnalisee"
    PRIVATE = "private", "Moi uniquement"
