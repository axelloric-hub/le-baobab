import threading
import uuid
from datetime import timedelta
from unittest import mock

from django.db import IntegrityError, connection, connections, transaction
from django.utils import timezone

from apps.advertising import delivery as D
from apps.advertising import services as A
from apps.advertising.models import MICRO, AdAccount, AdAccountTransaction, Advertisement, AdSettlement, Campaign, TargetingRule
from apps.advertising.testing import make_live_ad, user_with
from apps.core import redis as R
from apps.core.exceptions import ConflictError, DomainError, PermissionDeniedError
from apps.core.models import OutboxEvent
from apps.core.mongo import collection
from apps.core.testing import BaobabTestCase, BaobabTransactionTestCase, make_user


class WalletTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.owner = make_user()
        self.acct = A.create_advertiser(self.owner, name="Acme", currency="xaf")

    def test_topup_is_idempotent_and_owner_only(self):
        t1, c1 = A.top_up(self.acct.pk, self.owner, amount_minor=10_000, reference="pay-1")
        t2, c2 = A.top_up(self.acct.pk, self.owner, amount_minor=10_000, reference="pay-1")  # webhook rejoue
        self.acct.refresh_from_db()
        self.assertEqual((t1.pk, c1, c2, self.acct.balance_minor), (t1.pk, True, False, 10_000))
        with self.assertRaises(PermissionDeniedError):
            A.top_up(self.acct.pk, make_user(), amount_minor=1, reference="x")
        for bad in ({"amount_minor": 0, "reference": "z"}, {"amount_minor": 5, "reference": " "}):
            with self.assertRaises(DomainError):
                A.top_up(self.acct.pk, self.owner, **bad)

    def test_database_forbids_overdraft_and_inconsistent_wallet(self):
        A.top_up(self.acct.pk, self.owner, amount_minor=1_000, reference="p")
        with self.assertRaises(IntegrityError), transaction.atomic():
            AdAccount.objects.filter(pk=self.acct.pk).update(balance_minor=-1)  # jamais de decouvert
        with self.assertRaises(Exception) as cm, transaction.atomic():
            AdAccount.objects.filter(pk=self.acct.pk).update(balance_minor=999_999)  # solde modifie SANS ecriture au journal
            connection.cursor().execute("SET CONSTRAINTS ALL IMMEDIATE")
        self.assertIn("incoherent", str(cm.exception))

    def test_journal_is_append_only_and_signs_are_enforced(self):
        tx, _ = A.top_up(self.acct.pk, self.owner, amount_minor=500, reference="p")
        for sql in ("UPDATE advertising_account_transaction SET amount_minor = 1 WHERE id = %s", "DELETE FROM advertising_account_transaction WHERE id = %s"):
            with self.assertRaises(Exception) as cm, transaction.atomic(), connection.cursor() as cur:
                cur.execute(sql, [tx.pk])
            self.assertIn("ecriture seule", str(cm.exception))
        with self.assertRaises(IntegrityError), transaction.atomic():
            AdAccountTransaction.objects.create(account=self.acct, kind="spend", amount_minor=50, balance_after_minor=0, reference="bad-sign")  # une depense est negative


class CampaignSetupTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.owner = make_user()
        self.acct = A.create_advertiser(self.owner, name="Acme", currency="XAF")
        self.camp = A.create_campaign(self.acct, self.owner, name="C", starts_at=timezone.now(), daily_budget_minor=1_000, total_budget_minor=10_000)

    def test_budget_and_period_validation(self):
        with self.assertRaises(DomainError):
            A.create_campaign(self.acct, self.owner, name="x", starts_at=timezone.now(), daily_budget_minor=5_000, total_budget_minor=1_000)  # journalier > total
        with self.assertRaises(DomainError):
            A.create_campaign(self.acct, self.owner, name="x", starts_at=timezone.now(), ends_at=timezone.now() - timedelta(days=1), daily_budget_minor=1, total_budget_minor=1)
        with self.assertRaises(PermissionDeniedError):
            A.create_campaign(self.acct, make_user(), name="x", starts_at=timezone.now(), daily_budget_minor=1, total_budget_minor=1)

    def test_targeting_whitelist_is_enforced_by_service_and_database(self):
        for field in ("religion", "health", "ethnicity", "sexual_orientation", "political_opinion"):
            with self.assertRaises(DomainError) as cm:
                A.create_ad_set(self.camp, self.owner, name="x", bid_minor=5, placements=["feed"], rules=[{"field": field, "values": ["x"]}])
            self.assertEqual(cm.exception.code, "targeting_not_allowed")
        s = A.create_ad_set(self.camp, self.owner, name="ok", bid_minor=5, placements=["feed"], rules=[{"field": "skill", "operator": "in", "values": ["django"]}])
        with self.assertRaises(IntegrityError), transaction.atomic():  # meme en contournant le service
            TargetingRule.objects.create(ad_set=s, field="religion", values=["x"])

    def test_ad_set_validation(self):
        for kw in ({"placements": []}, {"placements": ["billboard"]}, {"placements": ["feed"], "rules": [{"field": "skill", "values": []}]},
                   {"placements": ["feed"], "rules": [{"field": "skill", "operator": "xor", "values": ["a"]}]}):
            with self.assertRaises(DomainError):
                A.create_ad_set(self.camp, self.owner, name="x", bid_minor=5, **kw)
        with self.assertRaises(DomainError):
            A.create_ad_set(self.camp, self.owner, name="x", bid_minor=0, placements=["feed"])
        other = A.create_advertiser(make_user(), name="Autre", currency="XAF").advertiser
        foreign = A.Audience.objects.create(advertiser=other, name="liste")
        with self.assertRaises(PermissionDeniedError):
            A.create_ad_set(self.camp, self.owner, name="x", bid_minor=5, placements=["feed"], audience=foreign)

    def test_creative_rules_and_review_workflow(self):
        with self.assertRaises(DomainError):
            A.create_creative(self.acct.advertiser, self.owner, headline="x", destination_url="http://insecure.example.com")
        with self.assertRaises(DomainError):
            A.create_creative(self.acct.advertiser, self.owner, headline="x", kind="image", destination_url="https://ok.example.com")  # image sans media
        ad_set = A.create_ad_set(self.camp, self.owner, name="s", bid_minor=5, placements=["feed"])
        cr = A.create_creative(self.acct.advertiser, self.owner, headline="Pub", destination_url="https://ok.example.com")
        ad = A.create_ad(ad_set, cr, self.owner)
        with self.assertRaises(DomainError):
            A.activate_campaign(self.camp, self.owner)  # pas de fonds, pas d'annonce validee
        A.submit_for_review(ad, self.owner)
        with self.assertRaises(PermissionDeniedError):
            A.review_ad(ad.pk, self.owner, approve=True)  # l'annonceur ne se valide pas lui-meme
        admin = make_user(); admin.is_staff = True; admin.save()
        A.review_ad(ad.pk, admin, approve=False, notes="visuel trompeur")
        with self.assertRaises(ConflictError):
            A.review_ad(ad.pk, admin, approve=True)
        ad.refresh_from_db()
        A.submit_for_review(ad, self.owner)  # resoumission possible apres refus
        A.review_ad(ad.pk, admin, approve=True)
        with self.assertRaises(DomainError) as cm:
            A.activate_campaign(self.camp, self.owner)
        self.assertEqual(cm.exception.code, "insufficient_funds")
        A.top_up(self.acct.pk, self.owner, amount_minor=5_000, reference="p")
        self.assertEqual(A.activate_campaign(self.camp, self.owner).status, "active")

    def test_nothing_can_be_active_without_review_even_through_sql(self):
        ad_set = A.create_ad_set(self.camp, self.owner, name="s", bid_minor=5, placements=["feed"])
        ad = A.create_ad(ad_set, A.create_creative(self.acct.advertiser, self.owner, headline="x", destination_url="https://ok.example.com"), self.owner)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Advertisement.objects.filter(pk=ad.pk).update(status="active")  # pas de reviewed_at


