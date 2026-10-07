"""Publications, interactions et statuts.
SOURCE DE VERITE = PostgreSQL (autorisation par jointure, moderation, FK, transactions).
MongoDB = read-model `post_cards` (carte denormalisee pour hydrater le feed) ; Redis = timeline chaude (ZSET d'IDs)
+ compteurs de vues. Tout est reconstructible depuis ce module (voir feed.rebuild_*).
Fusion volontaire Like/Reaction : un 'like' est une reaction de type 'like' (UNE table, UNE verite)."""
from __future__ import annotations

from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone

from apps.core.choices import Visibility
from apps.core.models import SoftDeleteModel, UUIDModel

U = settings.AUTH_USER_MODEL


class Post(UUIDModel, SoftDeleteModel):
    class Kind(models.TextChoices):
        TEXT = "text", "Texte"
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        LINK = "link", "Lien"
        CODE = "code", "Code"
        REPOSITORY = "repository", "Depot (GitHub/GitLab)"
        PROJECT = "project", "Projet"
        PORTFOLIO = "portfolio", "Portfolio"
        EVENT = "event", "Evenement"
        JOB = "job", "Offre d'emploi"
        COURSE = "course", "Formation"
        POLL = "poll", "Sondage"
        EXTERNAL = "external", "Contenu externe (embed officiel)"

    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        PUBLISHED = "published", "Publie"
        PENDING_REVIEW = "pending_review", "En moderation"
        HIDDEN = "hidden", "Masque par la moderation"
        REMOVED = "removed", "Retire"

    author = models.ForeignKey(U, on_delete=models.CASCADE, related_name="posts")
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.TEXT)
    status = models.CharField(max_length=14, choices=Status.choices, default=Status.PUBLISHED)
    title = models.CharField(max_length=200, blank=True)
    body = models.TextField(max_length=20000, blank=True)
    language = models.CharField(max_length=8, blank=True)
    visibility = models.CharField(max_length=14, choices=Visibility.choices, default=Visibility.PUBLIC)
    group = models.ForeignKey("community.Group", null=True, blank=True, on_delete=models.CASCADE, related_name="posts")
    community = models.ForeignKey("community.Community", null=True, blank=True, on_delete=models.SET_NULL, related_name="posts")
    # Donnees specifiques au type (code: {language, filename}, link: {url,title}, repository: {provider, full_name}...)
    payload = models.JSONField(default=dict, blank=True)
    # Reference vers un objet d'un autre domaine (job/course/project/event/external) : par id, pas de FK.
    ref_type = models.CharField(max_length=30, blank=True)
    ref_id = models.UUIDField(null=True, blank=True)
    # Compteurs denormalises : maintenus par triggers (reactions, commentaires, partages, sauvegardes)
    # et par flush Redis (vues). Eventual consistency acceptee (voir ARCHITECTURE_DATA.md).
    reaction_count = models.PositiveIntegerField(default=0, editable=False)
    comment_count = models.PositiveIntegerField(default=0, editable=False)
    share_count = models.PositiveIntegerField(default=0, editable=False)
    save_count = models.PositiveIntegerField(default=0, editable=False)
    view_count = models.PositiveBigIntegerField(default=0, editable=False)
    is_pinned = models.BooleanField(default=False)
    comments_enabled = models.BooleanField(default=True)
    published_at = models.DateTimeField(default=timezone.now)
    edited_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "social_post"
        constraints = [
            models.CheckConstraint(condition=~Q(visibility="group_members") | Q(group__isnull=False), name="chk_post_group_visibility"),
            models.CheckConstraint(condition=Q(ref_type="", ref_id__isnull=True) | ~Q(ref_type="") & Q(ref_id__isnull=False), name="chk_post_ref_pair"),
            models.CheckConstraint(condition=~Q(kind__in=["text"]) | ~Q(body=""), name="chk_post_text_has_body"),
        ]
        indexes = [
            # Profil d'un auteur / fan-out : "posts publies de A, du plus recent".
            models.Index(fields=["author", "-published_at"], name="post_author_pub_idx", condition=Q(status="published", deleted_at__isnull=True)),
            # Page d'un groupe.
            models.Index(fields=["group", "-published_at"], name="post_group_pub_idx", condition=Q(status="published", deleted_at__isnull=True, group__isnull=False)),
            # Decouverte publique (explorer) : index partiel tres selectif.
            models.Index(fields=["-published_at"], name="post_public_pub_idx", condition=Q(status="published", deleted_at__isnull=True, visibility="public")),
            models.Index(fields=["kind", "-published_at"], name="post_kind_pub_idx", condition=Q(status="published", deleted_at__isnull=True)),
            GinIndex(fields=["payload"], name="post_payload_gin", opclasses=["jsonb_path_ops"]),
            models.Index(fields=["ref_type", "ref_id"], name="post_ref_idx", condition=Q(ref_id__isnull=False)),
        ]

    def __str__(self) -> str:
        return f"Post<{self.pk}> {self.kind}"


