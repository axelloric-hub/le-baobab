from django.core.management.base import BaseCommand
from django.db.models import F

from apps.core import redis as R
from apps.core import redis_keys as K
from apps.social.feed import update_card_counters
from apps.social.models import Post


class Command(BaseCommand):
    help = "Draine les compteurs de vues Redis (GETDEL atomique) vers social_post.view_count. A planifier toutes les minutes."

    def handle(self, *args, **opts):
        r, prefix, total, flushed = R.get_redis(), K.counter("post_view", ""), 0, 0
        for key in r.scan_iter(match=f"{prefix}*", count=500):
            post_id = key[len(prefix):]
            n = R.drain_counter("post_view", post_id)
            if n:
                Post.objects.filter(pk=post_id).update(view_count=F("view_count") + n)
                update_card_counters(post_id)
                total += n
                flushed += 1
        self.stdout.write(self.style.SUCCESS(f"{flushed} posts, {total} vues"))
