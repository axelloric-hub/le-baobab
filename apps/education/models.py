"""LMS : Classroom > Course > Module > Chapter > ContentBlock.
PRIX : porte par le Course (bundle), le Module (bundle) ET le Chapter. Regle de verite : `Chapter.is_free` decide si un chapitre
exige un paiement ; un droit (Entitlement) sur le chapitre, son module, son cours ou sa classroom le debloque.
Un module payant peut donc contenir des chapitres gratuits (apercu) et un module gratuit des chapitres payants.
Les contraintes CHECK interdisent les incoherences (gratuit avec prix, payant sans prix). Les paiements eux-memes vivent
dans le futur domaine marketplace : ici on ne connait qu'une REFERENCE (`source_ref`) et on accorde des droits idempotents."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import UUIDModel

U = settings.AUTH_USER_MODEL


def _price_checks(prefix: str) -> list[models.CheckConstraint]:
    """is_free <=> pas de prix ; payant => prix > 0 ET devise."""
    return [
        models.CheckConstraint(condition=Q(is_free=True, price_minor__isnull=True) | Q(is_free=False, price_minor__gt=0) & ~Q(currency=""),
                               name=f"chk_{prefix}_pricing"),
    ]


class Classroom(UUIDModel):
    class Privacy(models.TextChoices):
        PUBLIC = "public", "Publique"
        PRIVATE = "private", "Privee (adhesion sur approbation)"
        INVITE_ONLY = "invite_only", "Sur invitation"
        ORGANIZATION = "organization", "Reservee a une organisation"

    slug = models.SlugField(max_length=80, unique=True)
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=5000, blank=True)
    owner = models.ForeignKey(U, on_delete=models.PROTECT, related_name="owned_classrooms")
    privacy = models.CharField(max_length=14, choices=Privacy.choices, default=Privacy.PUBLIC)
    is_paid = models.BooleanField(default=False)  # acces a toute la classroom payant (droit de portee 'classroom')
    price_minor = models.PositiveIntegerField(null=True, blank=True)
    currency = models.CharField(max_length=3, blank=True)
    organization_ref = models.UUIDField(null=True, blank=True)  # futur domaine companies : reference par id
    group = models.ForeignKey("community.Group", null=True, blank=True, on_delete=models.SET_NULL, related_name="classrooms")
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "education_classroom"
        constraints = [
            models.CheckConstraint(condition=Q(is_paid=False, price_minor__isnull=True) | Q(is_paid=True, price_minor__gt=0) & ~Q(currency=""), name="chk_classroom_pricing"),
            models.CheckConstraint(condition=~Q(privacy="organization") | Q(organization_ref__isnull=False), name="chk_classroom_org_ref"),
        ]
        indexes = [models.Index(fields=["privacy", "-created_at"], name="classroom_discover_idx", condition=Q(archived_at__isnull=True))]

    def __str__(self) -> str:
        return self.title


class ClassroomMember(UUIDModel):
    class Role(models.TextChoices):
        OWNER = "owner", "Proprietaire"
        INSTRUCTOR = "instructor", "Enseignant"
        ASSISTANT = "assistant", "Assistant"
        STUDENT = "student", "Etudiant"

    class Status(models.TextChoices):
        PENDING = "pending", "En attente d'approbation"
        ACTIVE = "active", "Actif"
        BANNED = "banned", "Banni"

    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="classroom_memberships")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.ACTIVE)
    joined_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "education_classroom_member"
        constraints = [models.UniqueConstraint(fields=["classroom", "user"], name="uniq_classroom_member")]
        indexes = [models.Index(fields=["user", "status"], name="classmember_user_idx"),
                   models.Index(fields=["classroom", "-joined_at"], name="classmember_pending_idx", condition=Q(status="pending"))]


class ClassroomInvitation(UUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        ACCEPTED = "accepted", "Acceptee"
        DECLINED = "declined", "Refusee"
        REVOKED = "revoked", "Revoquee"

    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name="invitations")
    invited_user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="classroom_invitations")
    invited_by = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    role = models.CharField(max_length=10, choices=ClassroomMember.Role.choices, default=ClassroomMember.Role.STUDENT)
    status = models.CharField(max_length=9, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "education_classroom_invitation"
        constraints = [models.UniqueConstraint(fields=["classroom", "invited_user"], condition=Q(status="pending"), name="uniq_classinvite_pending")]


class Course(UUIDModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        PUBLISHED = "published", "Publie"
        ARCHIVED = "archived", "Archive"

    class Level(models.TextChoices):
        BEGINNER = "beginner", "Debutant"
        INTERMEDIATE = "intermediate", "Intermediaire"
        ADVANCED = "advanced", "Avance"

    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name="courses")
    slug = models.SlugField(max_length=80)
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=10000, blank=True)
    level = models.CharField(max_length=14, choices=Level.choices, default=Level.BEGINNER)
    language = models.CharField(max_length=8, default="fr")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    is_free = models.BooleanField(default=True)  # prix du bundle 'cours entier'
    price_minor = models.PositiveIntegerField(null=True, blank=True)
    currency = models.CharField(max_length=3, blank=True)
    certificate_enabled = models.BooleanField(default=True)
    skills = models.ManyToManyField("profiles.Skill", blank=True, related_name="courses", db_table="education_course_skill")
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "education_course"
        constraints = [models.UniqueConstraint(fields=["classroom", "slug"], name="uniq_course_slug"),
                       *_price_checks("course"),
                       models.CheckConstraint(condition=~Q(status="published") | Q(published_at__isnull=False), name="chk_course_published_dated")]
        indexes = [models.Index(fields=["-published_at"], name="course_published_idx", condition=Q(status="published")),
                   models.Index(fields=["classroom", "status"], name="course_classroom_idx")]


class CourseInstructor(UUIDModel):
    class Role(models.TextChoices):
        LEAD = "lead", "Enseignant principal"
        ASSISTANT = "assistant", "Co-enseignant"

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="instructors")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="teaching")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.ASSISTANT)

    class Meta:
        db_table = "education_course_instructor"
        constraints = [models.UniqueConstraint(fields=["course", "user"], name="uniq_course_instructor")]


class Module(UUIDModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    position = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=3000, blank=True)
    is_free = models.BooleanField(default=True)
    price_minor = models.PositiveIntegerField(null=True, blank=True)
    currency = models.CharField(max_length=3, blank=True)
    is_published = models.BooleanField(default=False)

    class Meta:
        db_table = "education_module"
        constraints = [models.UniqueConstraint(fields=["course", "position"], name="uniq_module_position", deferrable=models.Deferrable.DEFERRED),
                       *_price_checks("module")]


class Chapter(UUIDModel):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="chapters")
    position = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=160)
    estimated_minutes = models.PositiveSmallIntegerField(default=10)
    is_free = models.BooleanField(default=True)  # AUTORITE : un chapitre non gratuit exige un droit
    price_minor = models.PositiveIntegerField(null=True, blank=True)
    currency = models.CharField(max_length=3, blank=True)
    is_published = models.BooleanField(default=False)

    class Meta:
        db_table = "education_chapter"
        constraints = [models.UniqueConstraint(fields=["module", "position"], name="uniq_chapter_position", deferrable=models.Deferrable.DEFERRED),
                       *_price_checks("chapter")]


class ContentBlock(UUIDModel):
    """Bloc de contenu extensible : un chapitre = une suite ordonnee de blocs de types varies."""

    class Kind(models.TextChoices):
        TEXT = "text", "Texte"
        PDF = "pdf", "PDF"
        IMAGE = "image", "Image"
        AUDIO = "audio", "Audio"
        VIDEO = "video", "Video"
        CODE = "code", "Code"
        NOTEBOOK = "notebook", "Notebook"
        PRESENTATION = "presentation", "Presentation"
        DOCUMENT = "document", "Document"
        LINK = "link", "Lien"
        EMBED = "embed", "Embed"
        QUIZ = "quiz", "Quiz"
        EXERCISE = "exercise", "Exercice"

    FILE_KINDS = ("pdf", "image", "audio", "video", "notebook", "presentation", "document")

    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name="blocks")
    position = models.PositiveSmallIntegerField()
    kind = models.CharField(max_length=12, choices=Kind.choices)
    title = models.CharField(max_length=160, blank=True)
    body = models.TextField(blank=True)
    storage_key = models.CharField(max_length=400, blank=True)
    url = models.URLField(max_length=600, blank=True)
    ref_id = models.UUIDField(null=True, blank=True)  # quiz / exercice : reference par id (domaine assessments)
    payload = models.JSONField(default=dict, blank=True)  # ex: {"language": "python"}
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = "education_content_block"
        constraints = [
            models.UniqueConstraint(fields=["chapter", "position"], name="uniq_block_position", deferrable=models.Deferrable.DEFERRED),
            # Un bloc doit contenir CE QUE son type exige.
            models.CheckConstraint(condition=~Q(kind__in=["text", "code"]) | ~Q(body=""), name="chk_block_text_body"),
            models.CheckConstraint(condition=~Q(kind__in=["pdf", "image", "audio", "video", "notebook", "presentation", "document"]) | ~Q(storage_key="") | ~Q(url=""), name="chk_block_file_source"),
            models.CheckConstraint(condition=~Q(kind__in=["link", "embed"]) | Q(url__startswith="https://"), name="chk_block_link_https"),
            models.CheckConstraint(condition=~Q(kind__in=["quiz", "exercise"]) | Q(ref_id__isnull=False), name="chk_block_ref"),
        ]


class Enrollment(UUIDModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Inscrit"
        COMPLETED = "completed", "Termine"
        DROPPED = "dropped", "Abandonne"

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="enrollments")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    enrolled_at = models.DateTimeField(default=timezone.now, editable=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "education_enrollment"
        constraints = [models.UniqueConstraint(fields=["course", "user"], name="uniq_enrollment"),  # pas de double inscription
                       models.CheckConstraint(condition=~Q(status="completed") | Q(completed_at__isnull=False), name="chk_enrollment_completed_dated")]
        indexes = [models.Index(fields=["user", "-enrolled_at"], name="enrollment_user_idx")]


class Entitlement(UUIDModel):
    """Droit d'acces accorde (achat, offre, abonnement). `grant_key` rend l'octroi IDEMPOTENT : un webhook de paiement rejoue
    ne cree jamais deux droits. Revocation = champ `revoked_at` (l'historique financier n'est jamais supprime)."""

    class Scope(models.TextChoices):
        CLASSROOM = "classroom", "Classroom"
        COURSE = "course", "Cours"
        MODULE = "module", "Module"
        CHAPTER = "chapter", "Chapitre"

    class Source(models.TextChoices):
        PURCHASE = "purchase", "Achat"
        GRANT = "grant", "Offert"
        SUBSCRIPTION = "subscription", "Abonnement"
        INSTRUCTOR = "instructor", "Enseignant"

    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="entitlements")
    scope = models.CharField(max_length=10, choices=Scope.choices)
    classroom = models.ForeignKey(Classroom, null=True, blank=True, on_delete=models.CASCADE, related_name="entitlements")
    course = models.ForeignKey(Course, null=True, blank=True, on_delete=models.CASCADE, related_name="entitlements")
    module = models.ForeignKey(Module, null=True, blank=True, on_delete=models.CASCADE, related_name="entitlements")
    chapter = models.ForeignKey(Chapter, null=True, blank=True, on_delete=models.CASCADE, related_name="entitlements")
    source = models.CharField(max_length=12, choices=Source.choices)
    source_ref = models.CharField(max_length=100, blank=True)  # ex: identifiant de commande
    grant_key = models.CharField(max_length=200, blank=True)  # cle d'idempotence
    granted_at = models.DateTimeField(default=timezone.now, editable=False)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "education_entitlement"
        constraints = [
            # Exactement UNE cible, et c'est celle de `scope`.
            models.CheckConstraint(condition=(Q(scope="classroom", classroom__isnull=False, course__isnull=True, module__isnull=True, chapter__isnull=True)
                                              | Q(scope="course", classroom__isnull=True, course__isnull=False, module__isnull=True, chapter__isnull=True)
                                              | Q(scope="module", classroom__isnull=True, course__isnull=True, module__isnull=False, chapter__isnull=True)
                                              | Q(scope="chapter", classroom__isnull=True, course__isnull=True, module__isnull=True, chapter__isnull=False)),
                                   name="chk_entitlement_single_target"),
            models.UniqueConstraint(fields=["grant_key"], condition=~Q(grant_key=""), name="uniq_entitlement_grant_key"),
        ]
        indexes = [
            models.Index(fields=["user", "scope"], name="entitlement_user_idx", condition=Q(revoked_at__isnull=True)),
            models.Index(fields=["chapter"], name="entitlement_chapter_idx", condition=Q(chapter__isnull=False)),
            models.Index(fields=["module"], name="entitlement_module_idx", condition=Q(module__isnull=False)),
            models.Index(fields=["course"], name="entitlement_course_idx", condition=Q(course__isnull=False)),
        ]
