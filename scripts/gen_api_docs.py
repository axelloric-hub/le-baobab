"""Genere, depuis le registre ROUTES (donc sans divergence possible avec le code) : ENDPOINTS_POUR_DEV_BACKEND.txt et insomnia_collection.json."""
import json
import os
import re
import sys
import textwrap
from pathlib import Path

sys.path.insert(0, ".")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.testing")
import django  # noqa: E402

django.setup()
from rest_framework import serializers as S  # noqa: E402

import config.urls  # noqa: E402,F401
from apps.core.api import ROUTES  # noqa: E402

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "docs")
OUT.mkdir(exist_ok=True)
TITLES = {"accounts": "Authentification", "storage": "Fichiers (URL signees)", "profiles": "Profil et recherche", "friends": "Amis, abonnements, blocages", "community": "Groupes et communautes",
          "messaging": "Messagerie", "social": "Publications, feed, statuts", "notifications": "Notifications", "moderation": "Signalements et moderation", "education": "Education (classrooms, cours)",
          "assessments": "Quiz et devoirs", "progress": "Progression et certificats", "marketplace": "Marketplace", "payments": "Paiements et remboursements", "companies": "Entreprises",
          "portfolio": "Portfolio", "jobs": "Emplois et freelance", "advertising": "Publicite", "analytics": "Administration : indicateurs", "integrations": "Integrations externes", "core": "Administration : systeme"}
ORDER = list(TITLES)
TYPES = {S.EmailField: "e-mail", S.UUIDField: "uuid", S.IntegerField: "entier", S.BooleanField: "booleen", S.DateTimeField: "date-heure ISO 8601", S.DateField: "date AAAA-MM-JJ", S.URLField: "url (https)",
         S.DecimalField: "decimal", S.FloatField: "nombre", S.SlugField: "slug", S.DictField: "objet JSON", S.RegexField: "texte (format impose)", S.CharField: "texte"}


def app_of(r):
    return r["handler"].split(".")[1]


def describe(f) -> str:
    if isinstance(f, S.Serializer):
        inner = ", ".join(f"{k}{'' if v.required and v.default is S.empty else '?'}: {describe(v)}" for k, v in f.fields.items())
        return "objet {" + inner + "}"
    if isinstance(f, S.ListField):
        d = f"liste de {describe(f.child)}"
        bounds = [f"min {f.min_length}" if getattr(f, "min_length", None) else "", f"max {f.max_length}" if getattr(f, "max_length", None) else ""]
        return d + (f" ({', '.join(b for b in bounds if b)})" if any(bounds) else "")
    if isinstance(f, S.ChoiceField):
        return "choix : " + " | ".join(map(str, list(f.choices)[:12]))
    t = next((v for k, v in TYPES.items() if type(f) is k), None) or next((v for k, v in TYPES.items() if isinstance(f, k)), "texte")
    extra = []
    if getattr(f, "max_length", None):
        extra.append(f"max {f.max_length} car.")
    if getattr(f, "min_value", None) is not None:
        extra.append(f"min {f.min_value}")
    if getattr(f, "max_value", None) is not None:
        extra.append(f"max {f.max_value}")
    if getattr(f, "allow_null", False):
        extra.append("null autorise")
    return t + (f" ({', '.join(extra)})" if extra else "")


def required(f) -> bool:
    return bool(f.required) and f.default is S.empty


def params_of(path: str) -> list[str]:
    return re.findall(r"<[a-z]+:(\w+)>", path)


