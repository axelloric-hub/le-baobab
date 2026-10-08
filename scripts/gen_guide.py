import ast, os, re, sys, textwrap
from pathlib import Path
sys.path.insert(0, ".")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.testing")
import django; django.setup()
ROOT = Path(".")
out = []
W = out.append
def H(t, c="="): W(""); W(c * 78); W(t); W(c * 78)
def para(t, indent=0):
    for line in textwrap.wrap(t, 76 - indent): W(" " * indent + line)

DESC = {
 "core": "Briques communes : identifiants UUID, outbox (evenements fiables), idempotence, Redis (verrous, limites de debit, compteurs), acces MongoDB, planificateur interne, jobs signes.",
 "accounts": "Comptes : inscription, confirmation par OTP e-mail (SMTP), connexion JWT, mot de passe oublie, suspension, anonymisation (droit a l'effacement), appareils, historique de connexion.",
 "storage": "Fichiers : le contenu ne passe JAMAIS par l'API (URL signees vers un bucket S3-compatible) ; registre des fichiers, proprietaire, quotas, verification a la fin d'envoi.",
 "profiles": "Profil public, competences, interets, metiers, pays, parametres de confidentialite et preferences.",
 "friends": "Graphe social : demandes d'amis, abonnements, amis proches, blocages, sourdines.",
 "community": "Communautes, groupes (roles et permissions par groupe, invitations, demandes, bannissements), channels.",
 "messaging": "Conversations directes et de groupe, messages numerotes sans trou, lecture/non-lus, reactions, fils de discussion, WebSocket.",
 "social": "Publications (texte, code, sondage...), commentaires, reactions, partages, statuts ephemeres, feed hybride.",
 "notifications": "Notifications in-app/WebSocket/e-mail/push, preferences, compteur de non-lus.",
 "audit": "Journal d'audit inalterable, actions d'administration, evenements de securite et systeme.",
 "moderation": "Signalements, dossiers, actions (masquer, retirer, suspendre, bannir), strikes, restrictions.",
 "integrations": "Comptes et contenus externes (GitHub, GitLab, TikTok, YouTube, LinkedIn) : jetons chiffres, embeds officiels uniquement.",
 "analytics": "Catalogue d'evenements, collecte vers MongoDB, agregats quotidiens, pipelines d'agregation.",
 "education": "Classrooms, cours, modules, chapitres (gratuits ou payants a chaque niveau), blocs de contenu, inscriptions, droits d'acces.",
 "assessments": "Quiz a correction automatique, devoirs (individuels ou en groupe), grille de notation, notes.",
 "progress": "Progression par chapitre, achevement de cours, certificats verifiables publiquement.",
 "marketplace": "Boutiques, produits et variantes, versions d'applications, panier, commandes, coupons, licences, telechargements, avis.",
 "payments": "Paiements, grand livre equilibre, remboursements, reception de webhooks signes.",
 "companies": "Entreprises, membres et roles, verification, liens, projets, services.",
 "portfolio": "Portfolio d'un developpeur : projets, depots, experiences, formations, realisations, certificats.",
 "jobs": "Offres d'emploi, candidatures (machine a etats), entretiens, offres d'embauche, freelance (propositions, contrats, jalons).",
 "advertising": "Annonceurs, portefeuille prepaye, campagnes, ciblage (liste blanche), diffusion, evenements, reglement des depenses.",
}
ORDER = ["core","accounts","storage","profiles","friends","community","messaging","social","notifications","audit","moderation","integrations","analytics","education","assessments","progress","marketplace","payments","companies","portfolio","jobs","advertising"]
MODULES = {
 "core": ["outbox","idempotency","redis","scheduler","internal","registries"],
 "accounts": ["services","otp"], "storage": ["services"], "profiles": ["services"], "friends": ["services","selectors"], "community": ["services","selectors"],
 "messaging": ["services","selectors"], "social": ["services","selectors","feed"], "notifications": ["services"], "audit": ["services"],
 "moderation": ["services","registry"], "integrations": [], "analytics": ["events","pipelines"],
 "education": ["services","access"], "assessments": ["services"], "progress": ["services"],
 "marketplace": ["services","money"], "payments": ["services"], "companies": ["services"], "portfolio": ["services","selectors"],
 "jobs": ["services"], "advertising": ["services","delivery","targeting"],
}

def funcs(path):
    tree = ast.parse(path.read_text())
    res = []
    for n in tree.body:
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and not n.name.startswith("_"):
            args = ast.unparse(n.args)
            doc = (ast.get_docstring(n) or "").strip().split("\n")[0]
            res.append((n.name, args, doc))
    return res

