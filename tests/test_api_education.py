import json

from apps.core.api_testing import api_client, upload_file, verified_user
from apps.core.testing import BaobabTestCase
from apps.storage.backends import FakeBackend


class EduBase(BaobabTestCase):
    def setUp(self):
        super().setUp()
        FakeBackend.reset()
        self.t, self.s1, self.s2, self.out = verified_user("prof"), verified_user("eleve1"), verified_user("eleve2"), verified_user("intrus")
        self.ct, self.c1, self.c2, self.co, self.anon = (api_client(u) for u in (self.t, self.s1, self.s2, self.out, None))

    def build_course(self, privacy="public", publish=True):
        self.ct.post("/api/v1/classrooms/", {"title": "Dev Africa", "slug": "dev-africa", "privacy": privacy}, format="json")
        c = self.ct.post("/api/v1/classrooms/dev-africa/courses/", {"title": "Django", "slug": "django"}, format="json")
        assert c.status_code == 201, c.content
        self.course = c.json()["id"]
        m1 = self.ct.post(f"/api/v1/courses/{self.course}/modules/", {"title": "Intro"}, format="json").json()["id"]
        m2 = self.ct.post(f"/api/v1/courses/{self.course}/modules/", {"title": "Avance", "is_free": False, "price_minor": 15000, "currency": "XAF"}, format="json").json()["id"]
        self.free = self.ct.post(f"/api/v1/modules/{m1}/chapters/", {"title": "Bienvenue"}, format="json").json()["id"]
        self.paid = self.ct.post(f"/api/v1/modules/{m2}/chapters/", {"title": "ORM avance", "is_free": False, "price_minor": 5000, "currency": "XAF"}, format="json").json()["id"]
        self.ct.post(f"/api/v1/chapters/{self.free}/blocks/", {"kind": "text", "body": "Bienvenue au cours"}, format="json")
        self.pdf = upload_file(self.ct, "course_content", "application/pdf", filename="orm.pdf")
        self.ct.post(f"/api/v1/chapters/{self.paid}/blocks/", {"kind": "pdf", "file": self.pdf, "title": "Support"}, format="json")
        if publish:
            r = self.ct.post(f"/api/v1/courses/{self.course}/publish/")
            assert r.status_code == 200, r.content


