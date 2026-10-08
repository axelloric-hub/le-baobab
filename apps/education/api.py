"""Education : classrooms, cours, contenus, inscriptions, droits d'acces. Un contenu payant renvoie 402 avec la raison ; les fichiers sont servis par URL signee APRES controle d'acces."""
from __future__ import annotations

from rest_framework import serializers as s
from rest_framework.response import Response

from apps.core.api import endpoint, get_or_404, paginate
from apps.core.exceptions import PaymentRequiredError, PermissionDeniedError
from apps.education import services as E
from apps.education.access import access_decision, is_course_staff
from apps.education.models import Chapter, Classroom, ClassroomInvitation, ClassroomMember, ContentBlock, Course, Enrollment, Entitlement, Module
from apps.profiles.render import user_brief
from apps.profiles.selectors import get_active_or_404 as _u
from apps.progress.services import course_progress, module_progress
from apps.storage.services import resolve_owned, signed_url

PRICE = lambda: {"is_free": s.BooleanField(default=True), "price_minor": s.IntegerField(min_value=1, required=False, allow_null=True), "currency": s.CharField(max_length=3, required=False, allow_blank=True, default="")}  # noqa: E731
REASON_MESSAGES = {"not_published": "Ce contenu n'est pas encore publie.", "membership_required": "Rejoignez d'abord la classroom.", "classroom_payment_required": "Cette classroom est payante.",
                   "enroll_required": "Inscrivez-vous au cours pour acceder a ce contenu.", "payment_required": "Ce contenu est payant."}


def _uid(request):
    return getattr(request.user, "pk", None)


def _classroom(request, slug) -> Classroom:
    c = get_or_404(Classroom.objects.filter(slug=slug, archived_at__isnull=True))
    uid = _uid(request)
    member = uid and ClassroomMember.objects.filter(classroom=c, user_id=uid, status__in=["active", "pending"]).exists()
    invited = uid and ClassroomInvitation.objects.filter(classroom=c, invited_user_id=uid, status="pending").exists()
    if c.privacy != "public" and not (member or invited):
        get_or_404(Classroom.objects.none())  # une classroom non publique n'existe pas pour les etrangers
    return c


def _classroom_json(c: Classroom, request) -> dict:
    uid = _uid(request)
    m = ClassroomMember.objects.filter(classroom=c, user_id=uid).first() if uid else None
    return {"slug": c.slug, "title": c.title, "description": c.description, "privacy": c.privacy, "is_paid": c.is_paid, "price_minor": c.price_minor, "currency": c.currency,
            "my_role": m.role if m else None, "my_status": m.status if m else None}


def _course(request, course_id) -> Course:
    c = get_or_404(Course.objects.filter(pk=course_id).select_related("classroom"))
    if is_course_staff(request.user, c):
        return c
    uid = _uid(request)
    member = uid and ClassroomMember.objects.filter(classroom=c.classroom, user_id=uid, status="active").exists()
    if c.status != "published" or (c.classroom.privacy != "public" and not member):
        get_or_404(Course.objects.none())
    return c


def _course_json(c: Course) -> dict:
    return {"id": str(c.pk), "classroom": c.classroom.slug, "slug": c.slug, "title": c.title, "description": c.description, "level": c.level, "language": c.language, "status": c.status,
            "is_free": c.is_free, "price_minor": c.price_minor, "currency": c.currency, "certificate_enabled": c.certificate_enabled, "published_at": c.published_at,
            "instructors": [i.user.username for i in c.instructors.select_related("user")]}


# ------------------------------------------------------------------ classrooms
@endpoint("Decouvrir les classrooms publiques.", auth="optional", query={"q": s.CharField(required=False, max_length=60)})
def list_classrooms(request):
    qs = Classroom.objects.filter(archived_at__isnull=True, privacy="public")
    if request.q.get("q"):
        qs = qs.filter(title__icontains=request.q["q"])
    return paginate(request, qs, ("-created_at", "-id"), lambda c: _classroom_json(c, request), 20)


