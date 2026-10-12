# Authentification — inscription, connexion, GitHub, membres qui reviennent

## 1. Ce qui existe

| Adresse | Écran | Endpoints appelés |
|---|---|---|
| `/inscription` | créer un compte (+ « Continuer avec GitHub ») | `POST /auth/register/` |
| `/confirmation-email` | code à 6 chiffres reçu par e-mail | `POST /auth/verify-email/`, `POST /auth/resend-otp/` |
| `/connexion` | se connecter (+ « Continuer avec GitHub ») | `POST /auth/login/`, `POST /auth/resend-otp/` (compte non confirmé) |
| `/mot-de-passe-oublie` | 2 étapes : e-mail, puis code + nouveau mot de passe | `POST /auth/password/forgot/`, `POST /auth/password/reset/` |
| `/connexion/github` | retour de GitHub (automatique) | `POST /auth/github/exchange/` |
| `/accueil` | fil d'actualité (arrivée après connexion), protégé — voir [ESPACE_MEMBRE.md](ESPACE_MEMBRE.md). L'ancienne adresse `/espace` y redirige. | `POST /auth/token/refresh/` si besoin |

Après une connexion réussie (mot de passe, code e-mail ou GitHub), on arrive sur `/accueil`. Sans session valide, l'espace membre renvoie vers `/connexion`.

