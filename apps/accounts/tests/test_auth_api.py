from datetime import timedelta

from django.core import mail
from django.test import override_settings
from django.utils import timezone

from apps.accounts.models import EmailOTP, LoginAttempt, User
from apps.core.api_testing import api_client, verified_user
from apps.core.testing import BaobabTestCase

PW = "Un-mot-de-passe-solide-2026!"


class RegistrationAndOtpTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.c = api_client()

    def register(self, email="ada@example.com", username="ada", password=PW):
        return self.c.post("/api/v1/auth/register/", {"email": email, "username": username, "password": password}, format="json")

    @override_settings(OTP_DEBUG_ECHO=True)
    def test_full_flow_register_verify_login_refresh_logout(self):
        r = self.register()
        self.assertEqual((r.status_code, r.json()["user"]["status"], r.json()["otp"]["email_sent"]), (201, "pending", True))
        code = r.json()["otp"]["debug_code"]  # phase de test : le code est aussi renvoye a l'ecran
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(code, mail.outbox[0].body)
        self.assertEqual(self.c.post("/api/v1/auth/login/", {"email": "ada@example.com", "password": PW}, format="json").json()["error"]["code"], "email_not_verified")
        v = self.c.post("/api/v1/auth/verify-email/", {"email": "ada@example.com", "code": code}, format="json")
        self.assertEqual((v.status_code, v.json()["user"]["status"]), (200, "active"))
        self.assertTrue({"access", "refresh"} <= set(v.json()))
        login = self.c.post("/api/v1/auth/login/", {"email": "ADA@example.com", "password": PW}, format="json")
        self.assertEqual(login.status_code, 200)
        me = api_client()
        me.credentials(HTTP_AUTHORIZATION="Bearer " + login.json()["access"])
        self.assertEqual(me.get("/api/v1/me/login-history/").status_code, 200)
        ref = self.c.post("/api/v1/auth/token/refresh/", {"refresh": login.json()["refresh"]}, format="json")
        self.assertEqual(ref.status_code, 200)
        self.assertEqual(self.c.post("/api/v1/auth/token/refresh/", {"refresh": login.json()["refresh"]}, format="json").status_code, 401)  # rotation : l'ancien est invalide
        self.assertEqual(self.c.post("/api/v1/auth/logout/", {"refresh": ref.json()["refresh"]}, format="json").status_code, 204)
        self.assertEqual(self.c.post("/api/v1/auth/token/refresh/", {"refresh": ref.json()["refresh"]}, format="json").status_code, 401)

    def test_otp_is_hidden_unless_debug_echo_and_never_stored_in_clear(self):
        r = self.register()
        self.assertNotIn("debug_code", r.json()["otp"])
        row = EmailOTP.objects.get()
        code = mail.outbox[0].body.split(": ")[1][:6]
        self.assertNotIn(code, row.code_hash)
        self.assertEqual(len(row.code_hash), 64)

    def test_validation_and_duplicates(self):
        self.assertEqual(self.register(password="123").status_code, 400)
        self.assertEqual(self.register(username="A!").status_code, 400)
        self.assertEqual(self.register(email="pas-un-email").json()["error"]["code"], "validation_error")
        self.register()
        self.assertEqual(self.register(username="autre").json()["error"]["code"], "otp_cooldown")  # re-inscription immediate : delai anti-spam
        EmailOTP.objects.update(created_at=timezone.now() - timedelta(seconds=120))
        self.assertEqual(self.register(username="autre").status_code, 201)  # meme e-mail NON confirme : on renvoie un code, sans rien modifier
        self.assertEqual(User.objects.get(email="ada@example.com").username, "ada")
        u = User.objects.get(email="ada@example.com"); u.email_verified_at = timezone.now(); u.status = "active"; u.save()
        self.assertEqual(self.register().json()["error"]["code"], "email_taken")

    @override_settings(OTP_DEBUG_ECHO=True)
    def test_wrong_codes_lock_after_five_attempts_even_with_the_right_code_afterwards(self):
        code = self.register().json()["otp"]["debug_code"]
        wrong = "000000" if code != "000000" else "111111"
        for i in range(5):
            r = self.c.post("/api/v1/auth/verify-email/", {"email": "ada@example.com", "code": wrong}, format="json")
            self.assertEqual((r.status_code, r.json()["error"]["code"]), (422, "otp_invalid"))
        r = self.c.post("/api/v1/auth/verify-email/", {"email": "ada@example.com", "code": code}, format="json")
        self.assertEqual(r.json()["error"]["code"], "otp_locked")  # le bon code ne passe plus : il faut en redemander un

    @override_settings(OTP_DEBUG_ECHO=True)
    def test_resend_cooldown_and_new_code_invalidates_the_old_one(self):
        old = self.register().json()["otp"]["debug_code"]
        r = self.c.post("/api/v1/auth/resend-otp/", {"email": "ada@example.com"}, format="json")
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (429, "otp_cooldown"))
        EmailOTP.objects.update(created_at=timezone.now() - timedelta(seconds=120))
        new = self.c.post("/api/v1/auth/resend-otp/", {"email": "ada@example.com"}, format="json").json()["debug_code"]
        self.assertEqual(len(mail.outbox), 2)
        if old != new:
            r = self.c.post("/api/v1/auth/verify-email/", {"email": "ada@example.com", "code": old}, format="json")
            self.assertEqual(r.status_code, 422)
        self.assertEqual(self.c.post("/api/v1/auth/verify-email/", {"email": "ada@example.com", "code": new}, format="json").status_code, 200)

    @override_settings(OTP_DEBUG_ECHO=True)
    def test_expired_code_is_refused(self):
        code = self.register().json()["otp"]["debug_code"]
        EmailOTP.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.c.post("/api/v1/auth/verify-email/", {"email": "ada@example.com", "code": code}, format="json").json()["error"]["code"], "otp_expired")

    def test_resend_and_forgot_do_not_reveal_whether_an_account_exists(self):
        a = self.c.post("/api/v1/auth/resend-otp/", {"email": "personne@example.com"}, format="json")
        b = self.c.post("/api/v1/auth/password/forgot/", {"email": "personne@example.com"}, format="json")
        self.assertEqual((a.status_code, b.status_code, a.json()["email_sent"], b.json()["email_sent"]), (200, 200, True, True))
        self.assertEqual(len(mail.outbox), 0)  # ...mais rien n'est reellement envoye


