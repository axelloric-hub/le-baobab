"""Un quiz reussi peut debloquer un certificat (cours deja termine) : reaction par EVENEMENT, sans import circulaire assessments <-> progress."""
from apps.core.outbox import subscribe


@subscribe("QuizPassed")
def on_quiz_passed(ev):
    from apps.accounts.models import User
    from apps.education.models import Course
    from apps.progress.services import try_issue_certificate

    user = User.objects.filter(pk=ev.payload["user"]).first()
    course = Course.objects.filter(pk=ev.payload["course"]).first()
    if user and course:
        try_issue_certificate(user, course)
