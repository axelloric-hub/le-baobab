/**
 * Article modèle du blog : « Idempotence et webhooks ».
 *
 * Il sert d'exemple de mise en page (mention visible sur la page). Le contenu technique
 * est exact et relu ; l'exemple de code a été corrigé par rapport à la maquette
 * (application FastAPI déclarée, client Redis asynchrone, clé conservée 24 h après succès,
 * verrou libéré en cas d'échec).
 *
 * Mise en forme du texte (voir shared/RichText.tsx) : `code`, **gras**, _italique_.
 */
import type { BlogCategory } from "./blog-content";

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "quote"; text: string; cite: string }
  | { type: "code"; filename: string; language: string; code: string; caption: string }
  | { type: "formula"; text: string }
  | { type: "note"; title: string; text: string }
  | { type: "checklist"; items: Array<{ title: string; text: string }> };

export interface ArticleSection {
  id: string;
  title: string;
  /** Titre court pour le sommaire. */
  short: string;
  blocks: ArticleBlock[];
}

export const ARTICLE_IDEMPOTENCE = {
  slug: "idempotence-webhooks",
  category: "Développement & ingénierie" as BlogCategory,
  breadcrumb: "Idempotence et webhooks",
  title: "Idempotence et webhooks : fiabiliser les flux de transactions distribuées face aux latences réseau",
  description:
    "Clés d'idempotence, verrou distribué avec Redis et réessais avec backoff exponentiel : fiabiliser les webhooks de paiement face aux coupures réseau.",
  author: { initials: "LB", name: "La rédaction technique LE BAOBAB" },
  readingTime: "8 min de lecture",
  intro:
    "Dans les systèmes de paiement numérique — surtout face aux instabilités des réseaux télécoms et aux pics de charge des passerelles Mobile Money —, la panne réseau n'est pas une anomalie : c'est un état permanent. Lorsqu'un webhook de notification subit un timeout, la règle de résilience consiste à renvoyer la requête. Sans mécanisme d'idempotence rigoureux, ces rejeux automatiques produisent des anomalies comptables critiques.",
  sections: [
    {
      id: "principe-idempotence",
      title: "1. Le principe d'idempotence au niveau applicatif",
      short: "1. Le principe d'idempotence",
      blocks: [
        {
          type: "p",
          text: "Une opération `f(x)` est dite idempotente si l'exécuter une seconde fois produit exactement le même effet sur l'état du système que la première : `f(f(x)) = f(x)`.",
        },
        {
          type: "p",
          text: "Dans une API exposée à des tiers (Orange Money, Wave, MTN MoMo, Stripe ou Paystack, par exemple), chaque événement doit porter un identifiant unique transmis dans un en-tête HTTP : la **clé d'idempotence** (`Idempotency-Key`). Le récepteur ne peut pas se contenter de vérifier si la ressource existe déjà en base : entre la lecture et l'écriture, deux requêtes simultanées peuvent passer toutes les deux (_race condition_).",
        },
        {
          type: "quote",
          text: "Une requête webhook doit pouvoir être rejouée dix fois sans jamais produire un double débit ni corrompre le grand livre comptable.",
          cite: "Principe d'ingénierie",
        },
        {
          type: "p",
          text: "La tolérance aux pannes repose donc sur la capacité du service à poser un verrou **avant** de commencer le traitement métier du paiement.",
        },
      ],
    },
    {
      id: "verrou-distribue",
      title: "2. Implémenter un verrou distribué avec un cache",
      short: "2. Verrou distribué & cache",
      blocks: [
        {
          type: "p",
          text: "Dans une architecture à plusieurs instances, la solution courante s'appuie sur Redis (ou un équivalent compatible). La commande atomique `SET … NX EX` n'écrit la clé que si elle n'existe pas encore, avec une durée d'expiration : une seule requête obtient le verrou.",
        },
        {
          type: "p",
          text: "Voici une implémentation de référence en Python avec `FastAPI` et le client Redis asynchrone :",
        },
        {
          type: "code",
          filename: "webhook_handler.py",
          language: "Python 3.12",
          code: `# webhook_handler.py — traitement sécurisé avec clé d'idempotence
from fastapi import FastAPI, Header
from redis.asyncio import Redis

app = FastAPI()
redis = Redis(host="localhost", port=6379, db=0)

@app.post("/webhooks/transactions")
async def process_transaction(
    payload: TransactionPayload,
    idempotency_key: str = Header(...),
):
    key = f"idemp:{idempotency_key}"
    # SET NX EX : une seule requête obtient le verrou (libéré seul après 120 s)
    if not await redis.set(key, "processing", nx=True, ex=120):
        return {"status": "duplicate_ignored", "detail": "Transaction déjà traitée"}

    try:
        await ledger_service.record_entry(payload)
    except Exception:
        await redis.delete(key)  # échec : un nouvel essai reste possible
        raise

    await redis.set(key, "done", ex=86400)  # 24 h : couvre les réessais tardifs
    return {"status": "success", "transaction_id": payload.id}
`,
          caption: "Verrou distribué Redis (NX + expiration), conservé 24 h après succès et libéré en cas d'échec.",
        },
      ],
    },
    {
      id: "gestion-retries",
      title: "3. Gérer les réessais avec un backoff exponentiel",
      short: "3. Gestion des réessais",
      blocks: [
        {
          type: "p",
          text: "Renvoyer une requête échouée à intervalle fixe (toutes les 5 secondes, par exemple) est l'erreur la plus fréquente en environnement distribué. Tous les clients réessaient au même moment et saturent une passerelle déjà affaiblie par une coupure de fibre ou une indisponibilité bancaire : c'est le _thundering herd problem_.",
        },
        {
          type: "p",
          text: "La stratégie couramment recommandée combine un délai qui double à chaque tentative, plafonné, et un décalage aléatoire (_jitter_) :",
        },
        { type: "formula", text: "délai = min(plafond, base × 2^tentative) + aléa(0, jitter)" },
        {
          type: "note",
          title: "Règle d'or",
          text: "Stockez l'empreinte de la charge utile (`SHA-256(payload)`) avec la clé d'idempotence : si la même clé revient avec un contenu différent, refusez la requête au lieu de la traiter.",
        },
      ],
    },
    {
      id: "bonnes-pratiques",
      title: "4. Bonnes pratiques de mise en production",
      short: "4. Bonnes pratiques de prod",
      blocks: [
        {
          type: "checklist",
          items: [
            {
              title: "Durée de conservation alignée",
              text: "Gardez les clés d'idempotence au moins 24 à 48 heures, pour couvrir les réessais tardifs des passerelles mobiles.",
            },
            {
              title: "File de rejet (dead-letter queue)",
              text: "Au-delà d'un nombre maximal d'essais (7, par exemple), isolez la requête dans une file d'inspection pour l'analyser sans ralentir les flux en cours.",
            },
            {
              title: "Signature vérifiée d'abord",
              text: "Contrôlez la signature HMAC SHA-256 envoyée par l'opérateur avant même d'interroger Redis : une requête non authentique ne coûte alors presque rien.",
            },
          ],
        },
      ],
    },
  ] satisfies ArticleSection[],
  tags: ["#architecture", "#python", "#paiements", "#redis"],
  reactions: { like: "J'aime", reply: "Répondre", save: "Enregistrer" },
  share: { label: "Partager :", copy: "Copier le lien" },
  tocTitle: "Dans cet article",
  discussion: {
    title: "Rejoindre la discussion",
    text: "Échangez sur les intégrations Mobile Money avec les développeurs backend de la communauté.",
    action: "Accéder au fil dédié",
  },
  related: {
    eyebrow: "Continuer l'exploration",
    title: "Articles recommandés",
    all: "Tous les articles",
  },
  callout: {
    eyebrow: "Intelligence collective",
    title: "Vous avez déployé une architecture similaire ?",
    text: "Partagez vos retours d'expérience et vos mesures avec la communauté LE BAOBAB, pour enrichir le socle commun des développeurs africains.",
    primary: "Publier un retour d'expérience",
    secondary: "Voir les discussions",
  },
};
