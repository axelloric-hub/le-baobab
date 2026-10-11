"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRightIcon, HubIcon, IdCardIcon, LockIcon, MailIcon } from "@/components/landing/icons";
import { ApiError, describeError, fieldError } from "@/lib/api/errors";
import { authService } from "@/lib/auth/auth-service";
import { markAsMember } from "@/lib/auth/member-cookie";
import { pendingVerification } from "@/lib/auth/pending";
import { ROUTES } from "@/lib/routes";
import { AUTH_COMMON, REGISTER } from "./auth-content";
import { Alert, Divider, Field, FieldTag, PasswordField, SubmitButton } from "./fields";
import { GitHubButton } from "./GitHubButton";
import { EMAIL_RE, USERNAME_RE, useRedirectIfAuthenticated } from "./hooks";
import styles from "./Auth.module.css";

type Errors = Partial<Record<"email" | "username" | "displayName" | "password" | "terms", string>>;

export function RegisterForm() {
  const router = useRouter();
  useRedirectIfAuthenticated();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): Errors => {
    const next: Errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = REGISTER.errors.email;
    if (!USERNAME_RE.test(username)) next.username = REGISTER.errors.username;
    if (password.length < 10) next.password = REGISTER.errors.passwordShort;
    else if (/^\d+$/.test(password)) next.password = REGISTER.errors.passwordDigits;
    if (!terms) next.terms = REGISTER.errors.terms;
    return next;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById(`inscription-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setLoading(true);
    try {
      const result = await authService.register({ email, username, password, display_name: displayName });
      // Le compte existe désormais : ce navigateur sera reconnu à la prochaine visite.
      markAsMember();
      pendingVerification.set(email.trim().toLowerCase(), result.otp);
      router.push(ROUTES.verifyEmail);
    } catch (error) {
      setLoading(false);
      if (error instanceof ApiError && error.code === "email_taken") {
        setErrors({ email: describeError(error) });
        document.getElementById("inscription-email")?.focus();
        return;
      }
      if (error instanceof ApiError && error.code === "validation_error") {
        const serverErrors: Errors = {
          email: fieldError(error, "email"),
          username: fieldError(error, "username"),
          displayName: fieldError(error, "display_name"),
          password: fieldError(error, "password"),
        };
        setErrors(serverErrors);
        if (Object.values(serverErrors).some(Boolean)) return;
      }
      setFormError(describeError(error));
    }
  };

  return (
    <div className={styles.card}>
      <p className={styles.badge}>
        <HubIcon aria-hidden="true" />
        {REGISTER.badge}
      </p>
      <h1 className={styles.title}>{REGISTER.title}</h1>
      <p className={styles.subtitle}>{REGISTER.subtitle}</p>

      {formError && (
        <Alert tone="error" onDismiss={() => setFormError(null)}>
          {formError}
        </Alert>
      )}

      <GitHubButton onError={setFormError} />
      <Divider label={AUTH_COMMON.or} />

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <Field
          id="inscription-email"
          label={REGISTER.email.label}
          aside={<FieldTag>{AUTH_COMMON.required}</FieldTag>}
          icon={<MailIcon />}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={REGISTER.email.placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />
        <Field
          id="inscription-username"
          label={REGISTER.username.label}
          aside={<FieldTag>{AUTH_COMMON.required}</FieldTag>}
          prefix="@"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={REGISTER.username.placeholder}
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
          maxLength={30}
          hint={REGISTER.username.hint}
          error={errors.username}
          required
        />
        <Field
          id="inscription-displayName"
          label={REGISTER.displayName.label}
          aside={<FieldTag>{AUTH_COMMON.optional}</FieldTag>}
          icon={<IdCardIcon />}
          autoComplete="name"
          placeholder={REGISTER.displayName.placeholder}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          hint={REGISTER.displayName.hint}
          error={errors.displayName}
        />
        <PasswordField
          id="inscription-password"
          label={REGISTER.password.label}
          aside={<FieldTag>{AUTH_COMMON.required}</FieldTag>}
          icon={<LockIcon />}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={REGISTER.password.hint}
          error={errors.password}
          showStrength
          maxLength={128}
          required
        />

        <div className={styles.checkRow} data-invalid={errors.terms ? "" : undefined}>
          <input
            id="inscription-terms"
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            aria-invalid={errors.terms ? true : undefined}
            aria-describedby={errors.terms ? "inscription-terms-erreur" : undefined}
          />
          <label htmlFor="inscription-terms">{REGISTER.terms}</label>
        </div>
        {errors.terms && (
          <p id="inscription-terms-erreur" className={styles.fieldError} role="alert">
            {errors.terms}
          </p>
        )}

        <SubmitButton loading={loading} loadingLabel={REGISTER.loading}>
          {REGISTER.submit}
          <ArrowRightIcon aria-hidden="true" />
        </SubmitButton>
      </form>

      <p className={styles.switch}>
        {REGISTER.already}{" "}
        <Link href={ROUTES.login} className={styles.switchLink}>
          {REGISTER.login}
        </Link>
      </p>
    </div>
  );
}
