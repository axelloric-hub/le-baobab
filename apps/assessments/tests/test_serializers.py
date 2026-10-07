import json

from django.test import TestCase

from apps.assessments import services as A
from apps.assessments.serializers import QuizPublicSerializer
from apps.core.testing import BaobabTestCase
from apps.education.serializers import ChapterOutlineSerializer
from apps.education.testing import make_course


class AnswerLeakTests(BaobabTestCase):
    def test_public_quiz_payload_never_contains_the_correction(self):
        k = make_course()
        quiz = A.create_quiz(k.course, k.teacher, title="Q")
        A.add_question(quiz, k.teacher, kind="single", prompt="p", choices=[{"label": "bonne", "is_correct": True}, {"label": "mauvaise"}], explanation="SECRET-EXPLICATION")
        A.add_question(quiz, k.teacher, kind="text", prompt="t", accepted=["REPONSE-SECRETE"])
        A.add_question(quiz, k.teacher, kind="ordering", prompt="o", choices=[{"label": "x", "correct_order": 2}, {"label": "y", "correct_order": 1}])
        blob = json.dumps(QuizPublicSerializer(quiz).data, default=str)
        for secret in ("is_correct", "correct_order", "answer_key", "accepted", "REPONSE-SECRETE", "SECRET-EXPLICATION", "explanation"):
            self.assertNotIn(secret, blob, secret)

    def test_course_outline_exposes_prices_but_no_content(self):
        k = make_course()
        blob = json.dumps(ChapterOutlineSerializer(k.c3).data)
        self.assertIn("price_minor", blob)
        for hidden in ("storage_key", "body", "blocks", "Contenu de"):
            self.assertNotIn(hidden, blob)
