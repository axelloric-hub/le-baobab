"""Quiz (correction automatique, bonnes reponses jamais exposees) et devoirs (individuels ou en groupe, notes, grille, commentaires)."""
from __future__ import annotations

from rest_framework import serializers as s
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.assessments import services as A
from apps.assessments.models import Assignment, AssignmentGroupMember, AssignmentSubmission, Quiz, QuizAttempt
from apps.assessments.serializers import QuizPublicSerializer
from apps.core.api import endpoint, get_or_404, paginate
from apps.core.exceptions import PermissionDeniedError
from apps.education.access import is_course_staff
from apps.education.models import Chapter, Course, Enrollment
from apps.profiles.render import user_brief
from apps.profiles.selectors import get_active_or_404 as _u
from apps.storage.services import resolve_owned, signed_url


def _course(request, course_id) -> Course:
    c = get_or_404(Course.objects.filter(pk=course_id).select_related("classroom"))
    if not (is_course_staff(request.user, c) or Enrollment.objects.filter(course=c, user=request.user, status__in=["active", "completed"]).exists()):
        get_or_404(Course.objects.none())  # un non-inscrit ne sait meme pas qu'un quiz/devoir existe
    return c


def _chapter(course: Course, chapter_id):
    return get_or_404(Chapter.objects.filter(pk=chapter_id, module__course=course)) if chapter_id else None


def _quiz(request, quiz_id) -> Quiz:
    q = get_or_404(Quiz.objects.filter(pk=quiz_id).select_related("course__classroom", "chapter__module__course__classroom"))
    _course(request, q.course_id)
    return q


def _attempt(a: QuizAttempt, *, reveal: bool = False) -> dict:
    out = {"id": str(a.pk), "quiz": str(a.quiz_id), "attempt_no": a.attempt_no, "status": a.status, "started_at": a.started_at, "submitted_at": a.submitted_at,
           "score": float(a.score), "max_score": float(a.max_score), "passed": a.passed}
    if reveal and a.status != "in_progress":  # apres soumission : correct/incorrect + explication, JAMAIS la bonne reponse elle-meme
        out["answers"] = [{"question": str(x.question_id), "is_correct": x.is_correct, "points": float(x.points_awarded), "explanation": x.question.explanation if x.is_correct is not None else ""}
                          for x in a.answers.select_related("question")]
    return out


# ------------------------------------------------------------------ quiz
@endpoint("[Enseignant] Creer un quiz.", status=201, body={"title": s.CharField(max_length=160), "pass_percent": s.IntegerField(min_value=0, max_value=100, default=60), "max_attempts": s.IntegerField(min_value=0, max_value=50, default=3),
                                                        "time_limit_seconds": s.IntegerField(min_value=10, required=False), "chapter": s.UUIDField(required=False)})
def create_quiz(request, course_id):
    d, c = request.input, _course(request, course_id)
    q = A.create_quiz(c, request.user, title=d["title"], pass_percent=d["pass_percent"], max_attempts=d["max_attempts"], time_limit_seconds=d.get("time_limit_seconds"), chapter=_chapter(c, d.get("chapter")))
    return {"id": str(q.pk)}


@endpoint("[Enseignant] Ajouter une question. kind : single, multiple, true_false, text, code, ordering. choices : [{label, is_correct, correct_order}] ; accepted : reponses acceptees (text).", status=201,
          body={"kind": s.ChoiceField(choices=["single", "multiple", "true_false", "text", "code", "ordering"]), "prompt": s.CharField(max_length=5000), "points": s.IntegerField(min_value=1, max_value=100, default=1),
                "choices": s.ListField(child=s.DictField(), required=False, max_length=20), "accepted": s.ListField(child=s.CharField(max_length=200), required=False, max_length=20), "explanation": s.CharField(max_length=2000, required=False, allow_blank=True, default="")})
