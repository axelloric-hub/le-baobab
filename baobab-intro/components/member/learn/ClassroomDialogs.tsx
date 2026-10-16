"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useClassroomMembership, useCreateClassroom } from "@/features/learn/hooks";
import type { ClassroomPrivacy, CourseLevel } from "@/features/learn/types";
import type { UserBrief } from "@/features/social/types";
import { ApiError, describeError, fieldError } from "@/lib/api/errors";
import { CURRENCIES, toMinor } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { AudiencePicker } from "../composer/AudiencePicker";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Field, slugify } from "../ui/Field";
import layout from "../ui/Page.module.css";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { CLASSROOM_PRIVACY, LANGUAGES, LEVELS } from "./labels";

/** Champ « Prix » : gratuit, ou montant + devise. Renvoie null tant que le montant est invalide. */
export function PriceField({ id, free, setFree, amount, setAmount, currency, setCurrency, label = "Accès" }: {
  id: string;
  free: boolean;
  setFree: (v: boolean) => void;
  amount: string;
  setAmount: (v: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
  label?: string;
}) {
  return (
    <fieldset className={layout.choices}>
      <legend className={ui.label}>{label}</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" className={ui.chip} aria-pressed={free} onClick={() => setFree(true)}>
          Gratuit
        </button>
        <button type="button" className={ui.chip} aria-pressed={!free} onClick={() => setFree(false)}>
          Payant
        </button>
      </div>
      {!free && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 110px", gap: 8, marginTop: 8 }}>
          <input id={id} className={ui.input} inputMode="decimal" placeholder="Prix" aria-label="Prix" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <select className={ui.select} aria-label="Devise" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}
    </fieldset>
  );
}

export function SlugInput({ id, prefix, value, onChange, error }: { id: string; prefix: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field id={id} label="Adresse" error={error} hint="Elle ne pourra plus changer.">
      <div className={layout.slugField}>
        <span className={layout.slugPrefix}>{prefix}</span>
        <input id={id} value={value} maxLength={80} onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} spellCheck={false} aria-invalid={Boolean(error) || undefined} />
      </div>
    </Field>
  );
}

export const slugError = (error: unknown) =>
  error instanceof ApiError && (error.code === "slug_taken" || error.code === "integrity") ? "Cette adresse est déjà prise : choisissez-en une autre." : fieldError(error, "slug");

/* ------------------------------------------------------------------ */
/* Créer une classe                                                    */
/* ------------------------------------------------------------------ */

export function CreateClassroomDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <CreateClassroom onClose={onClose} /> : null;
}

