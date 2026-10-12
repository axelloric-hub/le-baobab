"use client";

import { createContext, useContext } from "react";

/** Outil présélectionné à l'ouverture du composeur (barre « Partagez… » : Image, Code, Sondage…). */
export type ComposerTool = "media" | "code" | "link" | "poll" | "project";

export interface Creation {
  /** Ouvre la fenêtre « Créer une publication ». */
  openPost: (tool?: ComposerTool) => void;
  /** Ouvre la fenêtre « Créer un statut ». */
  openStatus: () => void;
  /** Ouvre la recherche (Ctrl + K). */
  openSearch: () => void;
}

export const CreationContext = createContext<Creation>({ openPost: () => {}, openStatus: () => {}, openSearch: () => {} });

export const useCreation = () => useContext(CreationContext);
