import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  CommentIcon,
  EyeIcon,
  InfoIcon,
  MailIcon,
  PlusIcon,
  ShieldIcon,
  ThumbDownIcon,
  ThumbUpIcon,
  ExternalIcon,
} from "@/components/landing/icons";
import { PendingButton } from "@/components/landing/sections/SectionHeading";
import shared from "../shared/Pages.module.css";
import { RichText } from "../shared/RichText";
import { DocsSearch } from "./DocsClient";
import { DocsLayout } from "./DocsLayout";
import { DOCS_ACCOUNT, DOCS_ACCOUNT_HREF, DOCS_SOURCE_URL, DOCS_UI } from "./docs-content";
import styles from "./Docs.module.css";

const GUIDE = DOCS_ACCOUNT;

function FormMock() {
  const form = GUIDE.mockForm;
  return (
    <figure className={styles.screen} aria-label="Aperçu du formulaire d'inscription">
      <div className={styles.screenBar}>
        <span className={styles.screenDots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className={styles.screenAddress}>{form.address}</span>
        <span className={styles.screenBadge}>{form.badge}</span>
      </div>
      <div className={styles.screenBody}>
        {form.fields.map((field) => (
          <div key={field.label} className={styles.mockField}>
            <span className={styles.mockLabel}>{field.label}</span>
            <span className={styles.mockInput}>
              <span>{field.value}</span>
              {field.password && <EyeIcon aria-hidden="true" />}
            </span>
          </div>
        ))}
        <span className={styles.mockSubmit}>
          {form.submit}
          <ArrowRightIcon aria-hidden="true" />
        </span>
      </div>
      <figcaption className={shared.illustrative}>Aperçu illustratif</figcaption>
    </figure>
  );
}

function OtpMock() {
  const otp = GUIDE.mockOtp;
  return (
    <figure className={styles.otp} aria-label="Aperçu de l'écran de confirmation">
      <div className={styles.otpCard}>
        <span className={styles.otpIcon} aria-hidden="true">
          <ShieldIcon />
        </span>
        <p className={styles.otpTitle}>{otp.title}</p>
        <p className={styles.otpText}>
          {otp.text} <code className={shared.inlineCode}>{otp.email}</code>
        </p>
        <p className={styles.otpDigits} aria-label={`Code : ${otp.digits.join(" ")}`}>
          {otp.digits.map((digit, index) => (
            <span key={index} aria-hidden="true" data-gap={index === 3 || undefined}>
              {digit}
            </span>
          ))}
        </p>
        <p className={styles.otpLinks}>
          <span>{otp.resend}</span>
          <span aria-hidden="true">·</span>
          <span>{otp.change}</span>
        </p>
      </div>
      <figcaption className={shared.illustrative}>Aperçu illustratif</figcaption>
    </figure>
  );
}

function AsideCards() {
  return (
    <>
      <div className={styles.railCard}>
        <p className={styles.railCardTitle}>
          <CommentIcon aria-hidden="true" />
          {GUIDE.aside.questionTitle}
        </p>
        <p className={styles.railCardText}>{GUIDE.aside.questionText}</p>
        <PendingButton className={styles.railCardAction}>
          {GUIDE.aside.questionAction}
          <ExternalIcon aria-hidden="true" />
        </PendingButton>
      </div>
      <p className={styles.railNote}>
        {DOCS_UI.sourceNote}{" "}
        <a href={DOCS_SOURCE_URL} target="_blank" rel="noopener noreferrer">
          {DOCS_UI.editOnGitHub}
          <span className="bb-visually-hidden"> (nouvel onglet)</span>
        </a>
      </p>
    </>
  );
}

export function DocsAccount() {
  const toc = [...GUIDE.steps.map((step) => ({ id: step.id, label: step.short })), { id: "prochaines-etapes", label: "Prochaines étapes" }];

  return (
    <DocsLayout currentPath={DOCS_ACCOUNT_HREF} toc={toc} aside={<AsideCards />}>
      <div className={styles.topBar}>
        <nav className={shared.breadcrumb} aria-label="Fil d'Ariane">
          <ol>
            <li>
              <Link href="/docs">Docs</Link>
            </li>
            <li>
              <Link href="/docs#bien-demarrer">{GUIDE.section}</Link>
            </li>
            <li>
              <span aria-current="page">{GUIDE.breadcrumb}</span>
            </li>
          </ol>
        </nav>
      </div>
      <DocsSearch />

      <header className={styles.guideHeader}>
        <p className={styles.guideBadge}>
          <ClockIcon aria-hidden="true" />
          {GUIDE.badge}
        </p>
        <h1 className={styles.guideTitle}>{GUIDE.title}</h1>
        <p className={styles.heroLead}>{GUIDE.lead}</p>
        <p className={styles.status}>
          <InfoIcon aria-hidden="true" />
          <span>{GUIDE.status}</span>
        </p>
      </header>

      <article className={styles.guide} aria-label={GUIDE.title}>
        {GUIDE.steps.map((step, index) => (
          <section key={step.id} id={step.id} className={`${styles.step} ${styles.anchor}`} aria-labelledby={`${step.id}-titre`}>
            <h2 id={`${step.id}-titre`} className={styles.stepTitle}>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span>
                <span className="bb-visually-hidden">Étape {index + 1} : </span>
                {step.title}
              </span>
            </h2>
            <p className={styles.stepText}>
              <RichText text={step.text} />
            </p>

            {"items" in step && step.items && (
              <ul className={styles.stepList}>
                {step.items.map((item) => (
                  <li key={item.title}>
                    <CheckCircleIcon aria-hidden="true" />
                    <span>
                      <strong>{item.title}&nbsp;:</strong> <RichText text={item.text} />
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {"note" in step && step.note && (
              <aside className={styles.callout} data-tone="info">
                <InfoIcon aria-hidden="true" />
                <div>
                  <p className={styles.calloutTitle}>{step.note.title}</p>
                  <p className={styles.calloutText}>{step.note.text}</p>
                </div>
              </aside>
            )}

            {"tip" in step && step.tip && (
              <aside className={styles.callout} data-tone="tip">
                <MailIcon aria-hidden="true" />
                <div>
                  <p className={styles.calloutTitle}>{step.tip.title}</p>
                  <p className={styles.calloutText}>{step.tip.text}</p>
                </div>
              </aside>
            )}

            {"mock" in step && step.mock === "form" && <FormMock />}
            {"mock" in step && step.mock === "otp" && <OtpMock />}

            {"skills" in step && step.skills && (
              <div className={styles.skillsBox}>
                <ul className={styles.skills} aria-label="Exemple de compétences sélectionnées">
                  {step.skills.selected.map((skill) => (
                    <li key={skill} data-selected="">
                      <CheckIcon aria-hidden="true" />
                      {skill}
                    </li>
                  ))}
                  {step.skills.suggested.map((skill) => (
                    <li key={skill}>
                      <PlusIcon aria-hidden="true" />
                      {skill}
                    </li>
                  ))}
                </ul>
                <p className={shared.illustrative}>Aperçu illustratif</p>
              </div>
            )}
          </section>
        ))}

        <nav id="prochaines-etapes" className={`${styles.pagination} ${styles.anchor}`} aria-label="Pages précédente et suivante">
          <Link href={GUIDE.pagination.previous.href} className={styles.pageLink}>
            <span className={styles.pageDirection}>
              <ArrowLeftIcon aria-hidden="true" />
              Précédent
            </span>
            <strong>{GUIDE.pagination.previous.label}</strong>
            <span className={styles.pageText}>{GUIDE.pagination.previous.text}</span>
          </Link>
          <span className={styles.pageLink} data-next="" aria-disabled="true" title={DOCS_UI.soon}>
            <span className={styles.pageDirection}>
              Suivant · {DOCS_UI.soon}
              <ArrowRightIcon aria-hidden="true" />
            </span>
            <strong>{GUIDE.pagination.next.label}</strong>
            <span className={styles.pageText}>{GUIDE.pagination.next.text}</span>
          </span>
        </nav>

        <div className={styles.feedback}>
          <div>
            <p className={styles.feedbackQuestion}>{GUIDE.feedback.question}</p>
            <p className={styles.feedbackText}>{GUIDE.feedback.text}</p>
          </div>
          <div className={styles.feedbackButtons}>
            <PendingButton className={styles.feedbackButton}>
              <ThumbUpIcon aria-hidden="true" />
              {GUIDE.feedback.yes}
            </PendingButton>
            <PendingButton className={styles.feedbackButton}>
              <ThumbDownIcon aria-hidden="true" />
              {GUIDE.feedback.no}
            </PendingButton>
          </div>
        </div>

        <p className={styles.moreHelp}>
          <span>{GUIDE.help.title}</span>
          <PendingButton className={styles.moreHelpAction}>
            {GUIDE.help.action}
            <ExternalIcon aria-hidden="true" />
          </PendingButton>
        </p>
      </article>
    </DocsLayout>
  );
}
