"use client";

import { createContext, useContext } from "react";

/** Outil présélectionné à l'ouverture du composeur (barre « Partagez… » : Image, Code, Sondage…). */
export type ComposerTool = "media" | "code" | "link" | "poll" | "project";

/** Groupe dans lequel publier (composeur ouvert depuis la page d'un groupe). */
export interface GroupTarget {
  slug: string;
  name: string;
  privacy: "public" | "private" | "hidden";
}

export interface Creation {
  /** Ouvre la fenêtre « Créer une publication » (dans un groupe si `group` est fourni). */
  openPost: (tool?: ComposerTool, group?: GroupTarget) => void;
  /** Ouvre la fenêtre « Créer un statut ». */
  openStatus: () => void;
  /** Ouvre la recherche (Ctrl + K). */
  openSearch: () => void;
}

export const CreationContext = createContext<Creation>({ openPost: () => {}, openStatus: () => {}, openSearch: () => {} });

export const useCreation = () => useContext(CreationContext);
