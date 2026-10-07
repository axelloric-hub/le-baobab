from django.test import SimpleTestCase

from config.settings.channel_layers import build_channel_layers


class ChannelLayerChoiceTests(SimpleTestCase):
    def test_redis_when_url_given(self):
        cfg = build_channel_layers("rediss://default:x@host:6379", "baobab")["default"]
        self.assertEqual(cfg["BACKEND"], "channels_redis.core.RedisChannelLayer")
        self.assertEqual(cfg["CONFIG"]["hosts"], ["rediss://default:x@host:6379"])
        self.assertEqual(cfg["CONFIG"]["prefix"], "baobab:asgi")

    def test_in_memory_when_url_empty(self):
        self.assertEqual(build_channel_layers("", "baobab")["default"]["BACKEND"], "channels.layers.InMemoryChannelLayer")