def example(name: str, f):
    if isinstance(f, S.Serializer):
        return {k: example(k, v) for k, v in f.fields.items() if required(v)}
    if isinstance(f, S.ListField):
        return [example(name, f.child)]
    if isinstance(f, S.ChoiceField):
        return next(iter(f.choices))
    n = name.lower()
    if isinstance(f, S.EmailField):
        return "ada@example.com"
    if isinstance(f, S.UUIDField):
        return "{{ _." + (n if n.endswith("_id") else n + "_id") + " }}"
    if "password" in n:
        return "Un-mot-de-passe-solide-2026!"
    if n == "code":
        return "123456"
    if n == "username":
        return "ada"
    if n == "refresh":
        return "{{ _.refresh }}"
    if isinstance(f, S.URLField):
        return "https://example.com"
    if isinstance(f, S.BooleanField):
        return True
    if isinstance(f, (S.IntegerField, S.DecimalField, S.FloatField)):
        return max(getattr(f, "min_value", None) or 1, 1)
    if isinstance(f, S.DateTimeField):
        return "2026-12-01T10:00:00Z"
    if isinstance(f, S.DateField):
        return "2026-01-15"
    if isinstance(f, S.DictField):
        return {}
    if isinstance(f, S.SlugField) or "slug" in n:
        return "mon-exemple"
    if "currency" in n:
        return "XAF"
    if n.startswith("country"):
        return "CM"
    return "exemple"


groups = {a: [r for r in ROUTES if app_of(r) == a] for a in ORDER}
total = len(ROUTES)

# ------------------------------------------------------------------ ENDPOINTS_POUR_DEV_BACKEND.txt
L = []
W = L.append
W("LE BAOBAB - API REST v1 : REFERENCE POUR LE DEVELOPPEUR BACKEND")
W("=" * 78)
W(f"{total} endpoints. Genere automatiquement a partir du code (scripts/gen_api_docs.py) : cette liste ne peut pas diverger de la realite.")
W("")
W("1. CONVENTIONS")
W("-" * 78)
W(textwrap.dedent("""\
    URL de base      : l'adresse du ROUTEUR Cloudflare (ex. https://baobab-router.pages.dev), JAMAIS l'adresse onrender.com (elle refuse tout acces direct).
                       Toutes les routes de l'API commencent par /api/v1/ . WebSocket : wss://<routeur>/ws/...
    Format           : JSON (Content-Type: application/json). Dates en ISO 8601 UTC. Montants d'argent : ENTIERS dans la plus petite unite (XAF : 1, EUR : centimes).
    Authentification : en-tete  Authorization: Bearer <access>  (JWT). Niveaux par endpoint :
                         public   = aucun jeton ; n'envoyez PAS d'en-tete Authorization (un jeton invalide donne 401 meme ici)
                         optional = jeton facultatif (le resultat depend de qui regarde : confidentialite, acces payant)
                         user     = jeton obligatoire
                         staff    = jeton d'un administrateur (sinon 403)
    Jetons           : access (duree configurable, 15 min en production) + refresh (14 jours, usage unique : rotation).
                       Sur 401, appeler POST /auth/token/refresh/ puis rejouer la requete ; si le refresh echoue, renvoyer vers la connexion.
    Format d'erreur  : TOUJOURS  {"error": {"code": "<code_machine>", "message": "<texte>", "fields": {...}}}   ("fields" seulement pour validation_error)
    Codes HTTP       : 200/201 succes ; 202 accepte (comptage) ; 204 sans contenu ; 400 validation_error (champs invalides) ; 401 not_authenticated / invalid_credentials ;
                       402 contenu PAYANT non debloque (le code precise payment_required ou classroom_payment_required) ; 403 forbidden (droit insuffisant, code explicite) ;
                       404 not_found : la ressource n'existe pas OU vous n'avez pas le droit de la voir (volontairement indiscernable) ;
                       409 conflit (doublon, etat incompatible) ; 422 regle metier violee (code explicite) ; 429 rate_limited ; 503 indisponible.
                       Le frontend doit se baser sur error.code (stable), jamais sur error.message (affichage).
    Pagination       : listes paginees par curseur : ?limit=<1..100>&cursor=<valeur de "next"> ; reponse {"next": url|null, "previous": url|null, "results": [...]}.
                       Pour suivre : appeler l'URL "next" telle quelle jusqu'a ce qu'elle soit null.
    Idempotence      : POST /checkout/ (idempotency_key OBLIGATOIRE) et POST /conversations/{id}/messages/ (client_msg_id) : un nouvel essai apres coupure reseau
                       avec la MEME cle ne cree jamais de doublon. Generez la cle cote client (UUID) AVANT d'envoyer.
    Limites de debit : connexion (10 essais / 15 min par e-mail, 40 par IP), OTP (60 s entre deux envois, 10/h par IP, 25 e-mails/jour au total), demandes d'envoi de fichier (60/h),
                       telechargements (20/min), verification de certificat (30/min par IP). Au-dela : 429.
    Isolation        : toute ressource est filtree par proprietaire/droit. Un identifiant d'une autre personne renvoie 404, jamais son contenu.
    """))
