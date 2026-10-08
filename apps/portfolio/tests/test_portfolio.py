from datetime import date

from django.db import IntegrityError, transaction

from apps.core.choices import Visibility as V
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.testing import BaobabTestCase, make_user
from apps.education.testing import make_course
from apps.friends import services as F
from apps.portfolio import services as P
from apps.portfolio.models import Portfolio
from apps.portfolio.selectors import can_view_portfolio
from apps.profiles.models import Skill
from apps.progress.models import Certificate


class PortfolioTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.owner = make_user()
        self.p = P.ensure_portfolio(self.owner)

    def set_visibility(self, v):
        Portfolio.objects.filter(pk=self.owner.pk).update(visibility=v)

    def test_visibility_matrix_and_blocking(self):
        friend, follower, stranger = make_user(), make_user(), make_user()
        F.respond_to_request(F.send_friend_request(self.owner, friend).pk, friend, True)
        F.follow(follower, self.owner)
        cases = {V.PUBLIC: {"owner", "friend", "follower", "stranger", "anon"}, V.FOLLOWERS: {"owner", "follower"}, V.FRIENDS: {"owner", "friend"}, V.PRIVATE: {"owner"}}
        who = {"owner": self.owner, "friend": friend, "follower": follower, "stranger": stranger, "anon": None}
        for vis, expected in cases.items():
            self.set_visibility(vis)
            seen = {k for k, u in who.items() if can_view_portfolio(u or type("Anon", (), {"pk": None})(), self.owner.pk)}
            self.assertEqual(seen, expected, vis)
        self.set_visibility(V.PUBLIC)
        F.block_user(self.owner, stranger)
        self.assertFalse(can_view_portfolio(stranger, self.owner.pk))  # le blocage l'emporte, meme en public

    def test_database_forbids_group_or_custom_visibility(self):
        for bad in ("group_members", "custom"):
            with self.assertRaises(IntegrityError), transaction.atomic():
                Portfolio.objects.filter(pk=self.owner.pk).update(visibility=bad)

    def test_project_validation_links_and_ownership(self):
        django = Skill.objects.get(slug="django")
        pr = P.create_project(self.owner, slug="baobab", title="LE BAOBAB", started_on=date(2026, 1, 1), ended_on=date(2026, 6, 1), technologies=[django],
                              links=[{"kind": "repository", "provider": "github", "url": "https://github.com/x/y"}])
        self.assertEqual((pr.technologies.count(), pr.links.count()), (1, 1))
        with self.assertRaises(DomainError):
            P.create_project(self.owner, slug="baobab", title="doublon")
        with self.assertRaises(DomainError):
            P.create_project(self.owner, slug="dates", title="x", started_on=date(2026, 5, 1), ended_on=date(2026, 1, 1))
        with self.assertRaises(DomainError):
            P.create_project(self.owner, slug="http", title="x", links=[{"kind": "demo", "url": "http://insecure.example.com"}])
        with self.assertRaises(PermissionDeniedError):
            P.add_project_link(make_user(), pr.pk, kind="demo", url="https://demo.example.com")  # pas son projet
        P.add_project_link(self.owner, pr.pk, kind="demo", url="https://demo.example.com")

    def test_repositories_experience_education_dates(self):
        r = P.register_repository(self.owner, provider="github", full_name="x/y", url="https://github.com/x/y", stars=3)
        r2 = P.register_repository(self.owner, provider="github", full_name="x/y", url="https://github.com/x/y", stars=10)  # resynchronisation : mise a jour
        self.assertEqual((r.pk, r2.pk), (r.pk, r.pk))
        self.assertEqual(self.owner.repositories.get().stars, 10)
        with self.assertRaises(DomainError):
            P.register_repository(self.owner, provider="bitbucket", full_name="a/b", url="https://x.example.com")
        P.add_experience(self.owner, company_name="X", title="Dev", started_on=date(2024, 1, 1))  # poste actuel
        with self.assertRaises(DomainError):
            P.add_experience(self.owner, company_name="X", title="Dev", started_on=date(2024, 5, 1), ended_on=date(2024, 1, 1))
        with self.assertRaises(DomainError):
            P.add_education(self.owner, institution="Univ", started_on=date(2020, 9, 1), ended_on=date(2019, 1, 1))

    def test_platform_certificate_must_be_yours_and_valid(self):
        k = make_course()
        cert = Certificate.objects.create(user=self.owner, course=k.course, verification_code="BAO-TESTCODE0001")
        other = make_user()
        with self.assertRaises(PermissionDeniedError):
            P.add_platform_certificate(other, cert.pk)  # le certificat d'un autre ne se copie pas
        entry = P.add_platform_certificate(self.owner, cert.pk)
        self.assertEqual((entry.issuer, entry.credential_url), ("LE BAOBAB", "/verify/BAO-TESTCODE0001"))
        with self.assertRaises(ConflictError):
            P.add_platform_certificate(self.owner, cert.pk)
        from django.utils import timezone
        Certificate.objects.filter(pk=cert.pk).update(revoked_at=timezone.now())
        entry.delete()
        with self.assertRaises(PermissionDeniedError):
            P.add_platform_certificate(self.owner, cert.pk)  # un certificat revoque ne s'affiche plus comme verifiable