class CourseAccessApiTests(EduBase):
    def test_paid_chapter_flow_402_then_grant_then_signed_file(self):
        self.build_course()
        outline = self.c1.get(f"/api/v1/courses/{self.course}/").json()
        acc = {ch["title"]: ch["access"] for m in outline["modules"] for ch in m["chapters"]}
        self.assertEqual((acc["Bienvenue"]["allowed"], acc["ORM avance"]["reason"]), (True, "enroll_required"))
        self.assertEqual(self.c1.post(f"/api/v1/courses/{self.course}/enroll/").status_code, 201)
        r = self.c1.get(f"/api/v1/chapters/{self.paid}/content/")
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (402, "payment_required"))  # le frontend sait quoi proposer : payer
        free = self.c1.get(f"/api/v1/chapters/{self.free}/content/")
        self.assertEqual((free.status_code, free.json()["blocks"][0]["body"]), (200, "Bienvenue au cours"))
        self.assertEqual(self.c2.get(f"/api/v1/chapters/{self.paid}/content/").json()["error"]["code"], "enroll_required")  # non inscrit : 403, pas 402
        self.assertEqual(self.c1.post(f"/api/v1/courses/{self.course}/grants/", {"username": "eleve1"}, format="json").status_code, 403)  # un eleve n'offre rien
        self.assertEqual(self.ct.post(f"/api/v1/courses/{self.course}/grants/", {"username": "eleve1", "scope": "course"}, format="json").status_code, 201)
        ok = self.c1.get(f"/api/v1/chapters/{self.paid}/content/")
        self.assertEqual(ok.status_code, 200)
        self.assertIn("fake-bucket.invalid/get/course_content/", ok.json()["blocks"][0]["file_url"])  # fichier servi par URL signee, apres controle d'acces
        self.assertEqual(self.c2.get(f"/api/v1/chapters/{self.paid}/content/").status_code, 403)  # l'autre eleve n'en profite pas

    def test_drafts_are_invisible_and_private_classrooms_do_not_exist_for_outsiders(self):
        self.build_course(publish=False)
        self.assertEqual(self.c1.get(f"/api/v1/courses/{self.course}/").status_code, 404)
        self.assertEqual(self.c1.get(f"/api/v1/chapters/{self.free}/content/").status_code, 404)
        self.assertEqual(self.ct.get(f"/api/v1/courses/{self.course}/").status_code, 200)  # l'enseignant voit son brouillon
        self.assertEqual(self.c1.post(f"/api/v1/courses/{self.course}/publish/").status_code, 404)
        self.ct.post(f"/api/v1/courses/{self.course}/publish/")
        self.assertEqual(len(self.anon.get("/api/v1/courses/").json()["results"]), 1)

    def test_private_classroom_flow(self):
        self.build_course(privacy="private")
        self.assertEqual(self.co.get("/api/v1/classrooms/dev-africa/").status_code, 404)
        self.assertEqual(self.co.get(f"/api/v1/courses/{self.course}/").status_code, 404)
        self.assertEqual(self.anon.get("/api/v1/courses/").json()["results"], [])  # absent du catalogue public
        self.assertEqual(self.c1.post("/api/v1/classrooms/dev-africa/join/").status_code, 404)  # on ne peut meme pas demander a rejoindre ce qu'on ne voit pas
        inv = self.ct.post("/api/v1/classrooms/dev-africa/invite/", {"username": "eleve1"}, format="json").json()["id"]
        self.assertEqual(self.c1.get("/api/v1/classrooms/dev-africa/").status_code, 200)
        self.assertEqual(self.c1.post(f"/api/v1/classroom-invitations/{inv}/respond/", {"accept": True}, format="json").json()["status"], "accepted")
        self.assertEqual(self.c1.post(f"/api/v1/courses/{self.course}/enroll/").status_code, 201)
        self.assertEqual(self.c2.get("/api/v1/classrooms/dev-africa/members/").status_code, 404)
        self.assertEqual(self.c1.get("/api/v1/classrooms/dev-africa/members/").status_code, 403)  # un eleve ne liste pas les membres
        self.assertEqual(len(self.ct.get("/api/v1/classrooms/dev-africa/members/").json()["results"]), 2)

    def test_staff_endpoints_reject_students(self):
        self.build_course()
        self.assertEqual(self.c1.post(f"/api/v1/courses/{self.course}/modules/", {"title": "pirate"}, format="json").status_code, 403)
        self.assertEqual(self.c1.get(f"/api/v1/courses/{self.course}/students/").status_code, 403)
        self.assertEqual(self.c1.post(f"/api/v1/chapters/{self.free}/blocks/", {"kind": "text", "body": "x"}, format="json").status_code, 403)
        self.assertEqual(self.c1.post(f"/api/v1/courses/{self.course}/instructors/", {"username": "eleve2"}, format="json").status_code, 403)
        self.c1.post(f"/api/v1/courses/{self.course}/enroll/")
        self.assertEqual(self.ct.get(f"/api/v1/courses/{self.course}/students/").json()["results"][0]["username"], "eleve1")

    def test_course_files_must_belong_to_the_teacher_and_have_the_right_purpose(self):
        self.build_course()
        theirs = upload_file(self.c1, "course_content", "application/pdf", filename="x.pdf")
        r = self.ct.post(f"/api/v1/chapters/{self.free}/blocks/", {"kind": "pdf", "file": theirs}, format="json")
        self.assertEqual(r.json()["error"]["code"], "invalid_file")  # le fichier d'un eleve ne devient pas du contenu de cours
        avatar = upload_file(self.ct, "avatar")
        self.assertEqual(self.ct.post(f"/api/v1/chapters/{self.free}/blocks/", {"kind": "pdf", "file": avatar}, format="json").status_code, 422)
        self.assertEqual(self.ct.post(f"/api/v1/chapters/{self.free}/blocks/", {"kind": "link", "url": "http://insecure.example.com"}, format="json").status_code, 422)

    def test_progress_certificate_and_public_verification(self):
        self.build_course()
        self.c1.post(f"/api/v1/courses/{self.course}/enroll/")
        self.assertEqual(self.c1.post(f"/api/v1/chapters/{self.paid}/progress/", {"percent": 100}, format="json").status_code, 402)  # on ne progresse pas dans ce qu'on n'a pas paye
        self.ct.post(f"/api/v1/courses/{self.course}/grants/", {"username": "eleve1"}, format="json")
        p = self.c1.post(f"/api/v1/chapters/{self.free}/progress/", {"percent": 40, "seconds": 90}, format="json").json()
        self.assertEqual((p["status"], p["course"]["completed_chapters"]), ("in_progress", 0))
        self.assertEqual(self.c1.post(f"/api/v1/chapters/{self.free}/progress/", {"percent": 10}, format="json").json()["percent"], 40)  # ne recule pas
        self.assertEqual(self.c1.post(f"/api/v1/chapters/{self.free}/progress/", {"percent": 101}, format="json").status_code, 400)
        self.c1.post(f"/api/v1/chapters/{self.free}/progress/", {"percent": 100}, format="json")
        self.assertEqual(self.c1.post(f"/api/v1/chapters/{self.paid}/progress/", {"percent": 100}, format="json").json()["course"]["percent"], 100.0)
        certs = self.c1.get("/api/v1/me/certificates/").json()
        self.assertEqual(len(certs), 1)
        v = self.anon.get(f"/api/v1/public/certificates/{certs[0]['verification_code']}/").json()
        self.assertEqual((v["valid"], v["course"]), (True, "Django"))
        self.assertNotIn("@", json.dumps(v))
        self.assertEqual(self.anon.get("/api/v1/public/certificates/BAO-FAUX00000000/").json(), {"valid": False})
        self.assertEqual(self.c2.get("/api/v1/me/certificates/").json(), [])
        self.assertEqual(self.c1.get("/api/v1/me/enrollments/").json()["results"][0]["status"], "completed")