W("")
W("2. FICHIERS : le contenu ne passe JAMAIS par l'API (3 etapes)")
W("-" * 78)
W(textwrap.dedent("""\
    a) POST /api/v1/files/uploads/  {purpose, filename, content_type, size_bytes}
         -> 201 {file_id, method:"PUT", url, headers:{Content-Type}, expires_in}
         Types et tailles autorises par usage : GET /api/v1/files/purposes/ (SVG, HTML, JS refuses).
    b) Le FRONTEND envoie directement au bucket :  PUT <url>  avec le corps = le fichier brut et l'en-tete Content-Type donne.
         Le type ET la taille sont signes : un fichier different est refuse par le bucket. (Le navigateur fixe Content-Length tout seul.)
    c) POST /api/v1/files/{file_id}/complete/  -> le serveur verifie dans le bucket (existence, taille, type). Le fichier devient utilisable.
    Puis on REFERENCE le fichier par son file_id dans les autres endpoints (avatar_file, cv_file, file, files, media[].file...). Jamais par un chemin.
    Un fichier ne peut etre reference que par son proprietaire, une fois verifie, et pour le bon usage (sinon 422 invalid_file).
    Lecture : les reponses contiennent des URL signees a duree courte (5 min) apres controle d'acces ; ne les stockez pas.
    Prerequis bucket : configurer le CORS du bucket (voir A_NE_PAS_OUBLIER.md).
    """))
W("")
W("3. TEMPS REEL (WebSocket, Django Channels)")
W("-" * 78)
W(textwrap.dedent("""\
    wss://<routeur>/ws/notifications/?token=<access>
        serveur -> client : {"type":"notification","id":"...","code":"friend_request","data":{...}}
        fermeture 4401 : non authentifie.
    wss://<routeur>/ws/conversations/<conversation_id>/?token=<access>
        client -> serveur : {"type":"heartbeat"}  (presence)   |   {"type":"typing"}
        serveur -> client : {"type":"message","message_id":"...","seq":12,"sender":"..."}   |   {"type":"typing","user":"..."}
        fermeture 4403 : pas membre de la conversation.
        Les messages sont ENVOYES par REST (POST .../messages/) ; le socket signale seulement leur arrivee : recuperer ensuite le contenu par GET .../messages/.
    Une seule instance serveur : en cas de redemarrage les sockets tombent, le client doit se reconnecter (avec delai croissant).
    """))
W("")
W("4. WEBHOOK DE PAIEMENT (appele par le fournisseur, pas par le frontend)")
W("-" * 78)
W(textwrap.dedent("""\
    POST /api/v1/payments/webhooks/<provider>/   provider : mobile_money | card | manual
    En-tete X-Signature = HMAC-SHA256 hexadecimal du CORPS BRUT avec le secret PAYMENT_WEBHOOK_SECRET_<PROVIDER>. Secret vide = tout est refuse.
    Corps : {"event_id": "...", "provider_ref": "...", "status": "succeeded|failed|cancelled", "amount_minor": 5000, "currency": "XAF"}
    Idempotent (event_id) ; montant et devise sont recontroles. Reponse {"duplicate": false|true}.
    AUCUN fournisseur n'est branche : voir RESTE_A_FAIRE.md. En phase de test : POST /payments/{id}/simulate/ (si active).
    """))