@endpoint("Mes classrooms (membre ou en attente).")
def my_classrooms(request):
    qs = Classroom.objects.filter(members__user=request.user, archived_at__isnull=True)
    return paginate(request, qs, ("-created_at", "-id"), lambda c: _classroom_json(c, request), 50)


@endpoint("Creer une classroom (vous en etes le proprietaire). Une classroom payante exige prix et devise.", status=201,
          body={"title": s.CharField(max_length=160), "slug": s.SlugField(max_length=80), "description": s.CharField(max_length=5000, required=False, allow_blank=True, default=""),
                "privacy": s.ChoiceField(choices=["public", "private", "invite_only"], default="public"), "is_paid": s.BooleanField(default=False),
                "price_minor": s.IntegerField(min_value=1, required=False, allow_null=True), "currency": s.CharField(max_length=3, required=False, allow_blank=True, default="")})
def create_classroom(request):
    c = E.create_classroom(owner=request.user, **request.input)
    return _classroom_json(c, request)


@endpoint("Detail d'une classroom.", auth="optional")
def classroom_detail(request, slug):
    c = _classroom(request, slug)
    return {**_classroom_json(c, request), "courses": [_course_json(x) for x in c.courses.filter(status="published").select_related("classroom")]}


@endpoint("Rejoindre une classroom (public : immediat ; prive : demande ; sur invitation : invitation requise).", status=201)
def join(request, slug):
    m = E.join_classroom(request.user, _classroom(request, slug))
    return {"status": m.status}


@endpoint("Quitter une classroom.", status=204)
def leave(request, slug):
    E.leave_classroom(request.user, _classroom(request, slug))
    return Response(status=204)


@endpoint("[Enseignant] Membres d'une classroom.", query={"status": s.ChoiceField(choices=["active", "pending", "banned"], required=False)})
def members(request, slug):
    c = _classroom(request, slug)
    if not ClassroomMember.objects.filter(classroom=c, user=request.user, status="active", role__in=["owner", "instructor"]).exists() and not request.user.is_staff:
        raise PermissionDeniedError("Reserve aux enseignants.")
    qs = ClassroomMember.objects.filter(classroom=c).select_related("user__profile")
    if request.q.get("status"):
        qs = qs.filter(status=request.q["status"])
    return paginate(request, qs, ("-joined_at", "-id"), lambda m: {"id": str(m.pk), **user_brief(m.user), "role": m.role, "status": m.status}, 50)


@endpoint("[Enseignant] Approuver ou refuser une demande d'adhesion.", body={"approve": s.BooleanField()})
def review_member(request, slug, member_id):
    m = E.review_member(_classroom(request, slug), request.user, member_id, request.input["approve"])
    return {"status": m.status if m else "rejected"}


@endpoint("[Enseignant] Inviter un utilisateur.", status=201, body={"username": s.CharField(max_length=30), "role": s.ChoiceField(choices=["student", "assistant", "instructor"], default="student")})
def invite(request, slug):
    inv = E.invite_to_classroom(_classroom(request, slug), request.user, _u(request.input["username"]), request.input["role"])
    return {"id": str(inv.pk), "status": inv.status}


@endpoint("[Enseignant] Bannir un membre.", status=201, body={"username": s.CharField(max_length=30)})
def ban(request, slug):
    E.ban_member(_classroom(request, slug), request.user, _u(request.input["username"]))
    return {"banned": True}


@endpoint("Mes invitations a des classrooms.")
def my_invitations(request):
    qs = ClassroomInvitation.objects.filter(invited_user=request.user, status="pending").select_related("classroom", "invited_by__profile")
    return [{"id": str(i.pk), "classroom": {"slug": i.classroom.slug, "title": i.classroom.title}, "role": i.role, "invited_by": user_brief(i.invited_by), "expires_at": i.expires_at} for i in qs[:100]]


