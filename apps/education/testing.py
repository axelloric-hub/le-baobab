"""Fabriques de test du LMS (cours complet : classroom, cours, 3 modules, chapitres gratuits/payants)."""
from __future__ import annotations

from types import SimpleNamespace

from apps.core.testing import make_user
from apps.education import services as E


def make_course(privacy: str = "public", *, publish: bool = True, classroom_paid: bool = False):
    teacher = make_user()
    kw = {"is_paid": True, "price_minor": 5000, "currency": "XAF"} if classroom_paid else {}
    classroom = E.create_classroom(owner=teacher, title="Dev Africa", slug=f"c-{teacher.username}", privacy=privacy, **kw)
    course = E.create_course(classroom=classroom, creator=teacher, title="Django", slug="django")
    m1 = E.add_module(course, teacher, title="Intro gratuite", is_free=True)
    m2 = E.add_module(course, teacher, title="Avance payant", is_free=False, price_minor=15000, currency="XAF")
    m3 = E.add_module(course, teacher, title="Bonus gratuit avec chapitre payant", is_free=True)
    c1 = E.add_chapter(m1, teacher, title="Bienvenue", is_free=True)
    c2 = E.add_chapter(m2, teacher, title="Apercu gratuit dans module payant", is_free=True)
    c3 = E.add_chapter(m2, teacher, title="ORM avance", is_free=False, price_minor=5000, currency="XAF")
    c4 = E.add_chapter(m2, teacher, title="Deploiement", is_free=False, price_minor=5000, currency="XAF")
    c5 = E.add_chapter(m3, teacher, title="Chapitre payant isole", is_free=False, price_minor=3000, currency="XAF")
    for ch in (c1, c2, c3, c4, c5):
        E.add_block(ch, teacher, kind="text", body=f"Contenu de {ch.title}")
    if publish:
        E.publish_course(course, teacher)
    return SimpleNamespace(teacher=teacher, classroom=classroom, course=course, m1=m1, m2=m2, m3=m3, c1=c1, c2=c2, c3=c3, c4=c4, c5=c5)
