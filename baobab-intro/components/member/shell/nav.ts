import { ROUTES } from "@/lib/routes";
import { BriefcaseIcon, CommunityIcon, HomeIcon, LearnIcon, MessageIcon, ShopIcon, ShowcaseIcon } from "../ui/icons";

/**
 * Les 7 applications de l'espace membre (document de design, §2).
 * Une entrée sans `href` n'est pas encore livrée : elle est affichée « Bientôt » et n'est pas cliquable,
 * plutôt qu'un lien vers une page 404. Livrer une application = renseigner son `href`.
 */
export interface NavApp {
  id: string;
  label: string;
  href?: string;
  Icon: typeof HomeIcon;
}

export const NAV_APPS: NavApp[] = [
  { id: "accueil", label: "Accueil", href: ROUTES.feed, Icon: HomeIcon },
  { id: "messages", label: "Messages", href: ROUTES.messages, Icon: MessageIcon },
  { id: "communaute", label: "Communauté", href: ROUTES.groups, Icon: CommunityIcon },
  { id: "learn", label: "Learn", Icon: LearnIcon },
  { id: "showcase", label: "Showcase", Icon: ShowcaseIcon },
  { id: "opportunites", label: "Opportunités", Icon: BriefcaseIcon },
  { id: "boutique", label: "Boutique", Icon: ShopIcon },
];

export const SOON = "Bientôt";