@endpoint("Accepter ou refuser une invitation.", body={"accept": s.BooleanField()})
def respond_invitation(request, invitation_id):
    inv = E.respond_to_classroom_invitation(invitation_id, request.user, request.input["accept"])
    return {"status": inv.status}


# ------------------------------------------------------------------ cours
@endpoint("Catalogue des cours publies (classrooms publiques).", auth="optional", query={"q": s.CharField(required=False, max_length=60), "free": s.BooleanField(required=False, allow_null=True), "level": s.CharField(required=False)})
def list_courses(request):
    # allow_null=True sur "free" : sinon DRF lit un parametre d'URL ABSENT comme False (comportement case a cocher)
    qs = Course.objects.filter(status="published", classroom__privacy="public", classroom__archived_at__isnull=True).select_related("classroom")
    q = request.q
    if q.get("q"):
        qs = qs.filter(title__icontains=q["q"])
    if q.get("level"):
        qs = qs.filter(level=q["level"])
    if q.get("free") is not None:
        qs = qs.filter(is_free=q["free"])
    return paginate(request, qs, ("-published_at", "-id"), _course_json, 20)


@endpoint("Creer un cours dans une classroom (enseignants).", status=201,
          body={"title": s.CharField(max_length=160), "slug": s.SlugField(max_length=80), "description": s.CharField(max_length=10000, required=False, allow_blank=True, default=""),
                "level": s.ChoiceField(choices=["beginner", "intermediate", "advanced"], default="beginner"), "language": s.CharField(max_length=8, default="fr"),
                "is_free": s.BooleanField(default=True), "price_minor": s.IntegerField(min_value=1, required=False, allow_null=True), "currency": s.CharField(max_length=3, required=False, allow_blank=True, default=""),
                "certificate_enabled": s.BooleanField(default=True)})
def create_course(request, slug):
    c = E.create_course(classroom=_classroom(request, slug), creator=request.user, **request.input)
    return _course_json(Course.objects.select_related("classroom").get(pk=c.pk))


def _chapter_json(ch: Chapter, request, with_access: bool) -> dict:
    out = {"id": str(ch.pk), "position": ch.position, "title": ch.title, "estimated_minutes": ch.estimated_minutes, "is_free": ch.is_free, "price_minor": ch.price_minor, "currency": ch.currency}
    if with_access:
        d = access_decision(request.user, ch)
        out["access"] = {"allowed": d.allowed, "reason": d.reason}
    return out


@endpoint("Plan d'un cours : modules, chapitres, prix, et pour chaque chapitre MON acces (autorise ou raison du refus).", auth="optional")
def course_outline(request, course_id):
    c = _course(request, course_id)
    staff = is_course_staff(request.user, c)
    mods = c.modules.all() if staff else c.modules.filter(is_published=True)
    out = []
    for m in mods.prefetch_related("chapters__module__course__classroom"):
        chs = [ch for ch in m.chapters.all() if staff or ch.is_published][:100]
        out.append({"id": str(m.pk), "position": m.position, "title": m.title, "description": m.description, "is_free": m.is_free, "price_minor": m.price_minor, "currency": m.currency,
                    "chapters": [_chapter_json(ch, request, True) for ch in chs]})
    enrolled = bool(_uid(request)) and Enrollment.objects.filter(course=c, user=request.user, status__in=["active", "completed"]).exists()
    return {**_course_json(c), "enrolled": enrolled, "modules": out}


@endpoint("[Enseignant] Publier le cours (verifie qu'il est exploitable).")
def publish_course(request, course_id):
    return _course_json(E.publish_course(_course(request, course_id), request.user))


@endpoint("[Enseignant principal] Ajouter un co-enseignant (doit etre membre de la classroom).", status=201, body={"username": s.CharField(max_length=30)})
def add_instructor(request, course_id):
    E.add_instructor(_course(request, course_id), request.user, _u(request.input["username"]))
    return {"added": True}