class SelectionTests(BaobabTestCase):
    def test_targeting_audience_and_personalization_drive_selection(self):
        targeted = make_live_ad(rules=[{"field": "skill", "operator": "in", "values": ["django", "python"]}, {"field": "country", "values": ["cm"]}])
        dev, other = user_with(["django"], country="CM"), user_with(["rust"], country="CM")
        self.assertEqual([a.pk for a in D.select_ads(dev, "feed")], [targeted.ad.pk])
        self.assertEqual(D.select_ads(other, "feed"), [])
        self.assertEqual(D.select_ads(dev, "sidebar"), [])  # mauvais emplacement
        A.set_personalization(dev, False)
        self.assertEqual(D.select_ads(dev, "feed"), [])    # a refuse le ciblage personnel
        generic = make_live_ad()
        self.assertEqual([a.pk for a in D.select_ads(dev, "feed")], [generic.ad.pk])  # l'annonce generique reste montree

    def test_custom_audience_restricts_delivery_to_members(self):
        live = make_live_ad()
        aud = A.Audience.objects.create(advertiser=live.account.advertiser, name="Clients")
        live.ad_set.audience = aud
        live.ad_set.save()
        member, outsider = make_user(), make_user()
        A.add_to_audience(aud, live.owner, [member])
        self.assertEqual(len(D.select_ads(member, "feed")), 1)
        self.assertEqual(D.select_ads(outsider, "feed"), [])
        with self.assertRaises(PermissionDeniedError):
            A.add_to_audience(aud, make_user(), [outsider])

    def test_higher_value_wins_and_soft_rules_boost(self):
        cheap = make_live_ad(bid=2)
        rich = make_live_ad(bid=9)
        u = make_user()
        self.assertEqual(D.select_ads(u, "feed", limit=2)[0].pk, rich.ad.pk)
        boosted = make_live_ad(bid=2, rules=[{"field": "country", "values": ["cm"], "required": False, "weight": 10}])
        cm = user_with([], country="CM")
        # valeurs attendues par impression : rich 9 x ctr ; boosted 2 x ctr x (1 + 10/10) = 4 x ctr ; cheap 2 x ctr
        self.assertEqual([a.pk for a in D.select_ads(cm, "feed", limit=3)], [rich.ad.pk, boosted.ad.pk, cheap.ad.pk])
        other = D.select_ads(make_user(), "feed", limit=3)  # sans le critere souple (pays) : plus de bonus, boosted et cheap sont a egalite
        self.assertEqual(other[0].pk, rich.ad.pk)
        self.assertEqual({a.pk for a in other[1:]}, {boosted.ad.pk, cheap.ad.pk})

    def test_inactive_expired_or_unfunded_campaigns_are_never_selected(self):
        live = make_live_ad()
        u = make_user()
        self.assertEqual(len(D.select_ads(u, "feed")), 1)
        Campaign.objects.filter(pk=live.campaign.pk).update(ends_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(D.select_ads(u, "feed"), [])
        Campaign.objects.filter(pk=live.campaign.pk).update(ends_at=None)
        self.assertEqual(len(D.select_ads(u, "feed")), 1)
        acct = AdAccount.objects.get(pk=live.account.pk)
        AdAccountTransaction.objects.create(account=acct, kind="spend", amount_minor=-acct.balance_minor, balance_after_minor=0, reference="vidage")  # ecriture coherente
        AdAccount.objects.filter(pk=acct.pk).update(balance_minor=0)
        self.assertEqual(D.select_ads(u, "feed"), [])  # portefeuille vide : plus rien ne diffuse


class EventTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.live = make_live_ad(bid=4, daily=10, total=1_000, freq=2)
        self.u = make_user()

    def imp(self, user=None, ad=None):
        iid = uuid.uuid4().hex
        return iid, D.record_impression((ad or self.live.ad).pk, user or self.u, "feed", iid)

    def test_impression_deduplication_and_frequency_cap(self):
        iid, ok = self.imp()
        self.assertTrue(ok)
        self.assertFalse(D.record_impression(self.live.ad.pk, self.u, "feed", iid))  # meme impression rapportee deux fois
        self.assertTrue(self.imp()[1])
        self.assertFalse(self.imp()[1])  # plafond : 2 par jour et par utilisateur
        self.assertTrue(self.imp(make_user())[1])  # un autre utilisateur n'est pas affecte
        self.assertEqual(D.select_ads(self.u, "feed"), [])  # et l'annonce n'est plus proposee a cet utilisateur
        self.assertFalse(D.record_impression(self.live.ad.pk, self.u, "billboard", uuid.uuid4().hex))

    def test_click_validation_fraud_and_dedup(self):
        iid, _ = self.imp()
        other = make_user()
        self.assertFalse(D.record_click("inconnue", self.u))               # impression inconnue
        self.assertFalse(D.record_click(iid, other))                       # impression d'un autre utilisateur
        self.assertTrue(D.record_click(iid, self.u, ip="203.0.113.7"))
        self.assertFalse(D.record_click(iid, self.u))                      # un seul clic par impression
        doc = collection("ad_events").find_one({"_id": f"click:{iid}"})
        self.assertEqual(doc["type"], "click")
        self.assertNotIn("203.0.113.7", str(doc))                           # l'IP n'est jamais stockee en clair
        self.assertEqual(len(doc["ip_hash"]), 16)

    def test_stale_click_and_conversion_windows(self):
        iid, _ = self.imp()
        collection("ad_events").update_one({"_id": f"imp:{iid}"}, {"$set": {"ts": timezone.now() - timedelta(hours=25)}})
        self.assertFalse(D.record_click(iid, self.u))  # fenetre de clic : 24 h
        iid2, _ = self.imp()
        self.assertFalse(D.record_conversion(iid2, self.u))  # pas de conversion sans clic
        D.record_click(iid2, self.u)
        self.assertTrue(D.record_conversion(iid2, self.u))
        self.assertFalse(D.record_conversion(iid2, self.u))  # une conversion par clic

    def test_daily_budget_is_a_hard_ceiling(self):
        # budget journalier 10, clic a 4 : exactement 2 clics factures, le 3e est refuse
        ids = [self.imp(make_user())[0] for _ in range(4)]
        users = [collection("ad_events").find_one({"_id": f"imp:{i}"})["user_id"] for i in ids]
        from apps.accounts.models import User
        results = [D.record_click(i, User.objects.get(pk=uid)) for i, uid in zip(ids, users)]
        self.assertEqual(results, [True, True, False, False])

    def test_budget_counter_rebuilds_from_postgres_when_redis_is_lost(self):
        iid, _ = self.imp()
        D.record_click(iid, self.u)
        D.settle()  # 4 reglees en base
        R.get_redis().flushdb()  # Upstash redemarre
        c = Campaign.objects.get(pk=self.live.campaign.pk)
        D.budget_available(c, 1)  # reinitialise le compteur total depuis PostgreSQL
        self.assertEqual(int(R.get_redis().get(f"baobab:ad:gate_total:{c.pk}")), 4 * MICRO)


class SettlementTests(BaobabTestCase):
    def setUp(self):
        super().setUp()
        self.live = make_live_ad(balance=100, bid=4, daily=1_000, total=1_000, freq=5)
        self.u = make_user()

    def click(self, n=1):
        for _ in range(n):
            iid = uuid.uuid4().hex
            D.record_impression(self.live.ad.pk, self.u, "feed", iid)
            D.record_click(iid, self.u)

    def test_settlement_debits_the_wallet_once_and_is_idempotent(self):
        self.click(3)
        res = D.settle()
        self.live.account.refresh_from_db()
        self.assertEqual((res["ads"], self.live.account.balance_minor), (1, 100 - 12))
        tx = AdAccountTransaction.objects.get(kind="spend")
        self.assertEqual((tx.amount_minor, tx.balance_after_minor, tx.reference.startswith("settle:")), (-12, 88, True))
        s = AdSettlement.objects.get()
        self.assertEqual((s.impressions, s.clicks, s.spend_micro), (3, 3, 12 * MICRO))
        self.assertEqual(D.settle()["ads"], 0)      # rien de neuf
        self.assertEqual(D.recover_settlements(), 0)
        with connection.cursor() as cur:
            cur.execute("SELECT impressions, clicks, spend_minor, ctr_percent FROM v_campaign_statistics WHERE campaign_id = %s", [self.live.campaign.pk])
            self.assertEqual(tuple(float(x) for x in cur.fetchone()), (3.0, 3.0, 12.0, 100.0))

    def test_crash_between_rename_and_commit_is_recovered_without_double_billing(self):
        self.click(2)
        with mock.patch.object(D, "_apply_batch", side_effect=RuntimeError("panne")):
            with self.assertRaises(RuntimeError):
                D.settle()
        self.live.account.refresh_from_db()
        self.assertEqual(self.live.account.balance_minor, 100)            # rien n'a ete debite
        self.assertEqual(len(list(R.get_redis().scan_iter("baobab:ad:settling:*"))), 1)  # le lot attend
        self.assertEqual(D.recover_settlements(), 1)
        self.assertEqual(D.recover_settlements(), 0)
        self.live.account.refresh_from_db()
        self.assertEqual(self.live.account.balance_minor, 92)             # debite UNE fois

    def test_replaying_the_same_batch_never_double_bills(self):
        self.click(2)
        r = R.get_redis()
        key = next(r.scan_iter("baobab:ad:acc:*"))
        ad_id, day = key.rsplit(":", 2)[-2:]
        h = r.hgetall(key)
        rows = [("k", ad_id, day, int(h["impressions"]), int(h["clicks"]), 0, int(h["spend_micro"]))]
        batch = uuid.uuid4().hex
        D._apply_batch(batch, rows)
        D._apply_batch(batch, rows)  # rejeu du MEME lot (reprise apres plantage)
        self.live.account.refresh_from_db()
        self.assertEqual((self.live.account.balance_minor, AdSettlement.objects.count(), AdAccountTransaction.objects.filter(kind="spend").count()), (92, 1, 1))

    def test_fractional_spend_is_carried_not_lost(self):
        def settle_micro(micro):
            D._apply_batch(uuid.uuid4().hex, [("k", str(self.live.ad.pk), timezone.now().date().isoformat(), 1, 0, 0, micro)])
            self.live.account.refresh_from_db()
            return self.live.account.balance_minor, self.live.account.spend_remainder_micro
        self.assertEqual(settle_micro(400_000), (100, 400_000))      # 0,4 : rien a debiter encore
        self.assertEqual(settle_micro(400_000), (100, 800_000))
        self.assertEqual(settle_micro(400_000), (99, 200_000))       # 1,2 : 1 debite, reste 0,2
        self.assertEqual(settle_micro(900_000), (98, 100_000))

    def test_out_of_funds_pauses_everything_and_balance_never_goes_negative(self):
        acct = A.create_advertiser(make_user(), name="Pauvre", currency="XAF")
        owner = acct.advertiser.owner
        A.top_up(acct.pk, owner, amount_minor=3, reference="p")  # 3 unites reellement rechargees
        poor = make_live_ad(account=acct, advertiser_user=owner, bid=4, daily=1_000, total=1_000)
        D._apply_batch(uuid.uuid4().hex, [("k", str(poor.ad.pk), timezone.now().date().isoformat(), 5, 5, 0, 5 * MICRO)])  # 5 a payer, 3 en caisse
        acct.refresh_from_db(); poor.campaign.refresh_from_db()
        self.assertEqual((acct.balance_minor, poor.campaign.status, poor.campaign.pause_reason), (0, "paused", "out_of_funds"))
        self.assertTrue(OutboxEvent.objects.filter(event_type="AdAccountOutOfFunds").exists())
        shown = {a.pk for a in D.select_ads(make_user(), "feed", limit=5)}
        self.assertNotIn(poor.ad.pk, shown)          # la campagne en pause ne diffuse plus...
        self.assertIn(self.live.ad.pk, shown)        # ...tandis que celle d'un autre annonceur, financee, continue

    def test_campaign_completes_when_its_total_budget_is_spent(self):
        live = make_live_ad(balance=1_000, bid=5, daily=10, total=10)
        D._apply_batch(uuid.uuid4().hex, [("k", str(live.ad.pk), timezone.now().date().isoformat(), 2, 2, 0, 10 * MICRO)])
        live.campaign.refresh_from_db()
        self.assertEqual((live.campaign.status, live.campaign.pause_reason), ("completed", "budget_exhausted"))


class AdConcurrencyTests(BaobabTransactionTestCase):
    def test_parallel_clicks_cannot_exceed_the_budget(self):
        live = make_live_ad(bid=4, daily=12, total=1_000, freq=5)  # budget : 3 clics a 4
        users, ids = [make_user() for _ in range(8)], []
        for u in users:
            iid = uuid.uuid4().hex
            D.record_impression(live.ad.pk, u, "feed", iid)
            ids.append(iid)
        outcomes, lock = [], threading.Lock()

        def worker(iid, u):
            try:
                res = D.record_click(iid, u)
            except Exception as exc:  # noqa: BLE001
                res = repr(exc)
            finally:
                connections.close_all()
            with lock:
                outcomes.append(res)

        ts = [threading.Thread(target=worker, args=(i, u)) for i, u in zip(ids, users)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual((outcomes.count(True), outcomes.count(False), len(outcomes)), (3, 5, 8))
        spent = int(R.get_redis().hget(f"baobab:ad:acc:{live.ad.pk}:{D._today()}", "spend_micro"))
        self.assertEqual(spent, 12 * MICRO)  # jamais plus que le budget
