"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRightIcon, MailIcon, RefreshIcon, ShieldIcon } from "@/components/landing/icons";
import { ApiError, describeError } from "@/lib/api/errors";
import { authService } from "@/lib/auth/auth-service";
import { pendingVerification } from "@/lib/auth/pending";
import { startSession } from "@/lib/auth/session";
import type { OtpIssue } from "@/lib/auth/types";
import { ROUTES } from "@/lib/routes";
import { VERIFY } from "./auth-content";
import { DebugCode } from "./DebugCode";
import { Alert, Field, OtpInput, SubmitButton } from "./fields";
import { EMAIL_RE, maskEmail, RESEND_DELAY_S, useCountdown } from "./hooks";
import styles from "./Auth.module.css";

function issueNotice(issue?: OtpIssue): string | null {
  if (!issue || issue.reason === "sent") return null;
  return issue.reason === "daily_quota_reached" ? VERIFY.quota : VERIFY.notSent;
}

export function VerifyEmailForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [knownEmail, setKnownEmail] = useState(false);
  const [code, setCode] = useState("");
  const [issue, setIssue] = useState<OtpIssue | undefined>();
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [codeError, setCodeError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const left = useCountdown(sentAt ? sentAt + RESEND_DELAY_S * 1000 : null);

  useEffect(() => {
    const pending = pendingVerification.get();
    if (pending) {
      setEmail(pending.email);
      setKnownEmail(true);
      setIssue(pending.issue);
      setSentAt(pending.sentAt);
    }
    setReady(true);
  }, []);

  const verify = async (value: string) => {
    setFormError(null);
    setCodeError(undefined);
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Saisissez votre adresse e-mail.");
      return;
    }
    if (value.length !== 6) {
      setCodeError(VERIFY.codeIncomplete);
      return;
    }
    setLoading(true);
    try {
      startSession(await authService.verifyEmail(email, value));
      pendingVerification.clear();
      router.replace(ROUTES.memberSpace);
    } catch (error) {
      setLoading(false);
      if (error instanceof ApiError && error.code.startsWith("otp_")) {
        setCodeError(describeError(error));
        if (error.code !== "otp_invalid") setCode("");
        return;
      }
      setFormError(describeError(error));
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void verify(code);
  };

  const resend = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Saisissez votre adresse e-mail.");
      return;
    }
    setResending(true);
    setFormError(null);
    setInfo(null);
    try {
      const next = await authService.resendOtp(email, "verify_email");
      pendingVerification.set(email.trim().toLowerCase(), next);
      setIssue(next);
      setSentAt(Date.now());
      setCode("");
      setCodeError(undefined);
      setInfo(issueNotice(next) ?? VERIFY.resent);
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setResending(false);
    }
  };

  const notice = issueNotice(issue);

  return (
    <>
      {formError && (
        <Alert tone="error" onDismiss={() => setFormError(null)}>
          {formError}
        </Alert>
      )}
      <div className={`${styles.card} ${styles.cardCentered}`}>
        <span className={styles.heroIcon} aria-hidden="true">
          <ShieldIcon />
        </span>
        <h1 className={styles.title}>{VERIFY.title}</h1>
        {ready && knownEmail ? (
          <p className={styles.subtitle}>
            {VERIFY.sentTo} <strong className={styles.emailChip}>{maskEmail(email)}</strong>. {VERIFY.validity}
          </p>
        ) : (
          <p className={styles.subtitle}>{VERIFY.validity}</p>
        )}

        {info && <Alert tone={notice ? "warning" : "success"}>{info}</Alert>}
        {!info && notice && <Alert tone="warning">{notice}</Alert>}
        <DebugCode code={issue?.debug_code} onFill={(value) => setCode(value)} />

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          {ready && !knownEmail && (
            <Field
              id="confirmation-email"
              label={VERIFY.emailLabel}
              icon={<MailIcon />}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(undefined);
              }}
              error={emailError}
            />
          )}
          <OtpInput
            label={VERIFY.codeLabel}
            value={code}
            onChange={(value) => {
              setCode(value);
              setCodeError(undefined);
            }}
            onComplete={(value) => void verify(value)}
            error={codeError}
            disabled={loading}
          />
          <SubmitButton loading={loading} loadingLabel={VERIFY.loading}>
            {VERIFY.submit}
            <ArrowRightIcon aria-hidden="true" />
          </SubmitButton>
        </form>

        <div className={styles.secondaryActions}>
          <button type="button" className={styles.textButton} onClick={resend} disabled={resending || left > 0}>
            <RefreshIcon aria-hidden="true" />
            {left > 0 ? VERIFY.resendIn(left) : VERIFY.resend}
          </button>
          <Link href={ROUTES.register} className={styles.inlineLink}>
            {VERIFY.change}
          </Link>
        </div>

        <aside className={styles.helpBox}>
          <p className={styles.helpTitle}>{VERIFY.helpTitle}</p>
          <p>{VERIFY.helpText}</p>
        </aside>
      </div>
    </>
  );
}
