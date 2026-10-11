"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRightIcon, LockIcon, MailIcon, RefreshIcon } from "@/components/landing/icons";
import { ApiError, describeError } from "@/lib/api/errors";
import { authService } from "@/lib/auth/auth-service";
import { loginNotice, pendingVerification } from "@/lib/auth/pending";
import { startSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { AUTH_COMMON, LOGIN } from "./auth-content";
import { Alert, Divider, Field, PasswordField, SubmitButton } from "./fields";
import { GitHubButton } from "./GitHubButton";
import { EMAIL_RE, useRedirectIfAuthenticated } from "./hooks";
import styles from "./Auth.module.css";

export function LoginForm() {
  const router = useRouter();
  useRedirectIfAuthenticated();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notVerified, setNotVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const pending = loginNotice.take();
    if (pending?.kind === "password_reset") {
      setNotice(LOGIN.resetDone);
      setEmail(pending.email);
    }
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setNotVerified(false);
    const found = {
      email: EMAIL_RE.test(email.trim()) ? undefined : LOGIN.errors.email,
      password: password ? undefined : LOGIN.errors.password,
    };
    setErrors(found);
    if (found.email || found.password) {
      document.getElementById(found.email ? "connexion-email" : "connexion-password")?.focus();
      return;
    }
    setLoading(true);
    try {
      startSession(await authService.login(email, password));
      router.replace(ROUTES.memberSpace);
    } catch (error) {
      setLoading(false);
      if (error instanceof ApiError && error.code === "email_not_verified") {
        setNotVerified(true);
        return;
      }
      setFormError(describeError(error));
    }
  };

  const resendCode = async () => {
    setResending(true);
    try {
      const issue = await authService.resendOtp(email, "verify_email");
      pendingVerification.set(email.trim().toLowerCase(), issue);
      router.push(ROUTES.verifyEmail);
    } catch (error) {
      setResending(false);
      setFormError(describeError(error));
    }
  };

  return (
    <>
      {formError && (
        <Alert tone="error" onDismiss={() => setFormError(null)}>
          {formError}
        </Alert>
      )}
      {notVerified && (
        <Alert
          tone="info"
          action={
            <button type="button" className={styles.alertButton} onClick={resendCode} disabled={resending}>
              <RefreshIcon aria-hidden="true" />
              {LOGIN.resendCode}
            </button>
          }
        >
          {describeError(new ApiError(403, "email_not_verified"))}
        </Alert>
      )}
      {notice && (
        <Alert tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <div className={styles.card}>
        <p className={styles.badge}>
          <span className={styles.badgeDot} aria-hidden="true" />
          {LOGIN.badge}
        </p>
        <h1 className={styles.title}>{LOGIN.title}</h1>
        <p className={styles.subtitle}>{LOGIN.subtitle}</p>

        <GitHubButton onError={setFormError} />
        <Divider label={AUTH_COMMON.or} />

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <Field
            id="connexion-email"
            label={LOGIN.email.label}
            icon={<MailIcon />}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={LOGIN.email.placeholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
          />
          <PasswordField
            id="connexion-password"
            label={LOGIN.password.label}
            aside={
              <Link href={ROUTES.forgotPassword} className={styles.inlineLink}>
                {LOGIN.forgot}
              </Link>
            }
            icon={<LockIcon />}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            maxLength={128}
            required
          />
          <SubmitButton loading={loading} loadingLabel={LOGIN.loading}>
            {LOGIN.submit}
            <ArrowRightIcon aria-hidden="true" />
          </SubmitButton>
        </form>

        <p className={styles.switch}>
          {LOGIN.noAccount}{" "}
          <Link href={ROUTES.register} className={styles.switchLink}>
            {LOGIN.register}
          </Link>
        </p>
      </div>

      <p className={styles.discover}>
        <Link href={ROUTES.discover} prefetch={false} className={styles.inlineLink}>
          {LOGIN.discover}
        </Link>
      </p>
    </>
  );
}