def add_question(request, quiz_id):
    d = request.input
    q = A.add_question(_quiz(request, quiz_id), request.user, kind=d["kind"], prompt=d["prompt"], points=d["points"], choices=d.get("choices"), accepted=d.get("accepted"), explanation=d["explanation"])
    return {"id": str(q.pk), "position": q.position}


@endpoint("[Enseignant] Publier / depublier un quiz.", body={"published": s.BooleanField()})
def publish_quiz(request, quiz_id):
    q = A.set_quiz_published(quiz_id, request.user, request.input["published"])
    return {"id": str(q.pk), "is_published": q.is_published}


@endpoint("Lire un quiz (questions et choix SANS les bonnes reponses).")
def get_quiz(request, quiz_id):
    q = _quiz(request, quiz_id)
    A.ensure_quiz_access(request.user, q)
    return QuizPublicSerializer(q).data


@endpoint("Demarrer (ou reprendre) une tentative.", status=201)
def start_attempt(request, quiz_id):
    return _attempt(A.start_attempt(request.user, _quiz(request, quiz_id).pk))


class _AnswerIn(s.Serializer):
    selected = s.ListField(child=s.UUIDField(), required=False, max_length=50)
    text = s.CharField(required=False, allow_blank=True, max_length=20000)


@endpoint("Soumettre les reponses : {answers: {<id question>: {selected: [<id choix>], text: \"...\"}}}. Hors delai : note 0.", body={"answers": s.DictField(child=_AnswerIn())})
def submit_attempt(request, attempt_id):
    answers = {k: {"selected": [str(x) for x in v.get("selected", [])], "text": v.get("text", "")} for k, v in request.input["answers"].items()}
    a = A.submit_attempt(request.user, attempt_id, answers)
    return _attempt(QuizAttempt.objects.get(pk=a.pk), reveal=True)


@endpoint("Mes tentatives sur un quiz.")
def my_attempts(request, quiz_id):
    q = _quiz(request, quiz_id)
    return [_attempt(a, reveal=True) for a in QuizAttempt.objects.filter(quiz=q, user=request.user).order_by("attempt_no")]


@endpoint("[Enseignant] Corriger une reponse de type 'code'.", body={"question": s.UUIDField(), "correct": s.BooleanField()})
def grade_code(request, attempt_id):
    a = A.grade_code_answer(attempt_id, request.input["question"], request.user, correct=request.input["correct"])
    return _attempt(a)


# ------------------------------------------------------------------ devoirs
class _Criterion(s.Serializer):
    label = s.CharField(max_length=200)
    max_points = s.IntegerField(min_value=1, max_value=1000)


def _assignment(request, assignment_id) -> Assignment:
    a = get_or_404(Assignment.objects.filter(pk=assignment_id).select_related("course__classroom"))
    _course(request, a.course_id)
    return a


def _assignment_json(a: Assignment, *, staff: bool = False) -> dict:
    out = _assignment_base(a)
    out["auto_grade"] = a.auto_grade
    if staff:  # la reponse attendue ne sort JAMAIS vers un etudiant
        out["reference_answer"], out["grading_notes"] = a.reference_answer, a.grading_notes
    return out


def _assignment_base(a: Assignment) -> dict:
    return {"id": str(a.pk), "course": str(a.course_id), "title": a.title, "instructions": a.instructions, "max_points": a.max_points, "due_at": a.due_at, "allow_late": a.allow_late,
            "max_attempts": a.max_attempts, "is_group": a.is_group, "criteria": [{"id": str(c.pk), "label": c.label, "max_points": c.max_points} for c in a.criteria.order_by("position")]}