Design : maquettes Stitch (version téléphone) ; sur ordinateur, panneau de marque brun à gauche et formulaire à droite. Retirés des maquettes car faux : « TLS 1.3 · Baobab Core v4.2 », « Environnement chiffré & open standard », « valide 15 min » (c'est 10), « validation asynchrone sans pistage », l'adresse d'expédition inventée, le « relais communautaire ».

## 2. Architecture

```text
lib/
  routes.ts                adresses des pages (une seule source)
  api/config.ts            NEXT_PUBLIC_API_BASE_URL
  api/client.ts            fetch JSON, délai max 60 s, erreurs → ApiError
  api/errors.ts            messages français par code d'erreur du backend
  auth/auth-service.ts     UNE fonction par endpoint (la « couche service »)
  auth/session.ts          jetons : accès en mémoire, rafraîchissement en localStorage,
                           rotation protégée entre onglets (Web Locks)
  auth/member-cookie.ts    cookie « baobab_membre » (membres qui reviennent)
  auth/pending.ts          e-mail en attente de confirmation (sessionStorage, jamais dans l'URL)
proxy.ts                   accueil → /connexion pour les membres connus
components/auth/           écrans, champs, bouton GitHub, MemberLink
```

Les pages n'appellent jamais `fetch` : elles passent par `authService`. Le frontend se fie au `code` d'erreur du backend (`{"error": {"code", "message", "fields"}}`) et affiche ses propres messages accentués.

**Serveur en mode test** (`OTP_DEBUG_ECHO=true` sur Render) : le backend renvoie le code dans sa réponse ; l'écran l'affiche dans un encadré « Serveur en mode test » avec un bouton « Remplir ». Cela permet de tester sans SMTP. L'encadré disparaît tout seul quand `OTP_DEBUG_ECHO=false`.

## 3. Boutons des pages de présentation

Toutes les actions réservées aux membres mènent maintenant à **`/connexion`** ; les appels à créer un compte mènent à **`/inscription`** (la page de connexion propose de toute façon « Créer un compte »).

| Vers `/inscription` | Vers `/connexion` |
|---|---|
| « Rejoindre » (en-tête), « Créer mon profil » (héros et bandeau), « Rejoindre LE BAOBAB » (Communauté, Blog), « S'inscrire à la communauté » (Blog) | cartes « Pour qui » (Rejoindre, Enseigner, Proposer, Recruter, Publier) ; onglets (Rejoindre un groupe, Découvrir les cours, Créer mon portfolio, Voir les offres) ; Explorer les cours ; boutons de la section Explorer (Découvrir la communauté, Lire le blog, Ouvrir la documentation) ; Publier (visibilité) ; Être notifié des parutions ; Enregistrer, J'aime, Répondre, Accéder au fil dédié, Publier un retour d'expérience, Voir les discussions ; Ouvrir le canal d'entraide, Groupe Bienvenue, Oui / Non, Ouvrir une discussion d'entraide ; pied de page : Learn, Showcase, Opportunités, Boutiques, Groupes, Événements |

Composant : `components/auth/MemberLink.tsx` (garde l'apparence du bouton d'origine). Le menu (Communauté, Blog, Docs) et les titres des cartes Explorer restent des liens vers les pages publiques. « Se connecter » a été ajouté à côté de « Rejoindre » (grands écrans) et dans le menu mobile.

## 4. Membres qui reviennent : pourquoi un cookie et pas l'adresse IP

Après une inscription ou une connexion, le navigateur reçoit le cookie `baobab_membre=1` (1 an, aucune donnée personnelle). À la visite suivante de l'accueil, `proxy.ts` le voit et envoie directement vers `/connexion` — qui envoie elle-même vers `/accueil` si la session est encore valide.

L'adresse IP n'est **pas** utilisée, volontairement :
- **IP partagées** : en Afrique, la plupart des opérateurs mobiles mettent des milliers d'abonnés derrière la même IP (CGNAT) ; même chose pour les cybercafés, universités, entreprises. Reconnaître une IP enverrait à la connexion de parfaits inconnus qui découvrent le site.
- **IP qui changent** : la même personne change d'IP plusieurs fois par jour (4G, Wi-Fi, box) ; elle ne serait pas reconnue.
- **Sécurité** : il faudrait une API « cette IP a-t-elle un compte ? », que n'importe qui pourrait interroger pour sonder les membres. Le backend refuse déjà ce genre de fuite (réponses identiques que le compte existe ou non).

Le cookie reconnaît le navigateur de la personne, ce qui correspond exactement à « elle a déjà un compte, elle ne découvre plus l'application ». Le lien « Découvrir LE BAOBAB » (`/?decouvrir=1`) permet à un membre de revoir la présentation pendant la session.

## 5. Variables d'environnement

### Vercel (frontend)

Settings → Environment Variables → ajouter, pour **Production** et **Preview** :

| Nom | Valeur |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://baobab-router.pages.dev/api/v1` (adresse de VOTRE routeur Cloudflare + `/api/v1`, sans `/` final) |

Puis **Deployments → ⋯ → Redeploy** : la valeur est intégrée au moment du build.

En local : copier `.env.example` en `.env.local` (même variable), puis `npm run dev`.

### Render (backend) — Environment

| Nom | Valeur | Pourquoi |
|---|---|---|
| `CORS_ALLOWED_ORIGINS` | `https://baobab-router.pages.dev,https://le-baobab-pi.vercel.app,http://localhost:3000` | autoriser le site Vercel (et le local) à appeler l'API |
| `GITHUB_CLIENT_ID` | « Client ID » de l'OAuth App GitHub | connexion GitHub |
| `GITHUB_CLIENT_SECRET` | « Client secret » de l'OAuth App | connexion GitHub |
| `GITHUB_REDIRECT_URI` | `https://baobab-router.pages.dev/api/v1/auth/github/callback/` | retour de GitHub vers le backend |
| `GITHUB_LOGIN_FRONTEND_URL` | `https://le-baobab-pi.vercel.app/connexion/github` | le backend renvoie ensuite le navigateur ici avec le billet |

Puis **Manual Deploy → Deploy latest commit** (ou redémarrer le service).

### GitHub — créer l'OAuth App

https://github.com/settings/developers → **OAuth Apps → New OAuth App** :
- *Application name* : LE BAOBAB
- *Homepage URL* : `https://le-baobab-pi.vercel.app`
- *Authorization callback URL* : `https://baobab-router.pages.dev/api/v1/auth/github/callback/` (exactement la même valeur que `GITHUB_REDIRECT_URI`)
- Créer, puis **Generate a new client secret** ; copier Client ID et secret dans Render.

Tant que GitHub n'est pas configuré, le bouton affiche « La connexion avec GitHub n'est pas encore activée sur le serveur. » — le reste fonctionne.

### Vérifier

1. Ouvrir le site Vercel → « Rejoindre » → créer un compte → le code s'affiche (mode test) → « Remplir » → « Confirmer » → fil d'actualité `/accueil`.
2. Fermer l'onglet, rouvrir l'adresse du site → on arrive directement sur `/connexion` puis `/accueil`.
3. Si « Impossible de joindre le serveur » : vérifier `NEXT_PUBLIC_API_BASE_URL` (puis redéployer) et `CORS_ALLOWED_ORIGINS` sur Render. Au premier appel, le serveur gratuit peut mettre jusqu'à une minute à se réveiller.

Avant la vraie mise en production : `OTP_DEBUG_ECHO=false` et un vrai SMTP (voir `A_NE_PAS_OUBLIER.md` à la racine du dépôt).