W("")
W("5. ENDPOINTS PAR DOMAINE")
W("-" * 78)
for a in ORDER:
    rs = groups[a]
    if not rs:
        continue
    W("")
    W(f"### {TITLES[a].upper()}  ({len(rs)})")
    for r in rs:
        W("")
        W(f"{r['method']:6s} /api/v1/{r['path']}   [{r['auth']}]  succes: {r['status']}")
        for line in textwrap.wrap(r["summary"], 90):
            W("       " + line)
        pp = params_of(r["path"])
        if pp:
            W("       Dans l'URL : " + ", ".join(pp))
        if r["query"]:
            W("       Parametres de requete :")
            for k, v in r["query"].items():
                W(f"         {k}  {describe(v)}  {'(requis)' if required(v) else '(facultatif)'}")
        if r["body"]:
            W("       Corps JSON :")
            for k, v in r["body"].items():
                W(f"         {k}  {describe(v)}  {'(requis)' if required(v) else '(facultatif)'}")
(OUT / "ENDPOINTS_POUR_DEV_BACKEND.txt").write_text("\n".join(L) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ insomnia_collection.json
res, placeholders, ts = [], set(), 1_790_000_000_000
WS, ENV = "wrk_baobab", "env_baobab"
res.append({"_id": WS, "_type": "workspace", "parentId": None, "name": "LE BAOBAB - API v1", "description": "Collection generee depuis le code. Lire INSOMNIA_TESTS.md.", "scope": "collection"})
fid = {}
for i, a in enumerate(ORDER):
    if groups[a]:
        fid[a] = f"fld_{a}"
        res.append({"_id": fid[a], "_type": "request_group", "parentId": WS, "name": f"{i + 1:02d} - {TITLES[a]}", "metaSortKey": ts + i})
n = 0
for a in ORDER:
    for r in groups[a]:
        n += 1
        url = "{{ _.base_url }}/api/v1/" + re.sub(r"<[a-z]+:(\w+)>", lambda m: "{{ _." + m.group(1) + " }}", r["path"])
        for p in params_of(r["path"]):
            placeholders.add(p)
        if r["query"]:
            req_q = {k: example(k, v) for k, v in r["query"].items() if required(v)}
            if req_q:
                url += "?" + "&".join(f"{k}={v}" for k, v in req_q.items())
        item = {"_id": f"req_{n:03d}", "_type": "request", "parentId": fid[a], "name": f"{r['method']} {r['path'].rstrip('/')}", "description": r["summary"], "method": r["method"], "url": url, "metaSortKey": ts + n,
                "headers": [{"name": "Content-Type", "value": "application/json"}] if r["body"] is not None or r["method"] in ("POST", "PUT", "PATCH") else [], "parameters": [], "settingSendCookies": False}
        if r["body"] is not None:
            body = {k: example(k, v) for k, v in r["body"].items() if required(v)}
            item["body"] = {"mimeType": "application/json", "text": json.dumps(body, indent=2, ensure_ascii=False)}
            for m in re.findall(r"\{\{ _\.(\w+) \}\}", item["body"]["text"]):
                placeholders.add(m)
        if r["auth"] != "public":
            item["authentication"] = {"type": "bearer", "token": "{{ _.access }}", "prefix": ""}
        res.append(item)
base = {"base_url": "https://baobab-router.pages.dev", "access": "", "refresh": ""}
for p in sorted(placeholders - {"access", "refresh", "base_url"}):
    base[p] = "A-REMPLACER"
res.append({"_id": ENV, "_type": "environment", "parentId": WS, "name": "Base Environment", "data": base, "dataPropertyOrder": None, "color": None, "isPrivate": False, "metaSortKey": ts})
for i, persona in enumerate(["Alice", "Bob", "Prof", "Admin"], start=1):
    res.append({"_id": f"env_{persona.lower()}", "_type": "environment", "parentId": ENV, "name": persona, "data": {"access": "", "refresh": ""}, "isPrivate": False, "color": ["#7d69cb", "#d79b00", "#1c8a4b", "#c0392b"][i - 1], "metaSortKey": ts + i})
(OUT / "insomnia_collection.json").write_text(json.dumps({"_type": "export", "__export_format": 4, "__export_date": "2026-10-08T00:00:00.000Z", "__export_source": "baobab.gen_api_docs", "resources": res}, indent=1, ensure_ascii=False), encoding="utf-8")
print(f"{total} endpoints, {len([r for r in res if r['_type'] == 'request'])} requetes Insomnia, {len(placeholders)} variables d'identifiants")