@endpoint("[Enseignant] Creer un devoir. criteria : grille [{label, max_points}] dont la somme egale max_points. auto_grade=true : Gemini corrige chaque rendu en comparant a reference_answer (obligatoire dans ce cas ; jamais montree aux etudiants) ; grading_notes = consignes de correction facultatives.", status=201,
          body={"title": s.CharField(max_length=160), "instructions": s.CharField(max_length=20000, required=False, allow_blank=True, default=""), "max_points": s.IntegerField(min_value=1, max_value=1000, default=20),
                "due_at": s.DateTimeField(required=False), "allow_late": s.BooleanField(default=True), "max_attempts": s.IntegerField(min_value=1, max_value=20, default=1), "is_group": s.BooleanField(default=False),
                "criteria": s.ListField(child=_Criterion(), required=False, max_length=20), "chapter": s.UUIDField(required=False),
                "auto_grade": s.BooleanField(default=False), "reference_answer": s.CharField(max_length=20000, required=False, allow_blank=True, default=""),
                "grading_notes": s.CharField(max_length=5000, required=False, allow_blank=True, default="")})
def create_assignment(request, course_id):
    d, c = request.input, _course(request, course_id)
    a = A.create_assignment(c, request.user, title=d["title"], instructions=d["instructions"], max_points=d["max_points"], due_at=d.get("due_at"), allow_late=d["allow_late"], max_attempts=d["max_attempts"],
                            is_group=d["is_group"], criteria=[dict(x) for x in d.get("criteria", [])], chapter=_chapter(c, d.get("chapter")),
                            auto_grade=d["auto_grade"], reference_answer=d["reference_answer"], grading_notes=d["grading_notes"])
    return _assignment_json(a, staff=True)


@endpoint("Devoirs d'un cours (inscrits et enseignants).")
def list_assignments(request, course_id):
    c = _course(request, course_id)
    staff = is_course_staff(request.user, c)
    return [_assignment_json(a, staff=staff) for a in Assignment.objects.filter(course=c, is_published=True).prefetch_related("criteria")]


@endpoint("Detail d'un devoir.")
def get_assignment(request, assignment_id):
    a = _assignment(request, assignment_id)
    return _assignment_json(a, staff=is_course_staff(request.user, a.course))


@endpoint("Former mon groupe pour un devoir collectif (tous les membres doivent etre inscrits ; un eleve = un seul groupe).", status=201, body={"name": s.CharField(max_length=100), "usernames": s.ListField(child=s.CharField(max_length=30), max_length=20, required=False)})
def create_group(request, assignment_id):
    a = _assignment(request, assignment_id)
    g = A.create_group(a.pk, request.user, [_u(n) for n in request.input.get("usernames", [])], request.input["name"])
    return {"id": str(g.pk), "name": g.name}


def _submission(sub: AssignmentSubmission) -> dict:
    g = getattr(sub, "grade", None)
    return {"id": str(sub.pk), "assignment": str(sub.assignment_id), "student": user_brief(sub.user) if sub.user_id else None, "group": sub.group.name if sub.group_id else None, "submitted_by": user_brief(sub.submitted_by),
            "attempt_no": sub.attempt_no, "status": sub.status, "text": sub.text, "is_late": sub.is_late, "submitted_at": sub.submitted_at,
            "attachments": [{"filename": x["filename"], "size_bytes": x.get("size_bytes"), "url": signed_url(x["storage_key"], x["filename"])} for x in sub.attachments],
            "ai_status": sub.ai_status,
            "grade": {"points": float(g.points), "feedback": g.feedback, "graded_at": g.graded_at, "source": g.source,
                      "ai_confidence": float(g.ai_confidence) if g.ai_confidence is not None else None} if g else None}


@endpoint("Rendre un devoir (texte et/ou fichiers envoyes, usage 'assignment_submission'). Pour un devoir collectif, le rendu est celui du groupe.", status=201,
          body={"text": s.CharField(max_length=50000, required=False, allow_blank=True, default=""), "files": s.ListField(child=s.UUIDField(), required=False, max_length=10)})
def submit(request, assignment_id):
    a = _assignment(request, assignment_id)
    atts = []
    for fid in request.input.get("files", []):
        f = resolve_owned(request.user, fid, ("assignment_submission",))
        atts.append({"storage_key": f.key, "filename": f.filename, "size_bytes": f.size_bytes})
    sub = A.submit_assignment(a.pk, request.user, text=request.input["text"], attachments=atts)
    return _submission(AssignmentSubmission.objects.select_related("user__profile", "submitted_by__profile", "group").get(pk=sub.pk))


