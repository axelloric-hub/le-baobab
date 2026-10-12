/**
 * Connexion WebSocket résiliente (Django Channels) :
 * jeton dans l'URL (?token=), reconnexion avec délai croissant (1, 2, 4… 30 s),
 * jeton rafraîchi à chaque reconnexion, arrêt propre à la fermeture.
 * Une seule instance serveur : les sockets tombent à chaque redémarrage — c'est prévu.
 */
import { websocketBase } from "@/lib/api/config";
import { getAccessToken } from "@/lib/auth/session";

export interface SocketHandle {
  send: (data: unknown) => void;
  close: () => void;
}

export function openSocket(path: string, onMessage: (data: unknown) => void): SocketHandle {
  let socket: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let timer: number | undefined;

  const connect = async () => {
    if (closed) return;
    const token = await getAccessToken();
    if (!token || closed) return;
    try {
      socket = new WebSocket(`${websocketBase()}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`);
    } catch {
      schedule();
      return;
    }
    socket.onopen = () => {
      attempt = 0;
    };
    socket.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data as string));
      } catch {
        /* message illisible : ignoré */
      }
    };
    socket.onclose = (event) => {
      socket = null;
      // 4401 : non authentifié ; 4403 : accès refusé — inutile d'insister.
      if (!closed && event.code !== 4403) schedule();
    };
  };

  const schedule = () => {
    if (closed) return;
    const delay = Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 400;
    attempt += 1;
    timer = window.setTimeout(connect, delay);
  };

  void connect();

  return {
    send: (data) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
    },
    close: () => {
      closed = true;
      window.clearTimeout(timer);
      socket?.close();
    },
  };
}