class PostMedia(UUIDModel):
    class Kind(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        AUDIO = "audio", "Audio"
        DOCUMENT = "document", "Document"

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="media")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    storage_key = models.CharField(max_length=400)
    mime_type = models.CharField(max_length=120)
    size_bytes = models.BigIntegerField()
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    alt_text = models.CharField(max_length=300, blank=True)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "social_post_media"
        constraints = [
            models.UniqueConstraint(fields=["post", "position"], name="uniq_postmedia_position"),
            models.CheckConstraint(condition=Q(size_bytes__gte=0), name="chk_postmedia_size"),
        ]


class Hashtag(models.Model):
    id = models.BigAutoField(primary_key=True)
    tag = models.CharField(max_length=60, unique=True)  # toujours en minuscules, sans '#'
    post_count = models.PositiveIntegerField(default=0, editable=False)

    class Meta:
        db_table = "social_hashtag"
        constraints = [models.CheckConstraint(condition=Q(tag=Lower("tag")), name="chk_hashtag_lower")]
        indexes = [GinIndex(fields=["tag"], name="hashtag_trgm", opclasses=["gin_trgm_ops"]),
                   models.Index(fields=["-post_count"], name="hashtag_popular_idx")]


class PostHashtag(models.Model):
    id = models.BigAutoField(primary_key=True)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="post_hashtags")
    hashtag = models.ForeignKey(Hashtag, on_delete=models.CASCADE, related_name="post_hashtags")

    class Meta:
        db_table = "social_post_hashtag"
        constraints = [models.UniqueConstraint(fields=["post", "hashtag"], name="uniq_post_hashtag")]
        indexes = [models.Index(fields=["hashtag", "-post_id"], name="posthashtag_tag_idx")]


class PostMention(models.Model):
    id = models.BigAutoField(primary_key=True)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="mentions")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="post_mentions")

    class Meta:
        db_table = "social_post_mention"
        constraints = [models.UniqueConstraint(fields=["post", "user"], name="uniq_post_mention")]
        indexes = [models.Index(fields=["user"], name="postmention_user_idx")]


class PostAudience(models.Model):
    """Audience personnalisee (visibility='custom') : liste blanche d'utilisateurs."""

    id = models.BigAutoField(primary_key=True)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="audience")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")

    class Meta:
        db_table = "social_post_audience"
        constraints = [models.UniqueConstraint(fields=["post", "user"], name="uniq_post_audience")]
        indexes = [models.Index(fields=["user", "post"], name="postaudience_user_idx")]


class ReactionType(models.TextChoices):
    LIKE = "like", "J'aime"
    LOVE = "love", "J'adore"
    CELEBRATE = "celebrate", "Bravo"
    INSIGHTFUL = "insightful", "Instructif"
    FUNNY = "funny", "Drole"
    SUPPORT = "support", "Soutien"