def _visible_submissions(request, a: Assignment):
    qs = AssignmentSubmission.objects.filter(assignment=a).select_related("user__profile", "submitted_by__profile", "group", "grade")
    if is_course_staff(request.user, a.course):
        return qs
    mine = AssignmentGroupMember.objects.filter(assignment=a, user=request.user).values_list("group_id", flat=True)
    from django.db.models import Q

    return qs.filter(Q(user=request.user) | Q(group_id__in=mine))  # un etudiant ne voit QUE ses rendus (et ceux de son groupe)


@endpoint("Rendus d'un devoir : tous pour les enseignants ; seulement les miens (et ceux de mon groupe) pour un etudiant.")
def list_submissions(request, assignment_id):
    a = _assignment(request, assignment_id)
    return paginate(request, _visible_submissions(request, a), ("-submitted_at", "-id"), _submission, 30)


@endpoint("Lire un rendu (auteur, groupe ou enseignants).")
def get_submission(request, submission_id):
    sub = get_or_404(AssignmentSubmission.objects.filter(pk=submission_id).select_related("assignment__course"))
    return _submission(get_or_404(_visible_submissions(request, sub.assignment).filter(pk=submission_id)))


class _GradeCriterion(s.Serializer):
    criterion_id = s.UUIDField()
    points = s.DecimalField(max_digits=6, decimal_places=2, min_value=0)
    comment = s.CharField(max_length=500, required=False, allow_blank=True, default="")


@endpoint("[Enseignant] Noter un rendu : points (note globale) OU criteria [{criterion_id, points, comment}] (grille complete). Une nouvelle note remplace l'ancienne.",
          body={"points": s.DecimalField(max_digits=6, decimal_places=2, required=False), "criteria": s.ListField(child=_GradeCriterion(), required=False, max_length=20), "feedback": s.CharField(max_length=5000, required=False, allow_blank=True, default="")})
def grade(request, submission_id):
    d = request.input
    crit = [dict(c) for c in d.get("criteria", [])] or None
    g = A.grade_submission(submission_id, request.user, points=d.get("points"), criteria=crit, feedback=d["feedback"])
    return {"points": float(g.points), "feedback": g.feedback}


@endpoint("Commenter un rendu (enseignants et auteur/groupe).", status=201, body={"body": s.CharField(max_length=5000)})
def feedback(request, submission_id):
    sub = get_or_404(AssignmentSubmission.objects.filter(pk=submission_id).select_related("assignment__course"))
    get_or_404(_visible_submissions(request, sub.assignment).filter(pk=submission_id))  # rendu invisible pour moi : 404, pas 403
    f = A.add_feedback(submission_id, request.user, request.input["body"])
    return {"id": str(f.pk)}


@endpoint("[Enseignant] Lancer (ou relancer) la correction automatique par Gemini d'un rendu. Remplace une note IA existante, jamais une note d'enseignant "
          "(pour la remplacer, notez a la main). Dure quelques secondes.")
def auto_grade(request, submission_id):
    sub = get_or_404(AssignmentSubmission.objects.filter(pk=submission_id).select_related("assignment__course"))
    if not is_course_staff(request.user, sub.assignment.course):
        raise NotFound()  # 404 : on ne revele pas l'existence du rendu
    from apps.assessments import ai_grading

    ai_grading.conflict_if_busy(sub)
    g = ai_grading.grade_with_ai(sub.pk, force=True)
    if g is None or g.source == "teacher":
        raise PermissionDeniedError("Ce rendu a deja ete note par un enseignant : il n'est pas ecrase.", code="already_graded_by_teacher")
    return {"points": float(g.points), "feedback": g.feedback, "source": g.source, "ai_confidence": float(g.ai_confidence), "model": g.ai_model}