# ---------------------------------------------------------------- en-tete
W("LE BAOBAB - GUIDE DU BACKEND (genere a partir du code)")
W("=" * 78)
para("Ce fichier decrit TOUT ce qui a ete construit cote serveur et comment s'en servir. "
     "Les listes de fonctions, d'evenements, de commandes et de jobs sont lues automatiquement dans le code : elles ne peuvent pas diverger de la realite.")

import config.urls  # noqa: E402,F401  (charge toutes les routes)
from apps.core.api import ROUTES  # noqa: E402

H("0. A LIRE EN PREMIER : CE QUI EXISTE")
para(f"Le backend expose une API REST versionnee ({len(ROUTES)} endpoints sous /api/v1/) et deux WebSocket. Chaque endpoint est une fonction decoree @endpoint (fichier apps/<app>/api.py) : "
     "elle valide l'entree, applique l'authentification, appelle UN service (la logique metier, decrite plus bas, testee), puis formate la sortie. "
     "La liste detaillee et exacte de tous les endpoints (corps, parametres, droits) est dans ENDPOINTS_POUR_DEV_BACKEND.txt ; les scenarios de test dans INSOMNIA_TESTS.md ; "
     "ce qui reste a faire dans RESTE_A_FAIRE.md ; ce qu'il ne faut pas oublier avant la production dans A_NE_PAS_OUBLIER.md.")
W("")
W("Endpoints par domaine :")
from collections import Counter  # noqa: E402
_c = Counter(r["handler"].split(".")[1] for r in ROUTES)
for app in ORDER:
    if _c.get(app):
        W(f"  {app:14s} {_c[app]:3d} endpoints")
W("")
W("Hors /api/v1 :")
W("  GET  /health/                    sonde de vie (Render l'appelle).")
W("  GET  /ready/                     verifie PostgreSQL + MongoDB + Redis. Ne revele aucun interrupteur de test.")
W("  POST /internal/jobs/<nom>/       declenche un job planifie (signature HMAC) ; invisible depuis l'exterieur.")
W("  /admin/                          interface d'administration Django.")
W("  WS   /ws/conversations/<id>/ et /ws/notifications/   (JWT dans ?token=) : protocole dans ENDPOINTS_POUR_DEV_BACKEND.txt.")
W("")
W("Regles transverses de l'API (a connaitre avant de modifier quoi que ce soit) :")
W("  - Les fichiers ne passent JAMAIS par l'API : URL signee d'envoi -> le client envoie au bucket -> confirmation verifiee cote serveur.")
W("  - Isolation des comptes : un identifiant d'une autre personne renvoie 404 (jamais son contenu) ; les fichiers ne sont references que par leur identifiant et leur proprietaire.")
W("  - Format d'erreur unique {error:{code,message,fields}} ; le frontend se base sur error.code.")
W("  - AUCUN fournisseur de paiement n'est branche ; l'OTP peut etre affiche a l'ecran EN PHASE DE TEST uniquement (voir A_NE_PAS_OUBLIER.md).")

H("1. ARCHITECTURE EN BREF")
for t in [
 "PostgreSQL (Supabase) = source de verite de tout ce qui compte (comptes, argent, droits, contenus). Les regles les plus importantes sont dans la base elle-meme (contraintes, triggers) : elles tiennent meme si le code applicatif se trompe.",
 "MongoDB (Atlas) = 4 collections seulement : cartes de publications pour le feed (post_cards), evenements analytiques (events), journal de requetes (api_request_logs), evenements publicitaires (ad_events). Tout est reconstructible ou a duree de vie limitee.",
 "Redis (Upstash) = accelerateur, jamais verite : verrous, limites de debit, plafonds de frequence publicitaire, compteurs de vues, timelines. Chaque cle a une duree de vie.",
 "Evenements (outbox) : quand une action reussit, elle ecrit un evenement DANS LA MEME transaction. Un relais le transmet ensuite (notifications, droits d'acces apres achat, analytique, cartes du feed). Si un maillon est en panne, l'evenement est rejoue.",
 "Les domaines ne s'importent pas entre eux : ils communiquent par evenements et par registres (ex. un achat accorde un droit d'acces a un cours sans que le commerce connaisse l'education).",
]: para(t, 2); W("")

H("2. COMMENT UTILISER LES SERVICES")
para("Un service est une fonction Python. Elle verifie les droits, applique les regles, ecrit en base dans une transaction et publie les evenements. "
     "Elle leve une erreur claire quand une regle est violee (DomainError et ses sous-classes, avec un champ .code utilisable par l'API).")
