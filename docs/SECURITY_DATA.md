# SECURITY_DATA

## Implemente et teste
- **Mots de passe** : Argon2. **JWT** : acces 15 min, refresh rotatif + blacklist (`simplejwt`). Identifiants **UUID** (pas d'enumeration).
- **Unicite insensible a la casse garantie par la base** (email force en minuscules + CHECK) ; pas de dependance a la validation applicative.
- **Autorisation en SQL** : la visibilite d'un post/statut est calculee par `Exists(...)` (amis, abonnes, groupe, audience, blocages dans les deux sens) ; **re-verifiee a chaque lecture de feed** meme si la timeline Redis est perimee. Matrice de visibilite testee (7 profils x 7 visibilites).
- **Serializers en liste blanche** : auteur, compteurs, statut jamais acceptes du client (anti mass-assignment). Le contenu d'un message supprime n'est jamais serialise.
- **Tokens OAuth tiers chiffres** (Fernet) en base, jamais serialises, jamais affiches dans l'admin ; cle manquante => erreur explicite.
- **Embeds externes** : liste blanche d'hotes officiels, https obligatoire, `expires_at` obligatoire (limite de conservation des CGU fournisseur).
- **Audit inalterable** : `UPDATE/DELETE` sur `audit_log`, `audit_admin_action`, `moderation_action` refuses par trigger ; secrets (`password`) exclus des diffs.
- **Anti double-action** : contraintes UNIQUE (demande d'ami, adhesion, vote, signalement ouvert...), `select_for_update`, idempotence a deux couches.
- **Rate limiting** : script Lua atomique (fenetre glissante) ; DRF throttling par defaut.
- **Origine verrouillee** : `EDGE_SHARED_SECRET` (comparaison a temps constant) fait refuser tout acces HTTP ou WebSocket qui ne vient pas du Worker ; le Worker supprime les en-tetes de confiance venant d'Internet.
- **Endpoint interne** `/internal/jobs/<nom>/` : HMAC-SHA256, fenetre 60 s anti-rejeu, liste blanche de jobs, comparaison a temps constant, jamais route depuis l'exterieur.
- **Secrets** : uniquement via variables d'environnement ; `production.py` refuse de demarrer si `SECRET_KEY` < 50 ou `INTERNAL_JOB_SECRET` < 32 caracteres. Aucun secret dans l'image Docker (valeurs factices limitees a `collectstatic`).
- **En-tetes** : HSTS, cookies Secure/HttpOnly/SameSite, `X_FRAME_OPTIONS=DENY`, nosniff.
- **Injection** : ORM parametre partout ; SQL brut uniquement avec parametres ; requetes Mongo construites sans entree utilisateur non typee.

## Securite financiere et publicitaire (implemente et teste)
- **Webhooks de paiement** : signature HMAC-SHA256 obligatoire, comparaison a temps constant, secret vide = tout refuser, deduplication par `event_id`, montant et devise recontroles ; une signature invalide est journalisee (`SecurityEvent`).
- **Grand livre / portefeuille / journaux** : ecriture seule (triggers) et equilibres verifies par la base au commit ; l'admin les affiche en lecture seule.
- **Anti-fraude publicitaire** : clic uniquement sur une impression connue du meme utilisateur (fenetre 24 h), un clic par impression, 30 clics/min/utilisateur, IP stockee sous forme d'empreinte tronquee.
- **Ciblage** : liste blanche de 12 criteres imposee par `CHECK` ; opt-out de la personnalisation ; validation humaine avant diffusion.
- **Licences et telechargements** : licence active obligatoire, 20 telechargements/min, journalises. **Avis** reserves aux acheteurs.
- **Serializers** : aucune commission, net vendeur, stock exact, enchere, budget ni regle de ciblage dans une reponse destinee au client (teste).

## Non fait / a faire avant la production
- **Pas de test d'intrusion**, pas d'analyse de dependances automatisee (ajouter `pip-audit`/Dependabot).
- **Pas de Row Level Security PostgreSQL** (l'application est la barriere). A envisager pour le futur AI Gateway.
- **Le 2FA** est un champ (`SecuritySettings`) : aucun flux n'est implemente.
- **Limitation de debit au bord** (Cloudflare WAF / Rate Limiting rules) : a configurer dans le dashboard Cloudflare.
- **Atlas ouvert sur 0.0.0.0/0** (IP de sortie de l'hebergeur gratuit non fixes) : compense par mot de passe aleatoire long et TLS ; a restreindre des qu'une IP fixe existe.
- **Aucun fournisseur de paiement n'est integre** : seule la reception de webhooks signes existe ; la creation de sessions de paiement chez Orange/MTN/carte reste a ecrire.
- **Verification d'e-mail, reinitialisation de mot de passe, OAuth login** : couche API non realisee.
- **Chiffrement** : seules les colonnes OAuth sont chiffrees au niveau applicatif ; le reste repose sur le chiffrement au repos du fournisseur.
- **Ciblage publicitaire** : aucune donnee sensible n'est prevue ; a re-evaluer a l'implementation du domaine advertising.