class AssessmentApiTests(EduBase):
    def setUp(self):
        super().setUp()
        self.build_course()
        self.c1.post(f"/api/v1/courses/{self.course}/enroll/")
        self.quiz = self.ct.post(f"/api/v1/courses/{self.course}/quizzes/", {"title": "Controle", "pass_percent": 50, "max_attempts": 2}, format="json").json()["id"]
        self.q1 = self.ct.post(f"/api/v1/quizzes/{self.quiz}/questions/", {"kind": "single", "prompt": "2+2 ?", "explanation": "Arithmetique", "choices": [{"label": "4", "is_correct": True}, {"label": "5"}]}, format="json").json()["id"]
        self.q2 = self.ct.post(f"/api/v1/quizzes/{self.quiz}/questions/", {"kind": "text", "prompt": "Capitale du Senegal ?", "accepted": ["Dakar"]}, format="json").json()["id"]

    def test_quiz_is_hidden_until_published_and_never_leaks_answers(self):
        self.assertEqual(self.c1.get(f"/api/v1/quizzes/{self.quiz}/").status_code, 422)  # non publie
        self.assertEqual(self.c1.post(f"/api/v1/quizzes/{self.quiz}/publish/", {"published": True}, format="json").status_code, 403)
        self.assertEqual(self.ct.post(f"/api/v1/quizzes/{self.quiz}/publish/", {"published": True}, format="json").status_code, 200)
        blob = json.dumps(self.c1.get(f"/api/v1/quizzes/{self.quiz}/").json())
        for secret in ("is_correct", "correct_order", "accepted", "Dakar", "Arithmetique", "answer_key"):
            self.assertNotIn(secret, blob, secret)
        self.assertEqual(self.c2.get(f"/api/v1/quizzes/{self.quiz}/").status_code, 404)  # non inscrit : le quiz n'existe pas pour lui
        self.assertEqual(self.co.post(f"/api/v1/quizzes/{self.quiz}/attempts/").status_code, 404)

    def test_attempt_flow_grades_automatically_and_reveals_only_correctness(self):
        self.ct.post(f"/api/v1/quizzes/{self.quiz}/publish/", {"published": True}, format="json")
        quiz = self.c1.get(f"/api/v1/quizzes/{self.quiz}/").json()
        choice4 = next(c["id"] for q in quiz["questions"] if q["id"] == self.q1 for c in q["choices"] if c["label"] == "4")
        att = self.c1.post(f"/api/v1/quizzes/{self.quiz}/attempts/").json()
        self.assertEqual(self.c2.post(f"/api/v1/attempts/{att['id']}/submit/", {"answers": {}}, format="json").status_code, 404)  # la tentative d'un autre
        r = self.c1.post(f"/api/v1/attempts/{att['id']}/submit/", {"answers": {self.q1: {"selected": [choice4]}, self.q2: {"text": "  dakar "}}}, format="json").json()
        self.assertEqual((r["passed"], r["score"], r["max_score"]), (True, 2.0, 2.0))
        self.assertTrue(all(a["is_correct"] for a in r["answers"]))
        self.assertEqual(self.c1.post(f"/api/v1/attempts/{att['id']}/submit/", {"answers": {}}, format="json").status_code, 409)
        self.assertEqual(len(self.c1.get(f"/api/v1/quizzes/{self.quiz}/attempts/").json()), 1)
        self.assertEqual(self.c2.get(f"/api/v1/quizzes/{self.quiz}/attempts/").status_code, 404)

    def test_assignments_isolation_grading_and_groups(self):
        self.c2.post(f"/api/v1/courses/{self.course}/enroll/")
        a = self.ct.post(f"/api/v1/courses/{self.course}/assignments/", {"title": "TP1", "max_points": 20, "criteria": [{"label": "Code", "max_points": 12}, {"label": "Tests", "max_points": 8}]}, format="json").json()
        self.assertEqual(self.c1.post(f"/api/v1/courses/{self.course}/assignments/", {"title": "pirate"}, format="json").status_code, 403)
        self.assertEqual(self.co.get(f"/api/v1/courses/{self.course}/assignments/").status_code, 404)
        fid = upload_file(self.c1, "assignment_submission", "application/zip", filename="tp1.zip")
        sub = self.c1.post(f"/api/v1/assignments/{a['id']}/submissions/", {"text": "Mon rendu", "files": [fid]}, format="json")
        self.assertEqual(sub.status_code, 201, sub.content)
        sub = sub.json()
        self.assertIn("fake-bucket.invalid/get/assignment_submission/", sub["attachments"][0]["url"])
        self.assertEqual(self.c2.get(f"/api/v1/submissions/{sub['id']}/").status_code, 404)  # l'autre eleve ne voit pas mon rendu
        self.assertEqual(self.c2.get(f"/api/v1/assignments/{a['id']}/submissions/").json()["results"], [])
        self.assertEqual(len(self.ct.get(f"/api/v1/assignments/{a['id']}/submissions/").json()["results"]), 1)
        stolen = self.c2.post(f"/api/v1/assignments/{a['id']}/submissions/", {"text": "x", "files": [fid]}, format="json")
        self.assertEqual(stolen.json()["error"]["code"], "invalid_file")  # impossible de rendre le fichier d'un autre
        crit = [c["id"] for c in a["criteria"]]
        self.assertEqual(self.c1.post(f"/api/v1/submissions/{sub['id']}/grade/", {"points": 20}, format="json").status_code, 403)  # on ne se note pas soi-meme
        bad = self.ct.post(f"/api/v1/submissions/{sub['id']}/grade/", {"criteria": [{"criterion_id": crit[0], "points": 13}, {"criterion_id": crit[1], "points": 1}]}, format="json")
        self.assertEqual(bad.json()["error"]["code"], "points_out_of_range")
        ok = self.ct.post(f"/api/v1/submissions/{sub['id']}/grade/", {"criteria": [{"criterion_id": crit[0], "points": 10}, {"criterion_id": crit[1], "points": 6, "comment": "manque de tests"}], "feedback": "Bien"}, format="json")
        self.assertEqual(ok.json()["points"], 16.0)
        mine = self.c1.get(f"/api/v1/submissions/{sub['id']}/").json()
        self.assertEqual((mine["status"], mine["grade"]["points"]), ("graded", 16.0))
        self.assertEqual(self.c1.post(f"/api/v1/submissions/{sub['id']}/feedback/", {"body": "merci"}, format="json").status_code, 201)
        self.assertEqual(self.c2.post(f"/api/v1/submissions/{sub['id']}/feedback/", {"body": "je me mele"}, format="json").status_code, 404)

    def test_group_assignment_shares_the_submission_only_within_the_group(self):
        self.c2.post(f"/api/v1/courses/{self.course}/enroll/")
        a = self.ct.post(f"/api/v1/courses/{self.course}/assignments/", {"title": "Projet", "is_group": True, "max_points": 10}, format="json").json()
        self.assertEqual(self.c1.post(f"/api/v1/assignments/{a['id']}/submissions/", {"text": "seul"}, format="json").json()["error"]["code"], "group_required")
        self.assertEqual(self.c1.post(f"/api/v1/assignments/{a['id']}/groups/", {"name": "Equipe A", "usernames": ["eleve2"]}, format="json").status_code, 201)
        sub = self.c2.post(f"/api/v1/assignments/{a['id']}/submissions/", {"text": "rendu commun"}, format="json").json()
        self.assertEqual(sub["group"], "Equipe A")
        self.assertEqual(self.c1.get(f"/api/v1/submissions/{sub['id']}/").status_code, 200)  # coequipier : voit
        self.assertEqual(self.co.get(f"/api/v1/submissions/{sub['id']}/").status_code, 404)
