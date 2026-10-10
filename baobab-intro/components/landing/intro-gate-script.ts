/**
 * Décide, AVANT le premier affichage, si la cinématique doit être jouée sur la
 * page d'accueil. Sans ce script, on verrait la landing une fraction de seconde
 * avant l'arrivée de la cinématique.
 *
 * Choix produit : la cinématique complète se joue à CHAQUE ouverture de « / »
 * (y compris quand le système demande moins d'animations). Le visiteur peut
 * toujours la passer (« Passer l'intro » ou Échap).
 *  - ?intro=0 la désactive (pratique pour développer ou présenter la page seule).
 *
 * Résultat : <html data-intro="play"> ou <html data-intro="done">.
 */
export const INTRO_GATE_SCRIPT = `(function(){var d=document.documentElement;try{var q=new URLSearchParams(location.search).get("intro");d.dataset.intro=location.pathname==="/"&&q!=="0"?"play":"done";}catch(e){d.dataset.intro="done";}})();`;

/** Événement global qui demande de rejouer la cinématique (bouton « Voir l'intro »). */
export const PLAY_INTRO_EVENT = "baobab:play-intro";

/** id du conteneur de la landing, rendu inerte pendant la cinématique. */
export const LANDING_ROOT_ID = "landing-root";