class DailyQuotaTests(BaobabTestCase):
    def fill_quota(self, n):
        EmailOTP.objects.bulk_create([EmailOTP(email=f"x{i}@example.com", purpose="verify_email", code_hash="0" * 64, expires_at=timezone.now(), emailed=True) for i in range(n)])

    def test_the_25th_email_is_sent_and_the_26th_is_not(self):
        self.fill_quota(24)
        c = api_client()
        first = c.post("/api/v1/auth/register/", {"email": "a@example.com", "username": "aaa", "password": PW}, format="json").json()["otp"]
        second = c.post("/api/v1/auth/register/", {"email": "b@example.com", "username": "bbb", "password": PW}, format="json").json()["otp"]
        self.assertEqual((first["email_sent"], first["reason"], second["email_sent"], second["reason"]), (True, "sent", False, "daily_quota_reached"))
        self.assertEqual(len(mail.outbox), 1)

    @override_settings(OTP_DEBUG_ECHO=True)
    def test_quota_reached_still_lets_the_tester_verify_thanks_to_the_on_screen_code(self):
        self.fill_quota(25)
        c = api_client()
        otp = c.post("/api/v1/auth/register/", {"email": "t@example.com", "username": "tester", "password": PW}, format="json").json()["otp"]
        self.assertEqual((otp["email_sent"], otp["reason"]), (False, "daily_quota_reached"))
        self.assertEqual(c.post("/api/v1/auth/verify-email/", {"email": "t@example.com", "code": otp["debug_code"]}, format="json").status_code, 200)

    @override_settings(OTP_DEBUG_ECHO=True, EMAIL_BACKEND="apps.accounts.tests.test_auth_api.BrokenBackend")
    def test_smtp_failure_does_not_lose_the_registration(self):
        c = api_client()
        r = c.post("/api/v1/auth/register/", {"email": "s@example.com", "username": "smtpfail", "password": PW}, format="json")
        self.assertEqual((r.status_code, r.json()["otp"]["email_sent"], r.json()["otp"]["reason"]), (201, False, "email_failed"))
        self.assertTrue(User.objects.filter(email="s@example.com").exists())
        self.assertEqual(c.post("/api/v1/auth/verify-email/", {"email": "s@example.com", "code": r.json()["otp"]["debug_code"]}, format="json").status_code, 200)

    def test_emailed_counter_only_counts_messages_really_sent(self):
        from apps.accounts.otp import emails_sent_today
        self.fill_quota(3)
        EmailOTP.objects.create(email="n@example.com", purpose="verify_email", code_hash="0" * 64, expires_at=timezone.now(), emailed=False)
        EmailOTP.objects.filter(email="x0@example.com").update(created_at=timezone.now() - timedelta(days=2))
        self.assertEqual(emails_sent_today(), 2)


