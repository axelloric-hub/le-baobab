import type { CSSProperties, ReactNode } from "react";
import { describeError } from "@/lib/api/errors";
import { RefreshIcon, SpinnerIcon, WifiOffIcon } from "./icons";
import styles from "./ui.module.css";

export function Skeleton({ width = "100%", height = 14, radius, style }: { width?: number | string; height?: number | string; radius?: number | string; style?: CSSProperties }) {
  return <span className={styles.skeleton} style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <span role={label ? "status" : undefined} style={{ display: "inline-flex" }}>
      <SpinnerIcon className={styles.spin} width={size} height={size} />
      {label && <span className="bb-visually-hidden">{label}</span>}
    </span>
  );
}

interface StateProps {
  icon: ReactNode;
  title: string;
  text?: ReactNode;
  actions?: ReactNode;
  tone?: "neutral" | "error";
}

export function EmptyState({ icon, title, text, actions, tone = "neutral" }: StateProps) {
  return (
    <div className={styles.state} data-tone={tone === "error" ? "error" : undefined}>
      <span className={styles.stateIcon} aria-hidden="true">
        {icon}
      </span>
      <p className={styles.stateTitle}>{title}</p>
      {text && <p className={styles.stateText}>{text}</p>}
      {actions && <div className={styles.stateActions}>{actions}</div>}
    </div>
  );
}

/** Erreur de chargement : message clair + « Réessayer ». Hors ligne : message dédié. */
export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div role="alert">
      <EmptyState
        tone="error"
        icon={<WifiOffIcon />}
        title={title ?? (offline ? "Vous êtes hors ligne" : "Le chargement a échoué")}
        text={offline ? "Vérifiez votre connexion : le contenu se rechargera dès votre retour en ligne." : describeError(error)}
        actions={
          onRetry && (
            <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={onRetry}>
              <RefreshIcon />
              Réessayer
            </button>
          )
        }
      />
    </div>
  );
}
