"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { describeError } from "@/lib/api/errors";
import styles from "./Certificate.module.css";

type Result = { valid: true; holder: string; course: string; issued_at: string; score_percent: number | null } | { valid: false; revoked?: boolean };

const DAY = new Intl.DateTimeFormat("fr", { day: "numeric", month: "long", year: "numeric" });

/**
 * Vérification PUBLIQUE d'un certificat LE BAOBAB (sans compte) : un recruteur colle le code ou suit le lien
 * partagé par le titulaire. Le serveur ne renvoie que le nom affiché, le cours, la date et le score.
 */
export function CertificateCheck({ code }: { code: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    apiRequest<Result>(`/public/certificates/${encodeURIComponent(code)}/`)
      .then((r) => alive && setResult(r))
      .catch((e) => alive && setError(describeError(e)));
    return () => {
      alive = false;
    };
  }, [code]);

  return (
    <section className={styles.wrap} aria-live="polite">
      <p className={styles.kicker}>Vérification de certificat</p>
      <p className={styles.code}>{code.toUpperCase()}</p>
      {!result && !error && <p className={styles.text}>Vérification en cours…</p>}
      {error && <p className={styles.text}>{error}</p>}
      {result?.valid === true && (
        <div className={styles.card} data-valid="">
          <p className={styles.status}>Certificat authentique</p>
          <h1 className={styles.title}>{result.course}</h1>
          <p className={styles.text}>
            Délivré par LE BAOBAB à <strong>{result.holder}</strong> le {DAY.format(new Date(result.issued_at))}
            {result.score_percent != null && `, avec un score de ${Math.round(result.score_percent)} %`}.
          </p>
        </div>
      )}
      {result?.valid === false && (
        <div className={styles.card}>
          <p className={styles.status}>{result.revoked ? "Certificat révoqué" : "Certificat introuvable"}</p>
          <p className={styles.text}>
            {result.revoked ? "Ce certificat a été retiré par LE BAOBAB : il n'est plus valable." : "Aucun certificat ne correspond à ce code. Vérifiez qu'il a été recopié sans erreur."}
          </p>
        </div>
      )}
    </section>
  );
}