W("")
W("Erreurs (converties automatiquement en reponses HTTP : voir apps.core.exceptions.api_exception_handler) :")
W("  DomainError (422)  regle metier violee         PermissionDeniedError (403)  droit insuffisant")
W("  ConflictError (409) doublon / etat incompatible RateLimitedError (429)       trop de requetes")
W("  IdempotencyConflictError (409)  meme cle d'idempotence avec un contenu different")
W("  InvalidCredentialsError (401)   PaymentRequiredError (402, contenu payant)")
W("")
W("Exemple dans la console Django (python manage.py shell) : appeler un service directement.")
W("  from apps.marketplace import services as M")
W("  M.add_to_cart(utilisateur, variante_id, 2) ; commande = M.checkout(utilisateur, idempotency_key='cle-unique')")
W("")
W("Ajouter un endpoint (3 etapes) : 1. ecrire la fonction dans apps/<app>/api.py avec @endpoint('resume', auth=..., body={...}) ;")
W("  2. l'enregistrer dans apps/<app>/urls.py avec route('chemin/', GET=..., POST=...) ; 3. python scripts/gen_api_docs.py (la doc et la collection Insomnia se mettent a jour).")
W("  Ne mettez jamais de logique metier dans l'endpoint : elle est dans le service. Un meme objet de champ ne doit pas servir deux fois dans un corps (garde au demarrage).")

# ---------------------------------------------------------------- domaines
H("3. LES DOMAINES, UN PAR UN (fonctions publiques lues dans le code)")
tot = 0
for app in ORDER:
    W(""); W("-" * 78); W(f"{app.upper()}"); W("-" * 78)
    para(DESC[app])
    models = ast.parse((ROOT / f"apps/{app}/models.py").read_text())
    names = [n.name for n in models.body if isinstance(n, ast.ClassDef) and any("Model" in ast.unparse(b) for b in n.bases)]  # uniquement les vraies tables (pas les enumerations)
    W(f"Modeles ({len(names)}) : " + ", ".join(names))
    for mod in MODULES[app]:
        p = ROOT / f"apps/{app}/{mod}.py"
        if not p.exists(): continue
        fs = funcs(p)
        if not fs: continue
        W(""); W(f"  [{app}/{mod}.py]")
        for name, args, doc in fs:
            tot += 1
            W(f"    {name}({args})")
            if doc:
                for line in textwrap.wrap(doc, 70): W("        " + line)
W(""); W(f"Total : {tot} fonctions publiques de services/selecteurs/moteurs.")

# ---------------------------------------------------------------- evenements
H("4. EVENEMENTS (qui les publie, qui les ecoute)")
pub, sub = {}, {}
for p in (ROOT / "apps").rglob("*.py"):
    if "tests" in p.parts or "migrations" in p.parts: continue
    t = p.read_text()
    for m in re.finditer(r'publish_event\(\s*"([A-Za-z]+)"', t): pub.setdefault(m.group(1), set()).add(str(p.relative_to(ROOT)).replace("apps/", "").split("/")[0])
    for m in re.finditer(r'@subscribe\("([A-Za-z]+)"\)', t): sub.setdefault(m.group(1), set()).add(str(p.relative_to(ROOT)).replace("apps/", "").split("/")[0])
for ev in sorted(pub):
    W(f"  {ev:32s} publie par: {', '.join(sorted(pub[ev])):14s} ecoute par: {', '.join(sorted(sub.get(ev, []))) or '(personne pour l instant)'}")
W("")
W("NB : le domaine 'analytics' ecoute AUSSI (enregistrement dynamique, non detecte ci-dessus) : UserRegistered, PostCreated, PostLiked, MessageSent,")
W("     FriendshipCreated, CourseEnrolled, ChapterCompleted, OrderPaid, JobApplied -> ils alimentent la collection MongoDB 'events'.")
W("     Le domaine 'progress' ecoute QuizPassed (emission du certificat). Le domaine 'education' ecoute OrderPaid/OrderRefunded (acces aux cours).")
W("Le relais des evenements tourne tout seul toutes les 3 secondes tant que le service est eveille (planificateur interne).")

# ---------------------------------------------------------------- commandes
H("5. COMMANDES DE GESTION (python manage.py <commande>)")
for p in sorted((ROOT / "apps/core/management/commands").glob("*.py")):
    if p.name.startswith("_"): continue
    m = re.search(r'help\s*=\s*"([^"]+)"', p.read_text())
    W(f"  {p.stem:28s} {m.group(1) if m else ''}")
W(""); W("  migrate                      cree/met a jour les tables, fonctions, triggers, vues et donnees de reference.")
W("  test                         lance toute la suite de tests (PostgreSQL et Redis reels requis).")

# ---------------------------------------------------------------- jobs
H("6. JOBS PLANIFIES (planificateur interne, uniquement pendant que le service est eveille)")
from apps.core.scheduler import default_jobs
for j in default_jobs():
    W(f"  {j.name:20s} toutes les {j.every:>5d} s   {'un seul worker a la fois' if j.singleton else 'sans barriere (verrou SQL SKIP LOCKED)'}")
W("")
W("Ils sont aussi declenchables de l'exterieur par POST /internal/jobs/<nom>/ (signature HMAC) : relay-outbox, flush-counters, refresh-metrics, refresh-trending, housekeeping.")