@endpoint("[Enseignant] Ajouter un module. Un module payant exige prix et devise.", status=201, body={"title": s.CharField(max_length=160), "description": s.CharField(max_length=3000, required=False, allow_blank=True, default=""), **PRICE()})
def add_module(request, course_id):
    d = request.input
    m = E.add_module(_course(request, course_id), request.user, title=d["title"], description=d["description"], is_free=d["is_free"], price_minor=d.get("price_minor"), currency=d["currency"])
    return {"id": str(m.pk), "position": m.position}


@endpoint("[Enseignant] Ajouter un chapitre a un module.", status=201, body={"title": s.CharField(max_length=160), "estimated_minutes": s.IntegerField(min_value=1, max_value=600, default=10), **PRICE()})
def add_chapter(request, module_id):
    d = request.input
    m = get_or_404(Module.objects.filter(pk=module_id).select_related("course__classroom"))
    ch = E.add_chapter(m, request.user, title=d["title"], estimated_minutes=d["estimated_minutes"], is_free=d["is_free"], price_minor=d.get("price_minor"), currency=d["currency"])
    return {"id": str(ch.pk), "position": ch.position}


@endpoint("[Enseignant] Ajouter un bloc de contenu. file : fichier envoye (usage 'course_content') pour pdf/image/audio/video/notebook/presentation/document ; url pour video/embed (YouTube : lecteur integre, voir payload.embed_url), repository (depot GitHub public verifie) et link (LinkedIn, GitHub... normalises) ; ref_id pour quiz/exercise.", status=201,
          body={"kind": s.ChoiceField(choices=[c[0] for c in ContentBlock.Kind.choices]), "title": s.CharField(max_length=160, required=False, allow_blank=True, default=""), "body": s.CharField(max_length=100000, required=False, allow_blank=True, default=""),
                "file": s.UUIDField(required=False), "url": s.URLField(required=False, allow_blank=True, default=""), "ref_id": s.UUIDField(required=False), "payload": s.DictField(required=False),
                "duration_seconds": s.IntegerField(min_value=1, required=False)})
def add_block(request, chapter_id):
    d = request.input
    ch = get_or_404(Chapter.objects.filter(pk=chapter_id).select_related("module__course__classroom"))
    key = resolve_owned(request.user, d["file"], ("course_content",)).key if d.get("file") else ""
    url, payload = _checked_link(request.user, d["kind"], d["url"], d.get("payload"), has_file=bool(key))
    b = E.add_block(ch, request.user, kind=d["kind"], title=d["title"], body=d["body"], storage_key=key, url=url, ref_id=d.get("ref_id"), payload=payload, duration_seconds=d.get("duration_seconds"))
    return {"id": str(b.pk), "position": b.position}


def _checked_link(user, kind: str, url: str, payload, *, has_file: bool):
    """Les liens video/embed/depot sont analyses par le SERVEUR : l'adresse du lecteur integre est reconstruite, jamais copiee depuis la requete.
    video / embed : YouTube uniquement (la video se lit dans l'application) ; repository : depot GitHub PUBLIC verifie ; link : LinkedIn/GitHub/YouTube normalises, autres sites tels quels."""
    from apps.core.exceptions import DomainError
    from apps.integrations import services as IS

    if kind not in ("video", "embed", "link", "repository") or (kind == "video" and has_file):
        return url, payload
    if not url:
        raise DomainError("Une adresse (url) est obligatoire pour ce type de bloc.", code="url_required")
    if kind == "link":
        try:
            desc = IS.links.resolve(url)
        except DomainError as exc:
            if exc.code != "unsupported_link":
                raise
            return url, payload  # lien ordinaire vers un autre site
        return desc["canonical_url"], IS.block_payload(desc)
    desc = IS.describe_link(url, user)
    if kind in ("video", "embed") and desc["provider"] != "youtube":
        raise DomainError("Seuls les liens YouTube peuvent etre lus dans l'application. Pour un autre site, utilisez un bloc « link ».", code="unsupported_video_link")
    if kind == "repository" and not (desc["provider"] == "github" and desc["kind"] == "repository"):
        raise DomainError("Collez l'adresse d'un depot GitHub (github.com/proprietaire/depot).", code="repository_link_required")
    return desc["canonical_url"], IS.block_payload(desc)


