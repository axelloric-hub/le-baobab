import type { Visibility } from "@/features/social/types";
import { GlobeIcon, HubIcon, ListIcon, LockIcon, StarUserIcon, UserCheckIcon, UsersIcon } from "./icons";

/** Les 7 visibilités réelles (apps/core/choices.py), avec un libellé et une aide. */
export const VISIBILITIES: Array<{ value: Visibility; label: string; hint: string; Icon: typeof GlobeIcon }> = [
  { value: "public", label: "Public", hint: "Tout le monde, même sans compte", Icon: GlobeIcon },
  { value: "followers", label: "Mes abonnés", hint: "Les personnes qui vous suivent", Icon: UserCheckIcon },
  { value: "friends", label: "Mes amis", hint: "Vos amis confirmés", Icon: UsersIcon },
  { value: "close_friends", label: "Amis proches", hint: "Votre cercle restreint", Icon: StarUserIcon },
  { value: "group_members", label: "Membres du groupe", hint: "Uniquement le groupe choisi", Icon: HubIcon },
  { value: "custom", label: "Audience personnalisée", hint: "Les personnes que vous choisissez", Icon: ListIcon },
  { value: "private", label: "Moi uniquement", hint: "Visible par vous seul", Icon: LockIcon },
];

export const visibilityOf = (value: string | undefined) => VISIBILITIES.find((v) => v.value === value) ?? VISIBILITIES[0];