class PostReaction(models.Model):
    id = models.BigAutoField(primary_key=True)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    type = models.CharField(max_length=12, choices=ReactionType.choices, default=ReactionType.LIKE)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "social_post_reaction"
        constraints = [models.UniqueConstraint(fields=["post", "user"], name="uniq_post_reaction")]  # 1 reaction/utilisateur
        indexes = [models.Index(fields=["user", "-created_at"], name="postreaction_user_idx")]  # "posts que j'ai aimes", signal reco


class Comment(UUIDModel, SoftDeleteModel):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(U, on_delete=models.CASCADE, related_name="comments")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies")
    depth = models.PositiveSmallIntegerField(default=0)  # 0 racine ; plafonne a 2 (lisibilite + requetes bornees)
    body = models.TextField(max_length=5000)
    reaction_count = models.PositiveIntegerField(default=0, editable=False)
    reply_count = models.PositiveIntegerField(default=0, editable=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "social_comment"
        constraints = [
            models.CheckConstraint(condition=Q(depth__lte=2), name="chk_comment_depth"),
            models.CheckConstraint(condition=Q(parent__isnull=True, depth=0) | Q(parent__isnull=False, depth__gt=0), name="chk_comment_parent_depth"),
            models.CheckConstraint(condition=~Q(body=""), name="chk_comment_body"),
        ]
        indexes = [
            models.Index(fields=["post", "created_at", "id"], name="comment_post_root_idx", condition=Q(parent__isnull=True, deleted_at__isnull=True)),
            models.Index(fields=["parent", "created_at", "id"], name="comment_replies_idx", condition=Q(parent__isnull=False)),
            models.Index(fields=["author", "-created_at"], name="comment_author_idx"),
        ]


class CommentReaction(models.Model):
    id = models.BigAutoField(primary_key=True)
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    type = models.CharField(max_length=12, choices=ReactionType.choices, default=ReactionType.LIKE)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "social_comment_reaction"
        constraints = [models.UniqueConstraint(fields=["comment", "user"], name="uniq_comment_reaction")]


class Share(UUIDModel):
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="shares")
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="shares")
    comment = models.CharField(max_length=1000, blank=True)
    visibility = models.CharField(max_length=14, choices=Visibility.choices, default=Visibility.PUBLIC)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "social_share"
        constraints = [models.UniqueConstraint(fields=["user", "post"], name="uniq_share")]
        indexes = [models.Index(fields=["post", "-created_at"], name="share_post_idx")]


class Save(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="saved_posts")
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="saves")
    collection = models.CharField(max_length=60, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "social_save"
        constraints = [models.UniqueConstraint(fields=["user", "post"], name="uniq_save")]
        indexes = [models.Index(fields=["user", "-created_at"], name="save_user_idx")]


class Poll(models.Model):
    post = models.OneToOneField(Post, primary_key=True, on_delete=models.CASCADE, related_name="poll")
    question = models.CharField(max_length=300)
    allows_multiple = models.BooleanField(default=False)
    is_anonymous = models.BooleanField(default=False)
    closes_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "social_poll"


class PollOption(UUIDModel):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="options")
    label = models.CharField(max_length=200)
    position = models.PositiveSmallIntegerField(default=0)
    vote_count = models.PositiveIntegerField(default=0, editable=False)

    class Meta:
        db_table = "social_poll_option"
        constraints = [models.UniqueConstraint(fields=["poll", "position"], name="uniq_polloption_position")]


class PollVote(models.Model):
    id = models.BigAutoField(primary_key=True)
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="votes")
    option = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name="votes")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "social_poll_vote"
        constraints = [models.UniqueConstraint(fields=["option", "user"], name="uniq_pollvote_option_user")]
        indexes = [models.Index(fields=["poll", "user"], name="pollvote_poll_user_idx")]


