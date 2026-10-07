import threading
import uuid
from datetime import timedelta

from channels.testing import WebsocketCommunicator
from django.db import IntegrityError, connection, connections, transaction
from django.utils import timezone

from apps.core.exceptions import DomainError, PermissionDeniedError
from apps.core.testing import BaobabTestCase, BaobabTransactionTestCase, make_user
from apps.friends import services as F
from apps.messaging import selectors as S
from apps.messaging import services as M
from apps.messaging.models import ConversationMember, Message
from apps.messaging.paginations import MessageCursorPagination
from apps.messaging.serializers import MessageCreateSerializer, MessageSerializer


class ConversationTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.a, self.b, self.c = make_user(), make_user(), make_user()

    def test_direct_conversation_is_unique_per_pair(self):
        c1, created1 = M.get_or_create_direct(self.a, self.b)
        c2, created2 = M.get_or_create_direct(self.b, self.a)
        self.assertEqual((c1.pk, created1, created2), (c2.pk, True, False))
        self.assertEqual(c1.members.count(), 2)

    def test_privacy_and_blocking_gate_direct_messages(self):
        self.b.privacy.who_can_message = "friends"; self.b.privacy.save()
        with self.assertRaises(PermissionDeniedError):
            M.get_or_create_direct(self.a, self.b)
        F.respond_to_request(F.send_friend_request(self.a, self.b).pk, self.b, True)
        conv, _ = M.get_or_create_direct(self.a, self.b)
        F.block_user(self.b, self.a)
        with self.assertRaises(PermissionDeniedError):
            M.send_message(conversation_id=conv.pk, sender=self.a, body="hi")

    def test_db_rejects_direct_conversation_without_key(self):
        from apps.messaging.models import Conversation
        with self.assertRaises(IntegrityError), transaction.atomic():
            Conversation.objects.create(type="direct")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Conversation.objects.create(type="group", direct_key="x:y")


class MessageTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.a, self.b, self.c = make_user(), make_user(), make_user()
        self.conv, _ = M.get_or_create_direct(self.a, self.b)

    def send(self, who=None, body="hello", **kw):
        return M.send_message(conversation_id=self.conv.pk, sender=who or self.a, body=body, **kw)

    def test_seq_is_gapless_monotonic_and_assigned_by_trigger(self):
        seqs = [self.send(body=f"m{i}").seq for i in range(5)]
        self.assertEqual(seqs, [1, 2, 3, 4, 5])
        self.conv.refresh_from_db()
        self.assertEqual((self.conv.message_seq, self.conv.last_message_at is not None), (5, True))

    def test_non_member_cannot_send_or_read(self):
        with self.assertRaises(PermissionDeniedError):
            self.send(who=self.c)
        self.assertFalse(S.is_member(self.c.pk, self.conv.pk))

    def test_client_msg_id_makes_retries_idempotent(self):
        cid = uuid.uuid4()
        m1, m2 = self.send(client_msg_id=cid), self.send(client_msg_id=cid)
        self.assertEqual((m1.pk, Message.objects.count()), (m2.pk, 1))

    def test_unread_counters_sql_and_pointer_based_read_receipts(self):
        for i in range(3):
            self.send(who=self.a, body=f"m{i}")
        inbox = S.inbox(self.b.pk).get()
        self.assertEqual(inbox.unread, 3)
        with connection.cursor() as cur:
            cur.execute("SELECT baobab_unread_count(%s,%s), baobab_unread_count(%s,%s)", [self.conv.pk, self.b.pk, self.conv.pk, self.a.pk])
            self.assertEqual(cur.fetchone(), (3, 0))  # l'expediteur a lu ses propres messages
        M.mark_read(self.conv.pk, self.b, 2)
        self.assertEqual(S.inbox(self.b.pk).get().unread, 1)
        M.mark_read(self.conv.pk, self.b, 1)  # ne recule jamais
        self.assertEqual(ConversationMember.objects.get(user=self.b).last_read_seq, 2)
        M.mark_read(self.conv.pk, self.b, 999)  # plafonne au dernier seq reel
        self.assertEqual(S.inbox(self.b.pk).get().unread, 0)
        self.assertEqual(S.read_receipt_summary(self.conv.pk, 3), 2)

    def test_reply_thread_counter_and_validation(self):
        root = self.send(body="root")
        r1 = self.send(who=self.b, body="re", thread_root_id=root.pk, reply_to_id=root.pk)
        self.send(body="re2", thread_root_id=root.pk)
        root.refresh_from_db()
        self.assertEqual(root.reply_count, 2)
        self.assertEqual([m.pk for m in S.thread(root.pk, self.a.pk)][0], r1.pk)
        self.assertNotIn(r1.pk, [m.pk for m in S.history(self.conv.pk, self.a.pk)])  # les reponses de thread n'inondent pas le flux
        with self.assertRaises(DomainError):
            self.send(thread_root_id=r1.pk)  # pas de thread de thread
        with self.assertRaises(DomainError):
            self.send(reply_to_id=uuid.uuid4())

    def test_mentions_only_resolve_conversation_members(self):
        m = self.send(body=f"salut @{self.b.username} et @{self.c.username} et @inconnu_xyz")
        self.assertEqual(set(m.mentions.values_list("mentioned_user__username", flat=True)), {self.b.username})

    def test_edit_keeps_history_and_only_author_can_edit(self):
        m = self.send(body="v1")
        with self.assertRaises(PermissionDeniedError):
            M.edit_message(m.pk, self.b, "hack")
        M.edit_message(m.pk, self.a, "v2")
        M.edit_message(m.pk, self.a, "v3")
        m.refresh_from_db()
        self.assertEqual((m.body, list(m.edits.order_by("id").values_list("previous_body", flat=True))), ("v3", ["v1", "v2"]))
        Message.objects.filter(pk=m.pk).update(created_at=timezone.now() - timedelta(days=3))
        with self.assertRaises(DomainError):
            M.edit_message(m.pk, self.a, "too late")

    def test_delete_for_me_vs_for_everyone(self):
        m1, m2 = self.send(body="a"), self.send(body="b")
        M.delete_message(m1.pk, self.b, for_everyone=False)
        self.assertNotIn(m1.pk, [x.pk for x in S.history(self.conv.pk, self.b.pk)])
        self.assertIn(m1.pk, [x.pk for x in S.history(self.conv.pk, self.a.pk)])
        with self.assertRaises(PermissionDeniedError):
            M.delete_message(m2.pk, self.b, for_everyone=True)
        M.delete_message(m2.pk, self.a, for_everyone=True)
        self.assertEqual([x.pk for x in S.history(self.conv.pk, self.a.pk)], [m1.pk])
        m2.refresh_from_db()
        self.assertEqual(MessageSerializer(m2).data["body"], "")  # le contenu n'est jamais expose

    def test_reactions_toggle(self):
        m = self.send()
        self.assertTrue(M.toggle_reaction(m.pk, self.b, "👍"))
        self.assertFalse(M.toggle_reaction(m.pk, self.b, "👍"))
        with self.assertRaises(PermissionDeniedError):
            M.toggle_reaction(m.pk, self.c, "👍")

    def test_seq_and_conversation_are_immutable(self):
        m = self.send()
        with self.assertRaises(IntegrityError), transaction.atomic():
            Message.objects.filter(pk=m.pk).update(seq=99)
        other, _ = M.get_or_create_direct(self.a, self.c)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Message.objects.filter(pk=m.pk).update(conversation=other)

    def test_text_message_cannot_be_empty_at_db_level(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Message.objects.create(conversation=self.conv, sender=self.a, body="", kind="text")

    def test_serializers_and_cursor_pagination_config(self):
        self.assertFalse(MessageCreateSerializer(data={"body": "   "}).is_valid())
        self.assertTrue(MessageCreateSerializer(data={"body": "ok"}).is_valid())
        self.assertEqual(MessageCursorPagination.ordering, "-seq")

    def test_history_query_uses_the_seq_index(self):
        for i in range(30):
            self.send(body=f"m{i}")
        with connection.cursor() as cur:
            cur.execute("SET LOCAL enable_seqscan = off")
            cur.execute("EXPLAIN SELECT id FROM messaging_message WHERE conversation_id = %s AND seq < 20 ORDER BY seq DESC LIMIT 10", [self.conv.pk])
            plan = "\n".join(r[0] for r in cur.fetchall())
        self.assertIn("Index Scan Backward using uniq_message_conv_seq", plan)  # l'index de la contrainte UNIQUE suffit : pas d'index redondant


class MessageConcurrencyTests(BaobabTransactionTestCase):
    def test_concurrent_senders_get_unique_gapless_seq(self):
        a, b = make_user(), make_user()
        conv, _ = M.get_or_create_direct(a, b)
        errors, n_threads, per_thread = [], 8, 6

        def worker(user):
            try:
                for i in range(per_thread):
                    M.send_message(conversation_id=conv.pk, sender=user, body=f"{user.username}-{i}")
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)
            finally:
                connections.close_all()

        threads = [threading.Thread(target=worker, args=(a if i % 2 else b,)) for i in range(n_threads)]
        [t.start() for t in threads]; [t.join() for t in threads]
        self.assertEqual(errors, [])
        seqs = sorted(Message.objects.filter(conversation=conv).values_list("seq", flat=True))
        self.assertEqual(seqs, list(range(1, n_threads * per_thread + 1)))

    def test_commit_fanout_updates_redis_unread_counter(self):
        from apps.core import redis_keys as K
        from apps.core.redis import get_redis
        a, b = make_user(), make_user()
        conv, _ = M.get_or_create_direct(a, b)
        M.send_message(conversation_id=conv.pk, sender=a, body="x")
        M.send_message(conversation_id=conv.pk, sender=a, body="y")
        self.assertEqual(get_redis().hget(K.conversation_unread(conv.pk), str(b.pk)), "2")
        self.assertIsNone(get_redis().hget(K.conversation_unread(conv.pk), str(a.pk)))
        M.mark_read(conv.pk, b, 2)
        self.assertIsNone(get_redis().hget(K.conversation_unread(conv.pk), str(b.pk)))


