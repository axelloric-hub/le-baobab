"use client";

import { useId, useRef, useState, type ClipboardEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CloseIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  SpinnerIcon,
} from "@/components/landing/icons";
import { AUTH_COMMON, STRENGTH_LABELS } from "./auth-content";
import styles from "./Auth.module.css";

/* ------------------------------------------------------------------ */
/* Champ texte                                                         */
/* ------------------------------------------------------------------ */

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label: string;
  icon?: ReactNode;
  prefix?: string;
  hint?: string;
  error?: string;
  /** Mention à droite du libellé (« Requis », « Facultatif ») ou lien (« Mot de passe oublié ? »). */
  aside?: ReactNode;
  trailing?: ReactNode;
}

export function Field({ label, icon, prefix, hint, error, aside, trailing, id, className, ...input }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-aide` : undefined;
  const errorId = error ? `${inputId}-erreur` : undefined;
  return (
    <div className={styles.field} data-invalid={error ? "" : undefined}>
      <div className={styles.labelRow}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        {aside}
      </div>
      <div className={styles.control}>
        {icon && (
          <span className={styles.controlIcon} aria-hidden="true">
            {icon}
          </span>
        )}
        {prefix && (
          <span className={styles.prefix} aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          className={`${styles.input} ${className ?? ""}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
          {...input}
        />
        {trailing}
      </div>
      {error && (
        <p id={errorId} className={styles.fieldError}>
          <AlertCircleIcon aria-hidden="true" />
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function FieldTag({ children }: { children: ReactNode }) {
  return <span className={styles.fieldTag}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Mot de passe (afficher / masquer + robustesse)                      */
/* ------------------------------------------------------------------ */

/** Estimation indicative (0 à 4). La vraie règle est appliquée par le serveur. */
export function passwordScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  if (password.length < 10 || /^\d+$/.test(password)) score = Math.min(score, 1);
  return Math.min(score, 4);
}

interface PasswordFieldProps extends Omit<FieldProps, "type" | "trailing"> {
  showStrength?: boolean;
}

export function PasswordField({ showStrength = false, value, icon, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const score = passwordScore(String(value ?? ""));
  return (
    <div>
      <Field
        {...props}
        value={value}
        icon={icon}
        type={visible ? "text" : "password"}
        trailing={
          <button
            type="button"
            className={styles.eye}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? AUTH_COMMON.hide : AUTH_COMMON.show}
            aria-pressed={visible}
          >
            {visible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
          </button>
        }
      />
      {showStrength && String(value ?? "").length > 0 && (
        <div className={styles.strength} data-score={score}>
          <div className={styles.strengthBars} aria-hidden="true">
            {[1, 2, 3, 4].map((step) => (
              <span key={step} data-on={score >= step || undefined} />
            ))}
          </div>
          <p className={styles.strengthLabel} aria-live="polite">
            Robustesse : <strong>{STRENGTH_LABELS[score]}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Code à 6 chiffres                                                   */
/* ------------------------------------------------------------------ */

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  error?: string;
  disabled?: boolean;
  onComplete?: (value: string) => void;
}

export function OtpInput({ value, onChange, label, error, disabled, onComplete }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const groupId = useId();
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const update = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
  };

  const setDigit = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "");
    if (!digit) return;
    if (digit.length > 1) {
      // saisie automatique (SMS / gestionnaire) ou collage dans une case
      update(value.slice(0, index) + digit);
      refs.current[Math.min(index + digit.length, 5)]?.focus();
      return;
    }
    const pos = Math.min(index, value.length);
    update(value.slice(0, pos) + digit + value.slice(pos + 1));
    refs.current[Math.min(pos + 1, 5)]?.focus();
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) {
        update(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        update(value.slice(0, index - 1) + value.slice(index));
        refs.current[index - 1]?.focus();
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    update(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <fieldset className={styles.otp} aria-describedby={error ? `${groupId}-erreur` : undefined} disabled={disabled}>
      <legend className={styles.label}>{label}</legend>
      <div className={styles.otpBoxes}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            className={styles.otpBox}
            data-gap={index === 3 || undefined}
            value={digit}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onPaste={onPaste}
            onFocus={(event) => event.target.select()}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            maxLength={index === 0 ? 6 : 1}
            aria-label={`Chiffre ${index + 1} sur 6`}
            aria-invalid={error ? true : undefined}
          />
        ))}
      </div>
      {error && (
        <p id={`${groupId}-erreur`} className={styles.fieldError}>
          <AlertCircleIcon aria-hidden="true" />
          {error}
        </p>
      )}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Bandeaux, bouton d'envoi                                            */
/* ------------------------------------------------------------------ */

type AlertTone = "error" | "info" | "success" | "warning";

const ALERT_ICONS: Record<AlertTone, typeof InfoIcon> = {
  error: AlertCircleIcon,
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: AlertCircleIcon,
};

export function Alert({
  tone,
  children,
  action,
  onDismiss,
}: {
  tone: AlertTone;
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div className={styles.alert} data-tone={tone} role={tone === "error" ? "alert" : "status"}>
      <Icon aria-hidden="true" className={styles.alertIcon} />
      <div className={styles.alertBody}>
        <div>{children}</div>
        {action && <div className={styles.alertAction}>{action}</div>}
      </div>
      {onDismiss && (
        <button type="button" className={styles.alertClose} onClick={onDismiss} aria-label="Fermer le message">
          <CloseIcon aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function SubmitButton({
  loading,
  loadingLabel,
  children,
  disabled,
}: {
  loading: boolean;
  loadingLabel: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button type="submit" className={styles.submit} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading ? (
        <>
          <SpinnerIcon aria-hidden="true" className={styles.spinner} />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <p className={styles.divider}>
      <span>{label}</span>
    </p>
  );
}