class PostEditHistory(models.Model):
    id = models.BigAutoField(primary_key=True)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="edits")
    previous_title = models.CharField(max_length=200, blank=True)
    previous_body = models.TextField(blank=True)
    previous_payload = models.JSONField(default=dict, blank=True)
    edited_by = models.ForeignKey(U, null=True, on_delete=models.SET_NULL, related_name="+")
    edited_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "social_post_edit_history"
        indexes = [models.Index(fields=["post", "-edited_at"], name="postedit_post_idx")]


class Status(UUIDModel, SoftDeleteModel):
    """Publication ephemere (24 h par defaut). Persistee en PostgreSQL (audience, vues, moderation) ;
    l'expiration est LOGIQUE (expires_at filtre dans les requetes) et un job purge/archive. Redis n'est pas necessaire
    a la correction, seulement a l'accelération (cache de la liste de statuts actifs d'un utilisateur)."""

    class Kind(models.TextChoices):
        TEXT = "text", "Texte"
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        AUDIO = "audio", "Audio"
        LINK = "link", "Lien"
        DOCUMENT = "document", "Document"

    author = models.ForeignKey(U, on_delete=models.CASCADE, related_name="statuses")
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.TEXT)
    body = models.CharField(max_length=700, blank=True)
    storage_key = models.CharField(max_length=400, blank=True)
    mime_type = models.CharField(max_length=120, blank=True)
    link_url = models.URLField(max_length=500, blank=True)
    style = models.JSONField(default=dict, blank=True)  # fond, police pour les statuts texte
    visibility = models.CharField(max_length=14, choices=Visibility.choices, default=Visibility.FRIENDS)
    expires_at = models.DateTimeField()
    archived_at = models.DateTimeField(null=True, blank=True)  # conserve dans 'archive' apres expiration si l'auteur le souhaite
    view_count = models.PositiveIntegerField(default=0, editable=False)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "social_status"
        verbose_name_plural = "statuses"
        constraints = [
            models.CheckConstraint(condition=Q(expires_at__gt=models.F("created_at")), name="chk_status_expiry"),
            models.CheckConstraint(condition=~Q(visibility="group_members"), name="chk_status_no_group_visibility"),
            models.CheckConstraint(condition=Q(kind="text", body__gt="") | ~Q(kind="text"), name="chk_status_text_body"),
        ]
        indexes = [
            models.Index(fields=["author", "-created_at"], name="status_author_idx"),
            # Purge/archivage : seulement ce qui est a expirer.
            models.Index(fields=["expires_at"], name="status_expiry_idx", condition=Q(archived_at__isnull=True, deleted_at__isnull=True)),
        ]


class StatusAudience(models.Model):
    id = models.BigAutoField(primary_key=True)
    status = models.ForeignKey(Status, on_delete=models.CASCADE, related_name="audience")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")

    class Meta:
        db_table = "social_status_audience"
        constraints = [models.UniqueConstraint(fields=["status", "user"], name="uniq_status_audience")]
        indexes = [models.Index(fields=["user", "status"], name="statusaud_user_idx")]


class StatusView(models.Model):
    id = models.BigAutoField(primary_key=True)
    status = models.ForeignKey(Status, on_delete=models.CASCADE, related_name="views")
    viewer = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    viewed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "social_status_view"
        constraints = [models.UniqueConstraint(fields=["status", "viewer"], name="uniq_status_view")]
        indexes = [models.Index(fields=["viewer", "-viewed_at"], name="statusview_viewer_idx")]


class StatusReaction(models.Model):
    id = models.BigAutoField(primary_key=True)
    status = models.ForeignKey(Status, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    emoji = models.CharField(max_length=32)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "social_status_reaction"
        constraints = [models.UniqueConstraint(fields=["status", "user"], name="uniq_status_reaction")]


class StatusReply(UUIDModel):
    """Reponse privee a un statut : livree comme message direct a l'auteur (conversation_ref/message_ref)."""

    status = models.ForeignKey(Status, on_delete=models.CASCADE, related_name="replies")
    author = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    body = models.CharField(max_length=1000)
    message_ref = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "social_status_reply"
        indexes = [models.Index(fields=["status", "created_at"], name="statusreply_status_idx")]
