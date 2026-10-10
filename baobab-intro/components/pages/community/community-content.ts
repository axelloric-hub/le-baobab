/**
 * Page « Communauté » — tous les textes (maquette Stitch, réécrite selon la règle éditoriale :
 * uniquement ce que le backend fait réellement, aucun chiffre d'usage inventé).
 *
 * Sources : GUIDE_BACKEND.txt, domaines COMMUNITY (groupes, rôles, channels), MESSAGING
 * (messages privés et de groupe, fils, temps réel), SOCIAL (publications de code, sondages,
 * statuts 24 h) et FRIENDS (abonnés, amis, amis proches, blocages) ; visibilités :
 * apps/core/choices.py (Visibility).
 */

export const COMMUNITY_META = {
  title: "Communauté — LE BAOBAB",
  description:
    "Groupes, canaux, messagerie en temps réel et publications de code : l'espace d'entraide des développeurs africains, sur le continent et dans la diaspora.",
};

export const COMMUNITY_HERO = {
  badge: "Communauté",
  title: "La communauté qui fait grandir vos idées",
  subtitle: "Le code nous rassemble. Le partage nous fait progresser.",
  lead:
    "Échangez avec des développeurs de tout le continent et de la diaspora. Posez vos questions d'architecture, partagez vos avancées techniques et collaborez sur des solutions concrètes, dans un cadre pensé pour l'entraide.",
  cta: "Rejoindre LE BAOBAB",
};

/** Publication d'exemple du héros (aperçu illustratif : personnes et contenus fictifs). */
export const COMMUNITY_FEED_POST = {
  initials: "MB",
  author: "Moussa · Dakar",
  when: "il y a 2 h",
  tag: "#fastapi",
  text: "Astuce : comment structurer vos webhooks de notification pour résister aux coupures intermittentes ? Voici le schéma qu'on utilise, avec réessais exponentiels et file de rejet (dead-letter queue) :",
  filename: "webhook_handler.py",
  language: "Python 3.12",
  code: `@app.post("/webhooks/telecom")
async def handle_payment(payload: WebhookPayload):
    await idempotency_service.lock(payload.event_id)
    return {"status": "queued", "retry_policy": "backoff_jitter"}`,
  actions: ["J'aime", "Commenter", "Partager"],
  reply: {
    initials: "SD",
    author: "Saliou",
    before: "Très propre ! L'idempotence sur ",
    code: "event_id",
    after: " évite les doubles débits.",
  },
};

export type CommunityToolIcon = "groups" | "forum" | "terminal" | "shield";

export const COMMUNITY_TOOLS = {
  eyebrow: "Outils & échanges",
  title: "Conçu pour la collaboration quotidienne",
  lead: "Des briques d'interaction pensées pour structurer vos conversations d'ingénieurs, sans distraction.",
  items: [
    {
      icon: "groups" as CommunityToolIcon,
      title: "Trouvez votre groupe",
      text: "Rejoignez des groupes par langage, framework ou domaine — Backend, Mobile, DevOps, Sécurité, UI/UX — chacun avec ses canaux, ses rôles et ses règles.",
    },
    {
      icon: "forum" as CommunityToolIcon,
      title: "Des conversations qui vont plus loin",
      text: "Messages privés ou conversations de groupe en temps réel, avec fils de discussion, réactions et mentions pour débloquer un problème technique sans attendre.",
    },
    {
      icon: "terminal" as CommunityToolIcon,
      title: "Partagez ce que vous construisez",
      text: "Publiez vos extraits de code, vos projets, vos sondages d'architecture et des statuts éphémères de 24 h pour montrer vos progrès au quotidien.",
    },
    {
      icon: "shield" as CommunityToolIcon,
      title: "Votre espace, vos règles",
      text: "Choisissez qui voit chaque publication : tout le monde, vos abonnés, vos amis, vos amis proches, les membres d'un groupe ou vous seul.",
    },
  ],
};

export const COMMUNITY_HELP = {
  eyebrow: "Entraide entre pairs",
  title: "Des réponses concrètes à vos défis du quotidien",
  text: "Les problématiques locales — paiements mobiles, latence réseau, intégrations régionales — méritent des retours d'expérience vécus sur le terrain. Profitez des conseils de développeurs qui ont déjà franchi les obstacles que vous rencontrez.",
  points: [
    "Des questions posées avec leur contexte technique",
    "Des retours de code bienveillants et constructifs",
    "Des échanges directs, de développeur à développeur",
  ],
  /** Fil de discussion d'exemple (aperçu illustratif : personnes et contenus fictifs). */
  thread: {
    label: "Canal",
    channel: "Groupe Backend · #django",
    status: "Fil de discussion",
    question: {
      initials: "AD",
      author: "Awa · Dakar",
      time: "14:22",
      text: "Comment éviter de débiter deux fois un client si le webhook Mobile Money arrive en double après un timeout réseau ?",
    },
    answer: {
      initials: "KL",
      author: "Koffi · Lomé",
      time: "14:27",
      badge: "Réponse dans le fil",
      text: "Rends le traitement idempotent : enregistre l'identifiant de l'événement et ignore tout doublon avant d'écrire en base.",
      code: `if cache.get(f"tx:{payload.id}"):
    return HttpResponse(status=200)
cache.set(f"tx:{payload.id}", True, timeout=86400)`,
    },
  },
};

export type VisibilityIcon = "globe" | "userCheck" | "users" | "userStar" | "group" | "list" | "lock";

export const COMMUNITY_PRIVACY = {
  eyebrow: "Confidentialité",
  title: "Vous gardez la main sur ce que vous partagez",
  text: "Chaque publication a sa propre visibilité. Ouvrez-la à tous pour un projet open source, ou réservez-la à un groupe pour un prototype confidentiel. Les blocages passent avant tout : une personne bloquée ne voit plus vos contenus.",
  mockTitle: "Choisir la visibilité de la publication",
  /** Les 7 visibilités réelles du backend (apps/core/choices.py). */
  options: [
    { value: "public", icon: "globe" as VisibilityIcon, label: "Public" },
    { value: "followers", icon: "userCheck" as VisibilityIcon, label: "Mes abonnés" },
    { value: "friends", icon: "users" as VisibilityIcon, label: "Mes amis" },
    { value: "close_friends", icon: "userStar" as VisibilityIcon, label: "Amis proches" },
    { value: "group_members", icon: "group" as VisibilityIcon, label: "Membres du groupe Backend" },
    { value: "custom", icon: "list" as VisibilityIcon, label: "Audience personnalisée" },
    { value: "private", icon: "lock" as VisibilityIcon, label: "Moi uniquement" },
  ],
  defaultOption: "group_members",
  applyLabel: "Publier",
  badges: ["Blocages prioritaires", "Visibilité par publication", "Droit à l'effacement"],
};

export const COMMUNITY_CTA = {
  title: "Un problème à résoudre ? Une idée à partager ? Prenez votre place dans le réseau.",
  text: "Créez votre profil et rejoignez les développeurs qui bâtissent l'avenir numérique du continent.",
  primary: "Rejoindre LE BAOBAB",
};

export const ILLUSTRATIVE = "Aperçu illustratif";