function CreateClassroom({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateClassroom();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<ClassroomPrivacy>("public");
  const [free, setFree] = useState(true);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("XAF");
  const effectiveSlug = slug ?? slugify(title);
  const price = free ? null : toMinor(amount, currency);
  const ready = title.trim().length >= 3 && /^[a-z0-9-]{3,80}$/.test(effectiveSlug) && (free || Boolean(price));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || create.isPending) return;
    create.mutate(
      { title: title.trim(), slug: effectiveSlug, description: description.trim(), privacy, is_paid: !free, price_minor: price, currency: free ? "" : currency },
      {
        onSuccess: (c) => {
          toast(`Classe « ${c.title} » créée.`, { tone: "success" });
          onClose();
          router.push(ROUTES.classroom(c.slug));
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={create.isPending}
      title="Créer une classe"
      footer={
        <button type="submit" form="create-classroom" className={cx(ui.button, ui.primary)} disabled={!ready || create.isPending}>
          {create.isPending ? "Création…" : "Créer la classe"}
        </button>
      }
    >
      <form id="create-classroom" className={layout.form} onSubmit={submit} noValidate>
        <Field id="classroom-title" label="Nom de la classe" hint="Par exemple : Bootcamp Python Douala 2026">
          <input id="classroom-title" data-autofocus className={ui.input} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <SlugInput id="classroom-slug" prefix="/learn/classes/" value={effectiveSlug} onChange={setSlug} error={slugError(create.error)} />
        <Field id="classroom-description" label="Description" optional>
          <textarea id="classroom-description" className={ui.textarea} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <fieldset className={layout.choices}>
          <legend className={ui.label}>Qui peut entrer&nbsp;?</legend>
          {(Object.keys(CLASSROOM_PRIVACY) as ClassroomPrivacy[]).map((value) => (
            <label key={value} className={layout.choice}>
              <input type="radio" name="classroom-privacy" checked={privacy === value} onChange={() => setPrivacy(value)} />
              <span>
                <strong>{CLASSROOM_PRIVACY[value].label}</strong>
                <small>{CLASSROOM_PRIVACY[value].hint}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <PriceField id="classroom-price" free={free} setFree={setFree} amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} label="Accès à la classe" />
        {create.error && !slugError(create.error) && (
          <p className={ui.fieldError} role="alert">
            {describeError(create.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Créer un cours dans une classe                                      */
/* ------------------------------------------------------------------ */

export function CreateCourseDialog({ classroom, open, onClose }: { classroom: string; open: boolean; onClose: () => void }) {
  return open ? <CreateCourse classroom={classroom} onClose={onClose} /> : null;
}

function CreateCourse({ classroom, onClose }: { classroom: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { createCourse } = useClassroomMembership(classroom);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<CourseLevel>("beginner");
  const [language, setLanguage] = useState("fr");
  const [certificate, setCertificate] = useState(true);
  const [free, setFree] = useState(true);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("XAF");
  const effectiveSlug = slug ?? slugify(title);
  const price = free ? null : toMinor(amount, currency);
  const ready = title.trim().length >= 3 && /^[a-z0-9-]{2,80}$/.test(effectiveSlug) && (free || Boolean(price));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || createCourse.isPending) return;
    createCourse.mutate(
      { title: title.trim(), slug: effectiveSlug, description: description.trim(), level, language, certificate_enabled: certificate, is_free: free, price_minor: price, currency: free ? "" : currency },
      {
        onSuccess: (c) => {
          toast("Cours créé : ajoutez maintenant ses modules et chapitres.", { tone: "success" });
          onClose();
          router.push(ROUTES.course(c.id));
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={createCourse.isPending}
      title="Créer un cours"
      footer={
        <button type="submit" form="create-course" className={cx(ui.button, ui.primary)} disabled={!ready || createCourse.isPending}>
          {createCourse.isPending ? "Création…" : "Créer le cours"}
        </button>
      }
    >
      <form id="create-course" className={layout.form} onSubmit={submit} noValidate>
        <Field id="course-title" label="Titre du cours">
          <input id="course-title" data-autofocus className={ui.input} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Construire une API REST avec Django" />
        </Field>
        <SlugInput id="course-slug" prefix="adresse : " value={effectiveSlug} onChange={setSlug} error={slugError(createCourse.error)} />
        <Field id="course-description" label="Description" optional hint="Ce que l'élève saura faire à la fin, les prérequis.">
          <textarea id="course-description" className={ui.textarea} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12 }}>
          <Field id="course-level" label="Niveau">
            <select id="course-level" className={ui.select} value={level} onChange={(e) => setLevel(e.target.value as CourseLevel)}>
              {(Object.keys(LEVELS) as CourseLevel[]).map((l) => (
                <option key={l} value={l}>
                  {LEVELS[l]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="course-language" label="Langue">
            <select id="course-language" className={ui.select} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {Object.entries(LANGUAGES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <PriceField id="course-price" free={free} setFree={setFree} amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} label="Prix du cours complet" />
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5 }}>
          <input type="checkbox" checked={certificate} onChange={(e) => setCertificate(e.target.checked)} />
          Délivrer un certificat vérifiable à la fin du cours
        </label>
        {createCourse.error && !slugError(createCourse.error) && (
          <p className={ui.fieldError} role="alert">
            {describeError(createCourse.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Inviter dans une classe                                             */
/* ------------------------------------------------------------------ */

export function InviteToClassroomDialog({ classroom, open, onClose }: { classroom: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { invite } = useClassroomMembership(classroom);
  const [people, setPeople] = useState<UserBrief[]>([]);
  const [role, setRole] = useState("student");
  const send = async () => {
    let sent = 0;
    for (const person of people) {
      try {
        await invite.mutateAsync({ username: person.username, role });
        sent += 1;
      } catch (error) {
        toast(`${person.display_name || person.username} : ${describeError(error)}`, { tone: "error" });
      }
    }
    if (sent) toast(sent > 1 ? `${sent} invitations envoyées.` : "Invitation envoyée.", { tone: "success" });
    setPeople([]);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={invite.isPending}
      title="Inviter dans la classe"
      footer={
        <button type="button" className={cx(ui.button, ui.primary)} onClick={send} disabled={people.length === 0 || invite.isPending}>
          Inviter
        </button>
      }
    >
      <div className={layout.form}>
        <AudiencePicker value={people} onChange={setPeople} />
        <Field id="classroom-invite-role" label="Rôle">
          <select id="classroom-invite-role" className={ui.select} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">Élève</option>
            <option value="assistant">Assistant</option>
            <option value="instructor">Enseignant</option>
          </select>
        </Field>
      </div>
    </Dialog>
  );
}
