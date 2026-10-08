from django.db import IntegrityError, connection, transaction

from apps.companies import services as C
from apps.companies.models import Company, CompanyMember
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.testing import BaobabTestCase, make_user


class CompanyTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.owner, self.u, self.v = make_user(), make_user(), make_user()
        self.co = C.create_company(self.owner, name="Afrik", slug="afrik")

    def test_creation_makes_the_creator_owner_and_rejects_bad_size_or_duplicate_slug(self):
        self.assertEqual(C.member_role(self.owner, self.co), "owner")
        with self.assertRaises(ConflictError):
            C.create_company(self.u, name="Autre", slug="afrik")
        with self.assertRaises(ConflictError):
            C.create_company(self.u, name="Autre", slug="autre", size_range="enorme")

    def test_role_hierarchy(self):
        C.add_member(self.co, self.owner, self.u, "admin")
        with self.assertRaises(PermissionDeniedError):
            C.add_member(self.co, self.u, self.v, "admin")  # un admin ne nomme pas d'admin
        C.add_member(self.co, self.u, self.v, "recruiter")
        with self.assertRaises(PermissionDeniedError):
            C.add_member(self.co, self.v, make_user(), "employee")  # un recruteur n'ajoute personne
        with self.assertRaises(ConflictError):
            C.add_member(self.co, self.owner, self.u, "editor")
        with self.assertRaises(PermissionDeniedError):
            C.remove_member(self.co, self.v, self.u)  # un recruteur ne retire pas un admin
        C.remove_member(self.co, self.v, self.v)  # on peut toujours partir
        self.assertIsNone(C.member_role(self.v, self.co))

    def test_last_owner_is_protected_by_service_and_by_the_database(self):
        with self.assertRaises(DomainError) as cm:
            C.remove_member(self.co, self.owner, self.owner)
        self.assertEqual(cm.exception.code, "last_owner")
        with self.assertRaises(DomainError):
            C.change_role(self.co, self.owner, self.owner, "admin")
        # Meme en contournant le service : la contrainte differee refuse la validation.
        with self.assertRaises(Exception) as cm, transaction.atomic():
            CompanyMember.objects.filter(company=self.co, user=self.owner).delete()
            connection.cursor().execute("SET CONSTRAINTS ALL IMMEDIATE")
        self.assertIn("proprietaire", str(cm.exception))

    def test_ownership_transfer_in_one_transaction_is_allowed(self):
        C.add_member(self.co, self.owner, self.u, "admin")
        C.change_role(self.co, self.owner, self.u, "owner")
        C.change_role(self.co, self.owner, self.owner, "admin")  # il reste un autre proprietaire
        self.assertEqual((C.member_role(self.u, self.co), C.member_role(self.owner, self.co)), ("owner", "admin"))

    def test_company_cannot_be_created_without_an_owner_at_commit(self):
        with self.assertRaises(Exception) as cm, transaction.atomic():
            Company.objects.create(slug="orpheline", name="Orpheline")
            connection.cursor().execute("SET CONSTRAINTS ALL IMMEDIATE")
        self.assertIn("proprietaire", str(cm.exception))

    def test_verification_workflow(self):
        C.add_member(self.co, self.owner, self.u, "recruiter")
        with self.assertRaises(PermissionDeniedError):
            C.submit_verification(self.co, self.u, method="document")
        v = C.submit_verification(self.co, self.owner, method="document", evidence={"doc": "rccm.pdf"})
        with self.assertRaises(ConflictError):
            C.submit_verification(self.co, self.owner, method="domain_email")
        with self.assertRaises(PermissionDeniedError):
            C.review_verification(v.pk, self.owner, approve=True)
        admin = make_user(); admin.is_staff = True; admin.save()
        C.review_verification(v.pk, admin, approve=True, notes="RCCM valide")
        self.co.refresh_from_db()
        self.assertEqual(self.co.status, "verified")
        with self.assertRaises(ConflictError):
            C.review_verification(v.pk, admin, approve=False)

    def test_social_links_require_https_and_editors_can_edit_content(self):
        C.add_member(self.co, self.owner, self.u, "editor")
        C.set_social_link(self.co, self.u, provider="linkedin", url="https://linkedin.com/company/afrik")
        with self.assertRaises(DomainError):
            C.set_social_link(self.co, self.u, provider="website", url="http://insecure.example.com")
        with self.assertRaises(PermissionDeniedError):
            C.add_project(self.co, self.v, title="x")
        C.add_service(self.co, self.u, title="Audit", starting_price_minor=50_000, currency="XAF")
        with self.assertRaises(DomainError):
            C.add_service(self.co, self.u, title="Sans devise", starting_price_minor=1)
