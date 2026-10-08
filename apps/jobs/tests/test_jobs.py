import threading
from datetime import timedelta

from django.db import IntegrityError, connections, transaction
from django.utils import timezone

from apps.core import outbox
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.testing import BaobabTestCase, BaobabTransactionTestCase, make_user
from apps.jobs import services as J
from apps.jobs.models import ApplicationStatusEvent, Contract, InterviewSlot, Job, JobApplication, Milestone
from apps.jobs.testing import DESCRIPTION, make_company_job
from apps.notifications.models import Notification
from apps.portfolio import services as PF


def in_hours(h):
    return timezone.now() + timedelta(hours=h)


class JobPublishingTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.k = make_company_job(publish=False)

    def test_publishing_rules_and_permissions(self):
        with self.assertRaises(PermissionDeniedError):
            J.publish_job(self.k.job, make_user())
        short = J.create_job(self.k.recruiter, company=self.k.company, title="x", description="trop court", job_type="full_time", contract_type="permanent")
        with self.assertRaises(DomainError) as cm:
            J.publish_job(short, self.k.recruiter)
        self.assertEqual(cm.exception.code, "incomplete_job")
        J.publish_job(self.k.job, self.k.recruiter)
        self.k.job.refresh_from_db()
        self.assertEqual(self.k.job.status, "open")
        with self.assertRaises(ConflictError):
            J.publish_job(self.k.job, self.k.recruiter)  # deja ouverte

    def test_creation_rules(self):
        stranger = make_user()
        with self.assertRaises(PermissionDeniedError):
            J.create_job(stranger, company=self.k.company, title="x", description=DESCRIPTION, job_type="full_time", contract_type="permanent")
        with self.assertRaises(DomainError) as cm:
            J.create_job(stranger, title="x", description=DESCRIPTION, job_type="full_time", contract_type="permanent")
        self.assertEqual(cm.exception.code, "company_required")
        with self.assertRaises(DomainError):
            J.create_job(stranger, title="x", description=DESCRIPTION, job_type="freelance", contract_type="permanent")
        with self.assertRaises(DomainError) as cm:
            J.create_job(self.k.recruiter, company=self.k.company, title="x", description=DESCRIPTION, job_type="full_time", contract_type="permanent",
                         salary={"min": 600, "max": 300, "currency": "XAF", "period": "month"})
        self.assertEqual(cm.exception.code, "invalid_salary")
        with self.assertRaises(DomainError):
            J.create_job(self.k.recruiter, company=self.k.company, title="x", description=DESCRIPTION, job_type="full_time", contract_type="permanent",
                         salary={"min": 100, "max": 200, "currency": "", "period": "month"})  # devise manquante

    def test_suspended_company_cannot_publish(self):
        self.k.company.status = "suspended"; self.k.company.save()
        with self.assertRaises(DomainError):
            J.publish_job(self.k.job, self.k.recruiter)


class ApplicationTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.k = make_company_job()
        self.cand = make_user()

    def test_apply_rules(self):
        app = J.apply(self.k.job.pk, self.cand, cover_letter="Je suis motive", github_url="https://github.com/cand")
        self.assertEqual(app.status, "submitted")
        self.assertEqual(list(app.history.values_list("to_status", flat=True)), ["submitted"])
        with self.assertRaises(ConflictError) as cm:
            J.apply(self.k.job.pk, self.cand, cover_letter="encore")
        self.assertEqual(cm.exception.code, "already_applied")
        with self.assertRaises(PermissionDeniedError):
            J.apply(self.k.job.pk, self.k.recruiter, cover_letter="moi")  # pas sur sa propre offre
        with self.assertRaises(DomainError):
            J.apply(self.k.job.pk, make_user())  # ni lettre ni CV
        J.close_job(self.k.job, self.k.recruiter)
        with self.assertRaises(DomainError) as cm:
            J.apply(self.k.job.pk, make_user(), cover_letter="trop tard")
        self.assertEqual(cm.exception.code, "job_closed")

    def test_deadline_and_freelance_routing(self):
        Job.objects.filter(pk=self.k.job.pk).update(published_at=timezone.now() - timedelta(hours=2), deadline=timezone.now() - timedelta(hours=1))
        with self.assertRaises(DomainError):
            J.apply(self.k.job.pk, self.cand, cover_letter="x")
        fl = make_company_job(job_type="freelance", contract_type="freelance")
        with self.assertRaises(DomainError) as cm:
            J.apply(fl.job.pk, self.cand, cover_letter="x")
        self.assertEqual(cm.exception.code, "use_proposal")

    def test_only_own_portfolio_projects_can_be_attached(self):
        mine = PF.create_project(self.cand, slug="mine", title="Mon projet")
        theirs = PF.create_project(make_user(), slug="theirs", title="Pas a moi")
        app = J.apply(self.k.job.pk, self.cand, cover_letter="x", project_ids=[mine.pk, theirs.pk])
        self.assertEqual(list(app.projects.values_list("pk", flat=True)), [mine.pk])

    def test_recruiters_are_notified(self):
        J.apply(self.k.job.pk, self.cand, cover_letter="Bonjour")
        outbox.relay_batch(100)
        self.assertEqual(Notification.objects.filter(type_id="application_received").count(), 2)  # le recruteur qui a poste l'offre + le proprietaire de l'entreprise
        self.assertTrue(Notification.objects.filter(recipient=self.k.recruiter, type_id="application_received").exists())


class StateMachineTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.k = make_company_job()
        self.cand = make_user()
        self.app = J.apply(self.k.job.pk, self.cand, cover_letter="x")

    def go(self, to, actor=None):
        return J.transition_application(self.app.pk, actor or self.k.recruiter, to)

    def test_valid_path_and_history(self):
        for step in ("reviewing", "shortlisted", "interview", "offer", "hired"):
            self.go(step)
        self.assertEqual(list(self.app.history.order_by("id").values_list("to_status", flat=True)), ["submitted", "reviewing", "shortlisted", "interview", "offer", "hired"])

    def test_invalid_transitions_and_terminal_states(self):
        for bad in ("shortlisted", "offer", "hired", "interview"):
            with self.assertRaises(DomainError) as cm:
                self.go(bad)  # on ne saute pas d'etape
            self.assertEqual(cm.exception.code, "invalid_transition")
        self.go("rejected")
        for anything in ("reviewing", "withdrawn", "hired"):
            with self.assertRaises(DomainError):
                self.go(anything, actor=self.cand if anything == "withdrawn" else None)  # un etat final est final

    def test_permissions(self):
        with self.assertRaises(PermissionDeniedError):
            self.go("reviewing", actor=self.cand)  # le candidat ne se pre-selectionne pas
        with self.assertRaises(PermissionDeniedError):
            self.go("reviewing", actor=make_user())
        with self.assertRaises(PermissionDeniedError):
            J.transition_application(self.app.pk, self.k.recruiter, "withdrawn")  # seul le candidat retire
        J.transition_application(self.app.pk, self.cand, "withdrawn")

    def test_history_is_append_only_in_the_database(self):
        self.go("reviewing")
        ev = ApplicationStatusEvent.objects.first()
        for fn in (lambda: ApplicationStatusEvent.objects.filter(pk=ev.pk).update(to_status="hired"), lambda: ApplicationStatusEvent.objects.filter(pk=ev.pk).delete()):
            with self.assertRaises(Exception) as cm, transaction.atomic():
                fn()
            self.assertIn("ecriture seule", str(cm.exception))

    def test_funnel_function_and_views(self):
        from django.db import connection
        self.go("reviewing"); self.go("shortlisted")
        J.apply(self.k.job.pk, make_user(), cover_letter="2")
        with connection.cursor() as cur:
            cur.execute("SELECT status, applications FROM baobab_job_funnel(%s)", [self.k.job.pk])
            funnel = dict(cur.fetchall())
            cur.execute("SELECT applications, shortlisted FROM v_job_statistics WHERE job_id = %s", [self.k.job.pk])
            stats = cur.fetchone()
        self.assertEqual((funnel["submitted"], funnel["shortlisted"], funnel["hired"], len(funnel)), (1, 1, 0, 8))
        self.assertEqual(stats, (2, 1))

    def test_applicant_notified_on_status_change(self):
        self.go("reviewing")
        outbox.relay_batch(100)
        self.assertTrue(Notification.objects.filter(recipient=self.cand, type_id="application_status").exists())


class InterviewAndOfferTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.k = make_company_job()
        self.cand = make_user()
        self.app = J.apply(self.k.job.pk, self.cand, cover_letter="x")
        J.transition_application(self.app.pk, self.k.recruiter, "reviewing")
        J.transition_application(self.app.pk, self.k.recruiter, "shortlisted")

    def test_overlapping_slots_are_rejected_by_the_database(self):
        J.create_slot(self.k.recruiter, self.k.job, starts_at=in_hours(24), ends_at=in_hours(25))
        J.create_slot(self.k.recruiter, self.k.job, starts_at=in_hours(25), ends_at=in_hours(26))  # bout a bout : autorise
        with self.assertRaises(ConflictError) as cm:
            J.create_slot(self.k.recruiter, self.k.job, starts_at=in_hours(24.5), ends_at=in_hours(25.5))
        self.assertEqual(cm.exception.code, "slot_overlap")
        with self.assertRaises(ConflictError):
            J.create_slot(self.k.recruiter, self.k.job, starts_at=in_hours(30), ends_at=in_hours(29))  # fin avant debut
        with self.assertRaises(PermissionDeniedError):
            J.create_slot(make_user(), self.k.job, starts_at=in_hours(40), ends_at=in_hours(41))

    def test_booking_moves_the_application_to_interview_once(self):
        slot = J.create_slot(self.k.recruiter, self.k.job, starts_at=in_hours(24), ends_at=in_hours(25))
        slot2 = J.create_slot(self.k.recruiter, self.k.job, starts_at=in_hours(48), ends_at=in_hours(49))
        iv = J.book_slot(self.app.pk, slot.pk, self.cand, mode="video", location="https://meet.example.com/x")
        self.app.refresh_from_db()
        self.assertEqual((self.app.status, iv.status), ("interview", "scheduled"))
        with self.assertRaises(ConflictError):
            J.book_slot(self.app.pk, slot2.pk, self.cand)  # un candidat = un creneau
        other = J.apply(self.k.job.pk, make_user(), cover_letter="y")
        J.transition_application(other.pk, self.k.recruiter, "reviewing"); J.transition_application(other.pk, self.k.recruiter, "shortlisted")
        with self.assertRaises(ConflictError) as cm:
            J.book_slot(other.pk, slot.pk, other.applicant)
        self.assertEqual(cm.exception.code, "slot_taken")

    def test_booking_requires_shortlist_and_future_slot(self):
        fresh = J.apply(self.k.job.pk, make_user(), cover_letter="z")
        slot = J.create_slot(self.k.recruiter, self.k.job, starts_at=in_hours(24), ends_at=in_hours(25))
        with self.assertRaises(DomainError):
            J.book_slot(fresh.pk, slot.pk, fresh.applicant)  # pas pre-selectionne
        past = InterviewSlot.objects.create(interviewer=self.k.recruiter, job=self.k.job, starts_at=in_hours(-5), ends_at=in_hours(-4))
        with self.assertRaises(DomainError) as cm:
            J.book_slot(self.app.pk, past.pk, self.cand)
        self.assertEqual(cm.exception.code, "slot_past")

    def test_offer_acceptance_hires_and_creates_the_contract(self):
        slot = J.create_slot(self.k.recruiter, self.k.job, starts_at=in_hours(24), ends_at=in_hours(25))
        J.book_slot(self.app.pk, slot.pk, self.cand)
        with self.assertRaises(PermissionDeniedError):
            J.make_offer(self.app.pk, make_user(), amount_minor=500_000, currency="XAF")
        offer = J.make_offer(self.app.pk, self.k.recruiter, amount_minor=500_000, currency="xaf")
        with self.assertRaises(type(offer).DoesNotExist):
            J.respond_to_offer(offer.pk, make_user(), accept=True)  # l'offre d'un autre est introuvable pour lui
        J.respond_to_offer(offer.pk, self.cand, accept=True)
        self.app.refresh_from_db()
        contract = Contract.objects.get(application=self.app)
        self.assertEqual((self.app.status, contract.kind, contract.amount_minor, contract.contractor_id), ("hired", "employment", 500_000, self.cand.pk))
        with self.assertRaises(ConflictError):
            J.respond_to_offer(offer.pk, self.cand, accept=False)

    def test_expired_and_declined_offers(self):
        slot = J.create_slot(self.k.recruiter, self.k.job, starts_at=in_hours(24), ends_at=in_hours(25))
        J.book_slot(self.app.pk, slot.pk, self.cand)
        offer = J.make_offer(self.app.pk, self.k.recruiter, amount_minor=1, currency="XAF")
        type(offer).objects.filter(pk=offer.pk).update(expires_at=timezone.now() - timedelta(minutes=1))
        with self.assertRaises(DomainError) as cm:
            J.respond_to_offer(offer.pk, self.cand, accept=True)
        self.assertEqual(cm.exception.code, "offer_expired")
        with self.assertRaises(IntegrityError), transaction.atomic():
            type(offer).objects.create(application=self.app, amount_minor=5, currency="XAF")  # une seule offre active par candidature

    def test_contract_parties_must_differ_in_the_database(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Contract.objects.create(kind="employment", client=self.cand, contractor=self.cand, application=self.app, amount_minor=1, currency="XAF")


class FreelanceTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.k = make_company_job(job_type="freelance", contract_type="freelance")
        self.f1, self.f2 = make_user(), make_user()

    def test_proposal_rules(self):
        p = J.submit_proposal(self.k.job.pk, self.f1, cover_letter="Je peux livrer", bid_minor=400_000, currency="xaf", delivery_days=30)
        self.assertEqual(p.currency, "XAF")
        with self.assertRaises(ConflictError):
            J.submit_proposal(self.k.job.pk, self.f1, cover_letter="encore", bid_minor=1, currency="XAF", delivery_days=1)
        with self.assertRaises(DomainError):
            J.submit_proposal(self.k.job.pk, self.f2, cover_letter="x", bid_minor=0, currency="XAF", delivery_days=5)
        with self.assertRaises(PermissionDeniedError):
            J.submit_proposal(self.k.job.pk, self.k.owner, cover_letter="moi", bid_minor=1, currency="XAF", delivery_days=1)
        emp = make_company_job()
        with self.assertRaises(DomainError):
            J.submit_proposal(emp.job.pk, self.f2, cover_letter="x", bid_minor=1, currency="XAF", delivery_days=1)

    def test_accepting_a_proposal_creates_contract_milestones_and_closes_the_rest(self):
        p1 = J.submit_proposal(self.k.job.pk, self.f1, cover_letter="a", bid_minor=400_000, currency="XAF", delivery_days=30)
        p2 = J.submit_proposal(self.k.job.pk, self.f2, cover_letter="b", bid_minor=350_000, currency="XAF", delivery_days=45)
        with self.assertRaises(PermissionDeniedError):
            J.accept_proposal(p1.pk, make_user())
        with self.assertRaises(DomainError) as cm:
            J.accept_proposal(p1.pk, self.k.owner, milestones=[{"title": "A", "amount_minor": 100_000}, {"title": "B", "amount_minor": 100_000}])
        self.assertEqual(cm.exception.code, "milestones_total_mismatch")
        contract = J.accept_proposal(p1.pk, self.k.owner, milestones=[{"title": "Maquette", "amount_minor": 100_000}, {"title": "Livraison", "amount_minor": 300_000}])
        p2.refresh_from_db(); self.k.job.refresh_from_db()
        self.assertEqual((p2.status, self.k.job.status, contract.milestones.count(), contract.kind), ("rejected", "filled", 2, "freelance"))
        with self.assertRaises(ConflictError):
            J.accept_proposal(p2.pk, self.k.owner)  # mission deja pourvue

    def test_milestone_flow_permissions_and_contract_completion(self):
        p = J.submit_proposal(self.k.job.pk, self.f1, cover_letter="a", bid_minor=200_000, currency="XAF", delivery_days=10)
        c = J.accept_proposal(p.pk, self.k.owner, milestones=[{"title": "M1", "amount_minor": 50_000}, {"title": "M2", "amount_minor": 150_000}])
        m1, m2 = c.milestones.order_by("position")
        with self.assertRaises(PermissionDeniedError):
            J.advance_milestone(m1.pk, self.k.owner, "start")  # le client ne demarre pas le travail
        with self.assertRaises(DomainError):
            J.advance_milestone(m1.pk, self.f1, "submit")  # on ne livre pas ce qui n'est pas demarre
        J.advance_milestone(m1.pk, self.f1, "start"); J.advance_milestone(m1.pk, self.f1, "submit")
        with self.assertRaises(PermissionDeniedError):
            J.advance_milestone(m1.pk, self.f1, "approve")  # on ne valide pas son propre travail
        J.advance_milestone(m1.pk, self.k.owner, "approve")
        c.refresh_from_db()
        self.assertEqual(c.status, "active")
        for action, who in (("start", self.f1), ("submit", self.f1), ("approve", self.k.owner)):
            J.advance_milestone(m2.pk, who, action)
        c.refresh_from_db()
        self.assertEqual(c.status, "completed")
        with self.assertRaises(DomainError):
            J.advance_milestone(m2.pk, self.k.owner, "approve")

    def test_terminate_and_freelancer_profile(self):
        p = J.submit_proposal(self.k.job.pk, self.f1, cover_letter="a", bid_minor=10_000, currency="XAF", delivery_days=3)
        c = J.accept_proposal(p.pk, self.k.owner)
        with self.assertRaises(PermissionDeniedError):
            J.terminate_contract(c.pk, make_user())
        self.assertEqual(J.terminate_contract(c.pk, self.f1).status, "terminated")
        with self.assertRaises(ConflictError):
            J.terminate_contract(c.pk, self.f1)
        J.upsert_freelancer_profile(self.f1, headline="Dev Django", hourly_rate_minor=15_000, currency="XAF")
        with self.assertRaises(DomainError):
            J.upsert_freelancer_profile(self.f2, hourly_rate_minor=10_000)  # tarif sans devise
        with self.assertRaises(IntegrityError), transaction.atomic():
            Milestone.objects.create(contract=c, position=9, title="x", amount_minor=0)


class JobsConcurrencyTests(BaobabTransactionTestCase):
    def test_parallel_duplicate_applications_create_exactly_one(self):
        k = make_company_job()
        cand = make_user()
        outcomes = []

        def worker():
            try:
                J.apply(k.job.pk, cand, cover_letter="x")
                outcomes.append("ok")
            except ConflictError:
                outcomes.append("dup")
            except Exception as exc:  # noqa: BLE001
                outcomes.append(repr(exc))
            finally:
                connections.close_all()

        ts = [threading.Thread(target=worker) for _ in range(8)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual((outcomes.count("ok"), outcomes.count("dup"), JobApplication.objects.count()), (1, 7, 1))

    def test_two_candidates_racing_for_one_slot_only_one_wins(self):
        k = make_company_job()
        slot = J.create_slot(k.recruiter, k.job, starts_at=in_hours(24), ends_at=in_hours(25))
        apps = []
        for _ in range(2):
            a = J.apply(k.job.pk, make_user(), cover_letter="x")
            J.transition_application(a.pk, k.recruiter, "reviewing"); J.transition_application(a.pk, k.recruiter, "shortlisted")
            apps.append(a)
        outcomes = []

        def worker(app):
            try:
                J.book_slot(app.pk, slot.pk, app.applicant)
                outcomes.append("ok")
            except ConflictError:
                outcomes.append("taken")
            except Exception as exc:  # noqa: BLE001
                outcomes.append(repr(exc))
            finally:
                connections.close_all()

        ts = [threading.Thread(target=worker, args=(a,)) for a in apps]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual((sorted(outcomes), InterviewSlot.objects.filter(booked_by__isnull=False).count()), (["ok", "taken"], 1))