class WebSocketTests(BaobabTransactionTestCase):
    async def _connect(self, user, conv_id):
        from config.routing import websocket_urlpatterns
        from channels.routing import URLRouter
        comm = WebsocketCommunicator(URLRouter(websocket_urlpatterns), f"/ws/conversations/{conv_id}/")
        comm.scope["user"] = user
        return comm

    def test_member_receives_realtime_message_and_stranger_is_rejected(self):
        import asyncio
        from asgiref.sync import async_to_sync, sync_to_async

        a, b, c = make_user(), make_user(), make_user()
        conv, _ = M.get_or_create_direct(a, b)

        async def scenario():
            ok = await self._connect(b, conv.pk)
            connected, _ = await ok.connect()
            bad = await self._connect(c, conv.pk)
            bad_connected, code = await bad.connect()
            msg = await sync_to_async(M.send_message)(conversation_id=conv.pk, sender=a, body="live")
            event = await ok.receive_json_from(timeout=3)
            await ok.send_json_to({"type": "typing"})
            await ok.disconnect()
            return connected, bad_connected, code, event, msg

        connected, bad_connected, code, event, msg = async_to_sync(scenario)()
        self.assertTrue(connected)
        self.assertFalse(bad_connected)
        self.assertEqual(code, 4403)
        self.assertEqual((event["type"], event["seq"], event["message_id"]), ("message", 1, str(msg.pk)))