# ---------------------------------------------------------------- SQL
H("7. FONCTIONS ET TRIGGERS POSTGRESQL (database/postgres/)")
for p in sorted((ROOT / "database/postgres/functions").glob("*.sql")):
    W(f"  [{p.name}]")
    t = p.read_text().split("\n")
    for i, line in enumerate(t):
        m = re.match(r"CREATE OR REPLACE FUNCTION (\w+)\(", line)
        if m:
            c = ""
            j = i - 1
            while j >= 0 and t[j].startswith("--"): c = t[j][3:].strip(); j -= 1
            W(f"    {m.group(1):36s} {c[:90]}")
W("")
W("Triggers DIFFERES (verifies au moment de valider la transaction : une transaction incoherente est refusee) :")
W("  trg_ledger_balanced          chaque lot du grand livre somme a zero")
W("  trg_adwallet_check_*         solde du portefeuille publicitaire == somme de son journal")
W("  trg_company_requires_owner_* une entreprise a toujours un proprietaire")

# ---------------------------------------------------------------- env
H("8. VARIABLES D'ENVIRONNEMENT")
W((ROOT / ".env.example").read_text().rstrip())

H("9. REGLES ET PIEGES A CONNAITRE")
for t in [
 "ARGENT : toujours des entiers dans la plus petite unite (XAF : 1, EUR : centimes). Jamais de decimaux.",
 "COMMANDE : le prix est COPIE dans la commande. Changer un prix ensuite ne change pas l'historique. Une cle d'idempotence est OBLIGATOIRE au checkout (une cle = une commande, meme si le client clique deux fois).",
 "PAIEMENT : un seul paiement reussi par commande. Le resultat arrive par webhook signe (payments.services.ingest_webhook). Sans secret configure pour un fournisseur, ses webhooks sont tous refuses. AUCUN fournisseur n'est branche : creer la session de paiement chez Orange/MTN/carte reste a ecrire.",
 "ACCES AUX COURS : Chapter.is_free decide si un chapitre est payant. Un droit (Entitlement) sur le chapitre, le module, le cours ou la classroom le debloque. Le droit est accorde AUTOMATIQUEMENT apres un achat (evenement OrderPaid) et retire apres un remboursement complet.",
 "VERROUS : les services qui verrouillent des lignes le font dans un ordre fixe. Ne les appelez pas depuis une transaction qui a deja verrouille d'autres lignes dans un ordre different.",
 "SUPPRESSION : les contenus ont une suppression 'douce' (deleted_at). Les donnees financieres, les journaux et l'audit ne se suppriment jamais (la base l'interdit).",
 "CONFIDENTIALITE : la visibilite d'un post/portfolio/statut est calculee en SQL (amis, abonnes, groupe, blocages). Passez toujours par les selecteurs (social.selectors.visible_posts, portfolio.selectors.can_view_portfolio), jamais par un filtre ecrit a la main.",
 "PUBLICITE : le ciblage est limite a 12 criteres autorises (la base refuse tout autre). Une annonce ne diffuse qu'apres validation humaine. L'utilisateur peut refuser la personnalisation (advertising.services.set_personalization).",
 "WEBSOCKET : un seul worker et une seule instance (offre gratuite) : le temps reel ne passe pas entre plusieurs instances. A la mise en veille, les clients doivent se reconnecter.",
 "SERIALIZERS : ceux de lecture ne montrent jamais les commissions, le net vendeur, le stock exact, les encheres, les budgets, les bonnes reponses des quiz. Utilisez-les pour toute reponse destinee a un client.",
]: para("- " + t, 2); W("")

H("10. CE QUI MANQUE (honnete) : details dans RESTE_A_FAIRE.md")
for t in [
 "Fournisseur de paiement reel (creation de sessions, remboursement chez le fournisseur, versements aux vendeurs).",
 "GitHub, GitLab, TikTok, YouTube, LinkedIn (OAuth, synchronisation, embeds) ; AI Gateway.",
 "E-mails de notification et reçus (seul l'OTP envoie reellement un e-mail) ; notifications push.",
 "Antivirus et empreinte calculee cote serveur pour les fichiers ; certificats PDF ; video en streaming.",
 "Schema OpenAPI complet, metriques, tests de charge, double authentification.",
 "Les interrupteurs de TEST (OTP a l'ecran, simulation de paiement, faux bucket) doivent etre coupes avant la production : A_NE_PAS_OUBLIER.md.",
]: para("- " + t, 2)
W("")
W("Fin du guide.")
Path(sys.argv[1] if len(sys.argv) > 1 else "docs").joinpath("GUIDE_BACKEND.txt").write_text("\n".join(out) + "\n", encoding="utf-8")
print(len(out), "lignes,", tot, "fonctions listees,", len(pub), "evenements")