@endpoint("Contenu d'un chapitre. 200 avec les blocs (fichiers = URL signees courtes) si j'y ai acces ; sinon 402 (payant) ou 403 avec la raison.", auth="optional")
def chapter_content(request, chapter_id):
    ch = get_or_404(Chapter.objects.filter(pk=chapter_id).select_related("module__course__classroom"))
    d = access_decision(request.user, ch)
    if not d.allowed:
        if d.reason == "not_published":
            get_or_404(Chapter.objects.none())
        exc = PaymentRequiredError if d.reason in ("payment_required", "classroom_payment_required") else PermissionDeniedError
        raise exc(REASON_MESSAGES[d.reason], code=d.reason)
    blocks = [{"id": str(b.pk), "position": b.position, "kind": b.kind, "title": b.title, "body": b.body, "url": b.url, "file_url": signed_url(b.storage_key) if b.storage_key else None,
               "ref_id": str(b.ref_id) if b.ref_id else None, "payload": b.payload, "duration_seconds": b.duration_seconds} for b in ch.blocks.all()]
    return {"id": str(ch.pk), "title": ch.title, "blocks": blocks}


# ------------------------------------------------------------------ inscription, progression
@endpoint("M'inscrire a un cours (idempotent).", status=201)
def enroll(request, course_id):
    e, created = E.enroll(request.user, _course(request, course_id))
    return {"status": e.status, "created": created}


@endpoint("Abandonner un cours.", status=204)
def drop(request, course_id):
    E.drop_enrollment(request.user, _course(request, course_id))
    return Response(status=204)


@endpoint("Mes inscriptions avec ma progression.")
def my_enrollments(request):
    qs = Enrollment.objects.filter(user=request.user).select_related("course__classroom")
    return paginate(request, qs, ("-enrolled_at", "-id"), lambda e: {"course": _course_json(e.course), "status": e.status, "enrolled_at": e.enrolled_at, "completed_at": e.completed_at,
                                                                    "progress": course_progress(request.user, e.course)}, 20)


@endpoint("Ma progression dans un cours (global et par module).")
def my_progress(request, course_id):
    c = _course(request, course_id)
    return {"course": course_progress(request.user, c), "modules": [{"id": str(m.pk), "title": m.title, **module_progress(request.user, m)} for m in c.modules.filter(is_published=True)]}


@endpoint("[Enseignant] Etudiants inscrits.")
def students(request, course_id):
    c = _course(request, course_id)
    if not is_course_staff(request.user, c):
        raise PermissionDeniedError("Reserve aux enseignants.")
    qs = Enrollment.objects.filter(course=c).select_related("user__profile")
    return paginate(request, qs, ("-enrolled_at", "-id"), lambda e: {**user_brief(e.user), "status": e.status, "enrolled_at": e.enrolled_at, "progress": course_progress(e.user, c)}, 50)


@endpoint("[Enseignant] Offrir un acces (cours, module ou chapitre) a un utilisateur.", status=201,
          body={"username": s.CharField(max_length=30), "scope": s.ChoiceField(choices=["course", "module", "chapter"], default="course"), "target_id": s.UUIDField(required=False)})
def grant(request, course_id):
    d, c = request.input, _course(request, course_id)
    target = {"course": c}.get(d["scope"]) or get_or_404((Module if d["scope"] == "module" else Chapter).objects.filter(pk=d.get("target_id")).select_related("course" if d["scope"] == "module" else "module__course"))
    parent = target if d["scope"] == "course" else (target.course if d["scope"] == "module" else target.module.course)
    if parent.pk != c.pk:
        get_or_404(Course.objects.none())
    ent, _ = E.grant_entitlement(_u(d["username"]), d["scope"], target, source="instructor", granted_by=request.user)
    return {"id": str(ent.pk)}
