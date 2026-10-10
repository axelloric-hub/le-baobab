/**
 * Décide, AVANT le premier affichage, si la cinématique doit être jouée sur la
 * page d'accueil. Sans ce script, on verrait la landing une fraction de seconde
 * avant l'arrivée de la cinématique (ou l'inverse).
 *
 * Règles :
 *  - uniquement sur « / » ;
 *  - une fois par session d'onglet (sessionStorage) ;
 *  - jamais si l'utilisateur a demandé moins d'animations ;
 *  - ?intro=1 force la lecture, ?intro=0 la désactive (pratique pour présenter).
 *
 * Résultat : <html data-intro="play"> ou <html data-intro="done">.
 */
export const INTRO_SEEN_STORAGE_KEY = "baobab-intro-seen";

export const INTRO_GATE_SCRIPT = `(function(){var d=document.documentElement;try{var q=new URLSearchParams(location.search).get("intro");var seen=sessionStorage.getItem("${INTRO_SEEN_STORAGE_KEY}")==="1";var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;var home=location.pathname==="/";d.dataset.intro=home&&(q==="1"||(q!=="0"&&!seen&&!reduce))?"play":"done";}catch(e){d.dataset.intro="done";}})();`;

/** Événement global qui demande de rejouer la cinématique (bouton « Voir l'intro »). */
export const PLAY_INTRO_EVENT = "baobab:play-intro";

/** id du conteneur de la landing, rendu inerte pendant la cinématique. */
export const LANDING_ROOT_ID = "landing-root";
