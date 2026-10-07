"""Pipelines d'agregation MongoDB reutilisables : fonctions PURES qui construisent le pipeline (testables sans base)
+ petits runners. Chaque pipeline s'appuie sur un index decrit dans database/mongodb/collections/*.json."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from apps.core.mongo import collection


def trending_hashtags(since: datetime, limit: int = 20) -> list[dict[str, Any]]:
    """post_cards -> hashtags les plus utilises (public) sur la fenetre, pondere par l'engagement. Index: recent_public."""
    return [
        {"$match": {"published_at": {"$gte": since}, "visibility": "public"}},
        {"$unwind": "$hashtags"},
        {"$group": {"_id": "$hashtags", "posts": {"$sum": 1}, "reactions": {"$sum": "$counters.reactions"},
                    "authors": {"$addToSet": "$author.id"}}},
        {"$project": {"tag": "$_id", "_id": 0, "posts": 1, "reactions": 1, "authors": {"$size": "$authors"}}},
        {"$sort": {"posts": -1, "reactions": -1}},
        {"$limit": limit},
    ]


def top_posts_by_engagement(since: datetime, limit: int = 20) -> list[dict[str, Any]]:
    return [
        {"$match": {"published_at": {"$gte": since}, "visibility": "public"}},
        {"$addFields": {"engagement": {"$add": ["$counters.reactions", {"$multiply": ["$counters.comments", 3]}, {"$multiply": ["$counters.shares", 5]}]}}},
        {"$sort": {"engagement": -1, "published_at": -1}},
        {"$limit": limit},
        {"$project": {"_id": 1, "author.username": 1, "kind": 1, "engagement": 1, "published_at": 1}},
    ]


def top_authors_by_engagement(since: datetime, limit: int = 20) -> list[dict[str, Any]]:
    return [
        {"$match": {"published_at": {"$gte": since}, "visibility": "public"}},
        {"$group": {"_id": "$author.id", "username": {"$first": "$author.username"}, "posts": {"$sum": 1},
                    "reactions": {"$sum": "$counters.reactions"}, "comments": {"$sum": "$counters.comments"}}},
        {"$sort": {"reactions": -1, "posts": -1}},
        {"$limit": limit},
    ]


def daily_event_counts(event_type: str, since: datetime) -> list[dict[str, Any]]:
    """events -> nombre par jour. Index: type_ts."""
    return [
        {"$match": {"type": event_type, "ts": {"$gte": since}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$ts"}}, "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "day": "$_id", "count": 1}},
        {"$sort": {"day": 1}},
    ]


def daily_active_actors(since: datetime) -> list[dict[str, Any]]:
    """DAU : deux $group (jour+acteur puis jour) -> memoire bornee, contrairement a un $addToSet geant."""
    return [
        {"$match": {"ts": {"$gte": since}, "actor.id": {"$type": "string"}}},
        {"$group": {"_id": {"day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$ts"}}, "actor": "$actor.id"}}},
        {"$group": {"_id": "$_id.day", "active_users": {"$sum": 1}}},
        {"$project": {"_id": 0, "day": "$_id", "active_users": 1}},
        {"$sort": {"day": 1}},
    ]


def user_interest_signals(actor_id: str, since: datetime) -> list[dict[str, Any]]:
    """Signaux bruts par type d'evenement pour UN utilisateur (entree du futur moteur de recommandation). Index: actor_ts."""
    return [
        {"$match": {"actor.id": actor_id, "ts": {"$gte": since}}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}, "last": {"$max": "$ts"}}},
        {"$project": {"_id": 0, "type": "$_id", "count": 1, "last": 1}},
        {"$sort": {"count": -1}},
    ]


def run(coll: str, pipeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return list(collection(coll).aggregate(pipeline))
