import type { ReactNode } from "react";
import type { AppNotification } from "@/features/notifications/api";
import { ROUTES } from "@/lib/routes";
import { AwardIcon, BellIcon, BriefcaseIcon, CommentIcon, HubIcon, LearnIcon, LockIcon, MessageIcon, ShopIcon, ThumbIcon, UserPlusIcon } from "../ui/icons";

export interface Described {
  text: ReactNode;
  href?: string;
  Icon: typeof BellIcon;
  tone: "brown" | "blue" | "green" | "amber" | "red";
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const DATE = new Intl.DateTimeFormat("fr", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/**
 * Texte et destination de chaque type de notification (apps/notifications/handlers.py).
 * Chaque notification mène à la page concernée quand l'élément a une adresse.
 */
export function describe(n: AppNotification): Described {
  const who = <strong>{n.actor?.display_name || n.actor?.username || str(n.data.from) || "Quelqu'un"}</strong>;
  const profile = n.actor ? ROUTES.profile(n.actor.username) : str(n.data.from) ? ROUTES.profile(str(n.data.from)) : undefined;
  switch (n.type) {
    case "friend_request":
      return { text: <>{who} vous a envoyé une demande d&apos;ami</>, href: profile, Icon: UserPlusIcon, tone: "blue" };
    case "friend_accepted":
      return { text: <>{who} a accepté votre demande d&apos;ami</>, href: profile, Icon: UserPlusIcon, tone: "green" };
    case "comment": {
      const post = str(n.data.post) || n.target_id;
      return { text: <>{who} a commenté votre publication</>, href: post ? `${ROUTES.post(post)}#commentaires` : undefined, Icon: CommentIcon, tone: "brown" };
    }
    case "post_reaction":
      return { text: <>{who} a réagi à votre publication</>, href: n.target_id ? ROUTES.post(n.target_id) : undefined, Icon: ThumbIcon, tone: "blue" };
    case "mention":
      return {
        text: <>{who} vous a mentionné dans une conversation</>,
        href: str(n.data.conversation) ? ROUTES.conversation(str(n.data.conversation)) : ROUTES.messages,
        Icon: MessageIcon,
        tone: "blue",
      };
    case "message":
      return { text: <>Nouveau message de {who}</>, href: str(n.data.conversation) ? ROUTES.conversation(str(n.data.conversation)) : ROUTES.messages, Icon: MessageIcon, tone: "blue" };
    case "group_invitation": {
      const group = str(n.data.group_name);
      return {
        text: group ? <>{who} vous invite à rejoindre <strong>{group}</strong></> : <>{who} vous invite à rejoindre un groupe</>,
        href: str(n.data.group) ? ROUTES.group(str(n.data.group)) : ROUTES.groups,
        Icon: HubIcon,
        tone: "brown",
      };
    }
    case "group_join_approved": {
      const group = str(n.data.group_name);
      return {
        text: group ? <>Bienvenue dans <strong>{group}</strong> : votre demande a été acceptée</> : <>Votre demande pour rejoindre un groupe a été acceptée</>,
        href: str(n.data.group) ? ROUTES.group(str(n.data.group)) : ROUTES.groups,
        Icon: HubIcon,
        tone: "green",
      };
    }
    case "classroom_invitation":
      return { text: <>{who} vous invite dans une classe Learn</>, href: ROUTES.feed, Icon: LearnIcon, tone: "brown" };
    case "course_enrollment":
      return { text: <>{who} s&apos;est inscrit(e) à l&apos;un de vos cours</>, Icon: LearnIcon, tone: "green" };
    case "assignment_graded": {
      const points = n.data.points;
      return { text: <>Votre devoir a été noté{points != null ? <> : <strong>{String(points)} points</strong></> : null}</>, Icon: LearnIcon, tone: "green" };
    }
    case "certificate_issued":
      return { text: <>Félicitations : un nouveau certificat vous a été délivré</>, Icon: AwardIcon, tone: "amber" };
    case "order_paid":
      return { text: <>Votre commande {str(n.data.number) && <strong>{str(n.data.number)}</strong>} est payée</>, Icon: ShopIcon, tone: "green" };
    case "new_sale":
      return { text: <>Nouvelle vente{str(n.data.number) && <> : commande <strong>{str(n.data.number)}</strong></>}</>, Icon: ShopIcon, tone: "green" };
    case "refund_processed":
      return { text: <>Votre remboursement a été effectué</>, Icon: ShopIcon, tone: "amber" };
    case "application_received":
      return { text: <>{who} a postulé à l&apos;une de vos offres</>, Icon: BriefcaseIcon, tone: "brown" };
    case "application_status":
      return { text: <>Votre candidature a changé d&apos;étape</>, Icon: BriefcaseIcon, tone: "blue" };
    case "interview_scheduled": {
      const at = str(n.data.starts_at);
      return { text: <>Entretien planifié{at && <> le <strong>{DATE.format(new Date(at))}</strong></>}</>, Icon: BriefcaseIcon, tone: "blue" };
    }
    case "offer_received":
      return { text: <>Vous avez reçu une offre</>, Icon: BriefcaseIcon, tone: "green" };
    case "proposal_received":
      return { text: <>Nouvelle proposition sur l&apos;une de vos missions</>, Icon: BriefcaseIcon, tone: "brown" };
    case "proposal_accepted":
      return { text: <>Votre proposition a été acceptée</>, Icon: BriefcaseIcon, tone: "green" };
    case "security_alert":
      return { text: <>Alerte de sécurité sur votre compte</>, Icon: LockIcon, tone: "red" };
    case "moderation_notice":
      return { text: <>Information de l&apos;équipe de modération</>, Icon: LockIcon, tone: "red" };
    default:
      return { text: <>Nouvelle notification</>, Icon: BellIcon, tone: "brown" };
  }
}

/** Libellés des types (paramètres) regroupés par catégorie. */
export const TYPE_LABELS: Record<string, string> = {
  friend_request: "Demandes d'ami",
  friend_accepted: "Demandes d'ami acceptées",
  comment: "Commentaires sur mes publications",
  post_reaction: "Réactions à mes publications",
  mention: "Mentions dans les conversations",
  message: "Nouveaux messages",
  group_invitation: "Invitations à des groupes",
  group_join_approved: "Adhésions acceptées",
  moderation_notice: "Modération",
  security_alert: "Sécurité du compte",
  classroom_invitation: "Invitations à des classes",
  course_enrollment: "Inscriptions à mes cours",
  assignment_graded: "Devoirs notés",
  certificate_issued: "Certificats délivrés",
  order_paid: "Commandes payées",
  new_sale: "Nouvelles ventes",
  refund_processed: "Remboursements",
  application_received: "Candidatures reçues",
  application_status: "Suivi de mes candidatures",
  interview_scheduled: "Entretiens",
  offer_received: "Offres reçues",
  proposal_received: "Propositions reçues",
  proposal_accepted: "Propositions acceptées",
};

export const CATEGORY_LABELS: Record<string, string> = {
  social: "Réseau et publications",
  messaging: "Messagerie",
  learning: "Learn",
  jobs: "Opportunités",
  commerce: "Boutique",
  system: "Compte",
};

/** Message court affiché en toast quand une notification arrive en direct. */
export function liveText(code: string | undefined, data: Record<string, unknown> | undefined) {
  const from = data && typeof data.from === "string" ? `@${data.from}` : "Quelqu'un";
  switch (code) {
    case "friend_request":
      return `${from} vous a envoyé une demande d'ami.`;
    case "comment":
      return `${from} a commenté votre publication.`;
    case "post_reaction":
      return `${from} a réagi à votre publication.`;
    case "mention":
      return `${from} vous a mentionné.`;
    default:
      return "Nouvelle notification.";
  }
}