class BrokenBackend:
    """Backend e-mail dont l'envoi echoue toujours (simule un SMTP en panne)."""

    def __init__(self, *a, **kw): pass
    def send_messages(self, messages): raise ConnectionError("smtp down")
    def open(self): return False
    def close(self): pass


class LoginSecurityTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.user = verified_user("grace")
        self.user.set_password(PW); self.user.save()
        self.c = api_client()

    def login(self, pw=PW, email=None):
        return self.c.post("/api/v1/auth/login/", {"email": email or self.user.email, "password": pw}, format="json")

    def test_bad_credentials_are_generic_and_logged(self):
        for r in (self.login("mauvais-mot-de-passe"), self.login(email="inconnu@example.com")):
            self.assertEqual((r.status_code, r.json()["error"]["code"]), (401, "invalid_credentials"))  # meme reponse : pas d'enumeration
        self.assertEqual(LoginAttempt.objects.filter(success=False).count(), 2)

    def test_brute_force_is_throttled_per_email(self):
        codes = [self.login("mauvais").status_code for _ in range(12)]
        self.assertEqual(codes[:10], [401] * 10)
        self.assertEqual(set(codes[10:]), {429})
        self.assertEqual(self.login().status_code, 429)  # meme le BON mot de passe est refuse pendant le blocage

    def test_suspended_and_unverified_accounts_cannot_login(self):
        User.objects.filter(pk=self.user.pk).update(status="suspended", suspension_reason="abus")
        self.assertEqual(self.login().json()["error"]["code"], "account_suspended")
        User.objects.filter(pk=self.user.pk).update(status="active", email_verified_at=None)
        self.assertEqual(self.login().json()["error"]["code"], "email_not_verified")

    @override_settings(OTP_DEBUG_ECHO=True)
    def test_password_reset_revokes_every_session(self):
        tokens = self.login().json()
        code = self.c.post("/api/v1/auth/password/forgot/", {"email": self.user.email}, format="json").json()["debug_code"]
        r = self.c.post("/api/v1/auth/password/reset/", {"email": self.user.email, "code": code, "new_password": "Nouveau-mot-de-passe-9!"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.c.post("/api/v1/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code, 401)  # l'ancienne session est morte
        self.assertEqual(self.login().status_code, 401)
        self.assertEqual(self.login("Nouveau-mot-de-passe-9!").status_code, 200)

    @override_settings(OTP_DEBUG_ECHO=True)
    def test_reset_with_weak_password_or_wrong_code_changes_nothing(self):
        code = self.c.post("/api/v1/auth/password/forgot/", {"email": self.user.email}, format="json").json()["debug_code"]
        self.assertEqual(self.c.post("/api/v1/auth/password/reset/", {"email": self.user.email, "code": code, "new_password": "123"}, format="json").status_code, 400)
        self.assertEqual(self.c.post("/api/v1/auth/password/reset/", {"email": self.user.email, "code": "000001" if code != "000001" else "000002", "new_password": "Nouveau-mot-de-passe-9!"}, format="json").status_code, 422)
        self.assertEqual(self.login().status_code, 200)

    def test_change_password_requires_current_one(self):
        c = api_client(self.user)
        self.assertEqual(c.post("/api/v1/me/password/", {"current_password": "faux", "new_password": "Nouveau-mot-de-passe-9!"}, format="json").status_code, 403)
        r = c.post("/api/v1/me/password/", {"current_password": PW, "new_password": "Nouveau-mot-de-passe-9!"}, format="json")
        self.assertEqual((r.status_code, "access" in r.json()), (200, True))

    def test_protected_endpoints_need_a_token_and_error_format_is_uniform(self):
        r = self.c.get("/api/v1/me/devices/")
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (401, "not_authenticated"))
        bad = api_client(); bad.credentials(HTTP_AUTHORIZATION="Bearer jeton.invalide.ici")
        self.assertEqual(bad.get("/api/v1/me/devices/").status_code, 401)
