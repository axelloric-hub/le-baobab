from django.db import IntegrityError, connection, transaction

from apps.accounts.models import User
from apps.audit.models import AdminAction, AuditLog
from apps.audit.services import admin_action, audit_context, record, security_event
from apps.core.testing import BaobabTestCase, make_user


class AuditTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.admin, self.u = make_user("admin_x"), make_user("target_x")

    def test_row_trigger_captures_changes_with_actor_even_for_raw_sql_but_hides_secrets(self):
        with audit_context(actor_id=self.admin.pk, ip="10.1.2.3"):
            with connection.cursor() as cur:
                cur.execute("UPDATE accounts_user SET status = 'deactivated' WHERE id = %s", [self.u.pk])
        log = AuditLog.objects.get(action="accounts_user.update", object_id=str(self.u.pk))
        self.assertEqual((log.source, log.actor_id, log.actor_label, str(log.ip_address)), ("trigger", self.admin.pk, "admin_x", "10.1.2.3"))
        self.assertEqual((log.old_values, log.new_values), ({"status": "pending"}, {"status": "deactivated"}))  # diff minimal seulement

    def test_secrets_are_never_logged(self):
        self.u.set_password("another-S3cret-value!"); self.u.save()
        self.assertFalse(AuditLog.objects.filter(object_id=str(self.u.pk), action="accounts_user.update").exists())  # password exclu => rien d'auditable
        for log in AuditLog.objects.all():
            self.assertNotIn("password", (log.new_values or {}) | (log.old_values or {}))

    def test_no_actor_context_means_system_actor(self):
        User.objects.filter(pk=self.u.pk).update(status="active")
        log = AuditLog.objects.filter(action="accounts_user.update", object_id=str(self.u.pk)).latest("id")
        self.assertEqual((log.actor_id, log.actor_label), (None, "system"))

    def test_audit_log_is_append_only(self):
        entry = record(actor=self.admin, action="x.test", object_type="t", object_id="1", new={"a": 1})
        for sql in ("UPDATE audit_log SET action = 'tampered' WHERE id = %s", "DELETE FROM audit_log WHERE id = %s"):
            with self.assertRaises(Exception) as cm, transaction.atomic(), connection.cursor() as cur:
                cur.execute(sql, [entry.pk])
            self.assertIn("ecriture seule", str(cm.exception))
        self.assertEqual(AuditLog.objects.get(pk=entry.pk).action, "x.test")

    def test_admin_action_is_immutable_and_double_logged(self):
        a = admin_action(admin=self.admin, action="grant_badge", target_type="user", target_id=self.u.pk, reason="verified")
        self.assertTrue(AuditLog.objects.filter(action="admin.grant_badge").exists())
        with self.assertRaises(Exception), transaction.atomic():
            AdminAction.objects.filter(pk=a.pk).update(reason="rewritten")

    def test_deleting_a_user_keeps_audit_trail_with_actor_nullified(self):
        record(actor=self.admin, action="x.test", object_type="t", object_id="1")
        self.admin.delete()  # SET NULL sur audit_log.actor : autorise par le trigger, rien d'autre ne l'est
        log = AuditLog.objects.get(action="x.test")
        self.assertEqual((log.actor_id, log.actor_label), (None, "admin_x"))

    def test_security_event_and_context_isolation(self):
        security_event(event_type="suspicious_login", user=self.u, severity="warning", ip="1.2.3.4")
        with audit_context(actor_id=self.admin.pk):
            pass
        with connection.cursor() as cur:  # set_config(local) ne fuit pas hors transaction
            cur.execute("SELECT current_setting('baobab.actor_id', true)")
            self.assertIn(cur.fetchone()[0], (None, ""))
