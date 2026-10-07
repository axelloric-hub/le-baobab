DEFAULT_PERMISSIONS: dict[str, str] = {
    "post.create": "Publier dans le groupe",
    "post.delete_any": "Supprimer les publications des autres",
    "comment.create": "Commenter",
    "member.invite": "Inviter des membres",
    "member.approve": "Approuver les demandes d'adhesion",
    "member.mute": "Mettre un membre en sourdine",
    "member.ban": "Bannir un membre",
    "role.manage": "Gerer les roles",
    "group.edit": "Modifier le groupe",
    "channel.manage": "Gerer les channels",
}
# nom du role -> (position, permissions, is_default, is_owner)
DEFAULT_ROLES = {
    "owner": (100, list(DEFAULT_PERMISSIONS), False, True),
    "moderator": (50, ["post.create", "post.delete_any", "comment.create", "member.invite", "member.approve", "member.mute", "member.ban"], False, False),
    "member": (0, ["post.create", "comment.create"], True, False),
}
