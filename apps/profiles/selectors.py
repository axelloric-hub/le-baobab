from __future__ import annotations

from apps.accounts.models import User
from apps.friends.selectors import visibility_allows


def active_user(username: str):
    return User.objects.filter(username=username.lower(), status="active").select_related("profile", "privacy").first()


def can_view_profile(viewer, owner: User) -> bool:
    return owner.status == "active" and visibility_allows(getattr(viewer, "pk", None), owner.pk, owner.privacy.profile_visibility)


def get_active_or_404(username: str):
    from rest_framework.exceptions import NotFound

    u = active_user(username)
    if u is None:
        raise NotFound()
    return u
