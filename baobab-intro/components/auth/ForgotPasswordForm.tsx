"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeftIcon, KeyIcon, LockIcon, MailIcon, RefreshIcon, ShieldIcon } from "@/components/landing/icons";
import { ApiError, describeError, fieldError } from "@/lib/api/errors";
import { authService } from "@/lib/auth/auth-service";
import { loginNotice } from "@/lib/auth/pending";
import type { OtpIssue } from "@/lib/auth/types";
import { ROUTES } from "@/lib/routes";
import { FORGOT, REGISTER, VERIFY } from "./auth-content";
import { DebugCode } from "./DebugCode";
import { Alert, Field, OtpInput, PasswordField, SubmitButton } from "./fields";
import { EMAIL_RE, RESEND_DELAY_S, useCountdown } from "./hooks";
import styles from "./Auth.module.css";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [issue, setIssue] = useState<OtpIssue | undefined>();
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [errors, setErrors] = useState<{ email?: string; code?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const left = useCountdown(sentAt ? sentAt + RESEND_DELAY_S * 1000 : null);

  const requestCode = async (event?: FormEvent) => {
    event?.preventDefault();
    setFormError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setErrors({ email: REGISTER.errors.email });
      document.getElementById("oubli-email")?.focus();
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      setIssue(await authService.forgotPassword(email));
      setSentAt(Date.now());
      setCode("");
      setStep(2);
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setLoading(false);
    }
  };

  const reset = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const found = {
      code: code.length === 6 ? undefined : VERIFY.codeIncomplete,
      password:
        password.length < 10 ? REGISTER.errors.passwordShort : /^\d+$/.test(password) ? REGISTER.errors.passwordDigits : undefined,
    };
    setErrors(found);
    if (found.code || found.password) return;
    setLoading(true);
    try {
      await authService.resetPassword(email, code, password);
      loginNotice.set({ kind: "password_reset", email: email.trim().toLowerCase() });
      router.replace(ROUTES.login);
    } catch (error) {
      setLoading(false);
      if (error instanceof ApiError && error.code.startsWith("otp_")) {
        setErrors({ code: describeError(error) });
        return;
      }
      if (error instanceof ApiError && error.code === "validation_error") {
        const passwordError = fieldError(error, "new_password");
        if (passwordError) {
          setErrors({ password: passwordError });
          return;
        }
      }
      setFormError(describeError(error));
    }
  };

  return (
    <>
      <ol className={styles.stepper} aria-label="Étapes">
        {FORGOT.steps.map((label, index) => (
          <li key={label} aria-current={step === index + 1 ? "step" : undefined} data-done={step > index + 1 || undefined}>
            <span className={styles.stepNumber}>{index + 1}</span>
            <span>
              <small>Étape {index + 1}/2</small>
              {label}
            </span>
          </li>
        ))}
      </ol>

      {formError && (
        <Alert tone="error" onDismiss={() => setFormError(null)}>
          {formError}
        </Alert>
      )}

      <div className={styles.card}>
        <p className={styles.badge} data-tone="brown">
          <ShieldIcon aria-hidden="true" />
          {FORGOT.badge}
        </p>
        <h1 className={styles.title}>{FORGOT.title}</h1>

        {step === 1 ? (
          <>
            <p className={styles.subtitle}>{FORGOT.intro}</p>
            <form className={styles.form} onSubmit={requestCode} noValidate>
              <Field
                id="oubli-email"
                label={FORGOT.email.label}
                icon={<MailIcon />}
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder={FORGOT.email.placeholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                required
              />
              <SubmitButton loading={loading} loadingLabel={FORGOT.sending}>
                {FORGOT.send}
              </SubmitButton>
            </form>
          </>
        ) : (
          <>
            <p className={styles.subtitle}>
              {FORGOT.codeSentTo} <strong className={styles.emailChip}>{email.trim().toLowerCase()}</strong>.
            </p>
            {issue && issue.reason !== "sent" && (
              <Alert tone="warning">{issue.reason === "daily_quota_reached" ? VERIFY.quota : FORGOT.notSent}</Alert>
            )}
            <DebugCode code={issue?.debug_code} onFill={setCode} />
            <form className={styles.form} onSubmit={reset} noValidate>
              <div>
                <div className={styles.labelRow}>
                  <span />
                  <button type="button" className={styles.textButton} onClick={() => void requestCode()} disabled={loading || left > 0}>
                    <RefreshIcon aria-hidden="true" />
                    {left > 0 ? `${FORGOT.resend} (${left} s)` : FORGOT.resend}
                  </button>
                </div>
                <OtpInput
                  label={FORGOT.codeLabel}
                  value={code}
                  onChange={(value) => {
                    setCode(value);
                    setErrors((e) => ({ ...e, code: undefined }));
                  }}
                  error={errors.code}
                  disabled={loading}
                />
              </div>
              <PasswordField
                id="oubli-password"
                label={FORGOT.newPassword.label}
                icon={<KeyIcon />}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint={FORGOT.newPassword.hint}
                error={errors.password}
                showStrength
                maxLength={128}
              />
              <SubmitButton loading={loading} loadingLabel={FORGOT.submitting}>
                {FORGOT.submit}
                <LockIcon aria-hidden="true" />
              </SubmitButton>
              <p className={styles.securityNote}>
                <ShieldIcon aria-hidden="true" />
                {FORGOT.security}
              </p>
            </form>
            <button
              type="button"
              className={`${styles.textButton} ${styles.centered}`}
              onClick={() => {
                setStep(1);
                setErrors({});
              }}
            >
              {FORGOT.changeEmail}
            </button>
          </>
        )}

        <p className={styles.switch}>
          <Link href={ROUTES.login} className={styles.backToLogin}>
            <ArrowLeftIcon aria-hidden="true" />
            {FORGOT.back}
          </Link>
        </p>
      </div>
    </>
  );
}
