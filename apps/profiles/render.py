"""Formes de sortie communes (profil resume, URL d'avatar signee)."""
from __future__ import annotations

from apps.storage.services import signed_url


def file_url(key: str) -> str | None:
    return signed_url(key) if key else None


def user_brief(user) -> dict:
    p = getattr(user, "profile", None)
    return {"username": user.username, "display_name": p.display_name if p else user.username, "avatar_url": file_url(p.avatar_key) if p else None}


def profile_full(user, *, private: bool = False) -> dict:
    p = user.profile
    out = {
        **user_brief(user), "headline": p.headline, "bio": p.bio, "cover_url": file_url(p.cover_key),
        "country": {"code": p.country_id, "name": p.country.name} if p.country_id else None, "region": p.region, "city": p.city, "languages": p.languages,
        "profession": {"slug": p.profession.slug, "name": p.profession.name} if p.profession_id else None, "availability": p.availability, "is_verified": p.is_verified,
        "skills": [{"slug": us.skill.slug, "name": us.skill.name, "level": us.level, "years_experience": us.years_experience} for us in user.user_skills.select_related("skill")],
        "interests": [ui.interest.slug for ui in user.user_interests.select_related("interest")],
        "links": [{"id": str(l.pk), "provider": l.provider, "url": l.url, "handle": l.handle} for l in user.social_links.all()],
    }
    if private:
        out["email"] = user.email
        out["status"] = user.status
    return out
