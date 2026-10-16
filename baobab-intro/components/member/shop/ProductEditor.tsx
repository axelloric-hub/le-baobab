"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useCourse, useMyClassrooms, useTeaching } from "@/features/learn/hooks";
import { useProductMutations } from "@/features/shop/hooks";
import type { ProductDetail, Variant } from "@/features/shop/types";
import { describeError, fieldError } from "@/lib/api/errors";
import { CURRENCIES, formatMoney, toInput, toMinor } from "@/lib/money";
import { uploadFile } from "@/lib/uploads/upload";
import { SkillPicker } from "../profile/PortfolioDialogs";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { CheckIcon, ClockIcon, FileIcon, ImageIcon, LearnIcon, PenIcon, PlusIcon, TagIcon, TrashIcon, UploadIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { fileSize, LICENSE_LABELS, PLATFORMS, SCOPE_LABELS } from "./labels";
import { makeSku } from "./ShopDialogs";
import styles from "./Shop.module.css";

/* ------------------------------------------------------------------ */
/* Modifier le produit                                                 */
/* ------------------------------------------------------------------ */

export function EditProductDialog({ product, open, onClose }: { product: ProductDetail; open: boolean; onClose: () => void }) {
  return open ? <EditProduct product={product} onClose={onClose} /> : null;
}

function EditProduct({ product, onClose }: { product: ProductDetail; onClose: () => void }) {
  const toast = useToast();
  const { update } = useProductMutations(product.id);
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description);
  const [docs, setDocs] = useState(product.documentation_url);
  const [license, setLicense] = useState(product.license_type);
  const [skills, setSkills] = useState(product.skills);
  const licensed = product.kind !== "service" && product.kind !== "course";
  const docsOk = !docs.trim() || /^https?:\/\/\S+\.\S+/.test(docs.trim());
  const ready = title.trim().length >= 3 && docsOk;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    update.mutate(
      { title: title.trim(), description: description.trim(), documentation_url: docs.trim(), skills: skills.map((s) => s.slug), ...(licensed ? { license_type: license } : {}) },
      {
        onSuccess: () => {
          toast("Produit mis à jour.", { tone: "success" });
          onClose();
        },
      },
    );
  };
  return (
    <Dialog
      open
      onClose={onClose}
      busy={update.isPending}
      title="Modifier le produit"
      footer={
        <button type="submit" form="edit-product" className={cx(ui.button, ui.primary)} disabled={!ready || update.isPending}>
          {update.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      }
    >
      <form id="edit-product" className={layout.form} onSubmit={submit}>
        <Field id="ep-title" label="Titre" error={fieldError(update.error, "title")}>
          <input id="ep-title" data-autofocus className={ui.input} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field id="ep-description" label="Description" optional error={fieldError(update.error, "description")} hint="Ce que l'acheteur obtient, pour qui, prérequis, support.">
          <textarea id="ep-description" className={ui.textarea} style={{ minHeight: 180 }} maxLength={20000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div>
          <span className={ui.label}>Technologies</span>
          <SkillPicker value={skills} onChange={setSkills} max={20} />
        </div>
        <Field id="ep-docs" label="Documentation" optional error={fieldError(update.error, "documentation_url") ?? (docsOk ? undefined : "Adresse invalide.")}>
          <input id="ep-docs" className={ui.input} type="url" inputMode="url" placeholder="https://" value={docs} onChange={(e) => setDocs(e.target.value)} />
        </Field>
        {licensed && (
          <Field id="ep-license" label="Licence">
            <select id="ep-license" className={ui.select} value={license} onChange={(e) => setLicense(e.target.value as typeof license)}>
              {(["personal", "team", "commercial"] as const).map((l) => (
                <option key={l} value={l}>
                  {LICENSE_LABELS[l]}
                </option>
              ))}
            </select>
          </Field>
        )}
        {update.isError && (
          <p className={ui.fieldError} role="alert">
            {describeError(update.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Offre (variante) : ajout ou modification                            */
/* ------------------------------------------------------------------ */

export function VariantDialog({ product, variant, open, onClose }: { product: ProductDetail; variant: Variant | null; open: boolean; onClose: () => void }) {
  return open ? <VariantForm product={product} variant={variant} onClose={onClose} /> : null;
}

function VariantForm({ product, variant, onClose }: { product: ProductDetail; variant: Variant | null; onClose: () => void }) {
  const toast = useToast();
  const { addVariant, updateVariant } = useProductMutations(product.id);
  const lockedCurrency = product.variants[0]?.currency;
  const [name, setName] = useState(variant?.name ?? "");
  const [currency, setCurrency] = useState(variant?.currency ?? lockedCurrency ?? "XAF");
  const [amount, setAmount] = useState(variant ? toInput(variant.price_minor, variant.currency) : "");
  const [limited, setLimited] = useState(variant?.stock !== null && variant?.stock !== undefined);
  const [stock, setStock] = useState(variant?.stock != null ? String(variant.stock) : "");
  const price = amount.trim() === "" ? null : toMinor(amount, currency);
  const stockValue = limited ? Number.parseInt(stock, 10) : null;
  const ready = name.trim().length >= 2 && price !== null && (!limited || (Number.isInteger(stockValue) && (stockValue ?? -1) >= 0));
  const pending = addVariant.isPending || updateVariant.isPending;
  const error = addVariant.error ?? updateVariant.error;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready || price === null) return;
    const done = {
      onSuccess: () => {
        toast(variant ? "Offre mise à jour." : "Offre ajoutée.", { tone: "success" });
        onClose();
      },
    };
    if (variant) updateVariant.mutate({ variant: variant.id, name: name.trim(), price_minor: price, stock: stockValue }, done);
    else addVariant.mutate({ sku: makeSku(`${product.title}-${name}`), name: name.trim(), price_minor: price, currency, stock: stockValue }, done);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      busy={pending}
      title={variant ? "Modifier l'offre" : "Nouvelle offre"}
      footer={
        <button type="submit" form="variant-form" className={cx(ui.button, ui.primary)} disabled={!ready || pending}>
          {pending ? "Enregistrement…" : variant ? "Enregistrer" : "Ajouter l'offre"}
        </button>
      }
    >
      <form id="variant-form" className={layout.form} onSubmit={submit}>
        <Field id="vf-name" label="Nom de l'offre" hint="ex. : Standard, Équipe (5 postes), Avec accompagnement" error={fieldError(error, "name")}>
          <input id="vf-name" data-autofocus className={ui.input} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 110px", gap: 8 }}>
          <Field id="vf-price" label="Prix" hint="0 pour une offre gratuite" error={fieldError(error, "price_minor") ?? (amount && price === null ? "Montant invalide." : undefined)}>
            <input id="vf-price" className={ui.input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field id="vf-currency" label="Devise" hint={lockedCurrency && !variant ? "Même devise" : undefined}>
            <select id="vf-currency" className={ui.select} value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={Boolean(variant || lockedCurrency)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={limited} onChange={(e) => setLimited(e.target.checked)} />
          Quantité limitée (places d&apos;un atelier, exemplaires…)
        </label>
        {limited && (
          <Field id="vf-stock" label="Quantité disponible" error={fieldError(error, "stock")}>
            <input id="vf-stock" className={ui.input} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} />
          </Field>
        )}
        {error && !fieldError(error, "name") && (
          <p className={ui.fieldError} role="alert">
            {describeError(error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Nouvelle version (application, logiciel, template…)                 */
/* ------------------------------------------------------------------ */

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

interface Pending {
  name: string;
  size: number;
  progress: number;
  id?: string;
  checksum?: string;
  error?: string;
}

export function ReleaseDialog({ product, open, onClose }: { product: ProductDetail; open: boolean; onClose: () => void }) {
  return open ? <ReleaseForm product={product} onClose={onClose} /> : null;
}

function ReleaseForm({ product, onClose }: { product: ProductDetail; onClose: () => void }) {
  const toast = useToast();
  const { addRelease } = useProductMutations(product.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState("");
  const [platform, setPlatform] = useState(product.latest_release?.platform ?? "any");
  const [changelog, setChangelog] = useState("");
  const [requirements, setRequirements] = useState(product.latest_release?.requirements ?? "");
  const [install, setInstall] = useState(product.latest_release?.installation_instructions ?? "");
  const [files, setFiles] = useState<Pending[]>([]);
  const uploading = files.some((f) => !f.id && !f.error);
  const done = files.filter((f) => f.id && f.checksum);
  const ready = version.trim().length > 0 && done.length > 0 && !uploading;

  const add = async (list: FileList) => {
    const base = files.length;
    for (const [i, file] of Array.from(list).slice(0, 20 - base).entries()) {
      const index = base + i;
      setFiles((x) => [...x, { name: file.name, size: file.size, progress: 0 }]);
      const patch = (p: Partial<Pending>) => setFiles((x) => x.map((y, j) => (j === index ? { ...y, ...p } : y)));
      try {
        const checksum = await sha256(file);
        const id = await uploadFile(file, "product_asset", { onProgress: (progress) => patch({ progress }) });
        patch({ id, checksum, progress: 1 });
      } catch (error) {
        patch({ error: describeError(error) });
      }
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    addRelease.mutate(
      {
        version: version.trim(),
        platform,
        changelog: changelog.trim(),
        requirements: requirements.trim(),
        installation_instructions: install.trim(),
        assets: done.map((f) => ({ file: f.id, checksum_sha256: f.checksum })),
      },
      {
        onSuccess: () => {
          toast(`Version ${version.trim()} publiée.`, { tone: "success" });
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={addRelease.isPending || uploading}
      title="Nouvelle version"
      footer={
        <button type="submit" form="release-form" className={cx(ui.button, ui.primary)} disabled={!ready || addRelease.isPending}>
          {addRelease.isPending ? "Publication…" : "Publier la version"}
        </button>
      }
    >
      <form id="release-form" className={layout.form} onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Field id="rf-version" label="Version" hint="ex. : 1.0.0" error={fieldError(addRelease.error, "version")}>
            <input id="rf-version" data-autofocus className={ui.input} maxLength={40} value={version} onChange={(e) => setVersion(e.target.value)} />
          </Field>
          <Field id="rf-platform" label="Plateforme">
            <select id="rf-platform" className={ui.select} value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {Object.entries(PLATFORMS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className={layout.stack} style={{ gap: 6 }}>
          <span className={ui.label}>Fichiers</span>
          {files.map((f, i) => (
            <div key={i} className={styles.fileRow}>
              <FileIcon aria-hidden="true" width={18} height={18} />
              <span>
                <strong>{f.name}</strong>
                <small>{f.error ?? (f.id ? `${fileSize(f.size)} · empreinte SHA-256 calculée` : `Envoi… ${Math.round(f.progress * 100)} %`)}</small>
              </span>
              <button type="button" className={ui.iconButton} aria-label={`Retirer ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                <TrashIcon />
              </button>
            </div>
          ))}
          <button type="button" className={cx(ui.button, ui.secondary, ui.small)} style={{ alignSelf: "flex-start" }} onClick={() => fileRef.current?.click()} disabled={files.length >= 20}>
            <UploadIcon />
            Ajouter des fichiers (ZIP, PDF, APK, DMG… 1 Go max.)
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            onChange={(e) => {
              if (e.target.files) void add(e.target.files);
              e.target.value = "";
            }}
          />
          <p className={ui.hint} style={{ margin: 0 }}>
            Les acheteurs téléchargent ces fichiers avec leur licence ; l&apos;empreinte SHA-256 leur permet d&apos;en vérifier l&apos;intégrité.
          </p>
        </div>
        <Field id="rf-changelog" label="Nouveautés" optional>
          <textarea id="rf-changelog" className={ui.textarea} maxLength={20000} value={changelog} onChange={(e) => setChangelog(e.target.value)} />
        </Field>
        <Field id="rf-requirements" label="Prérequis" optional>
          <textarea id="rf-requirements" className={ui.textarea} maxLength={5000} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
        </Field>
        <Field id="rf-install" label="Installation" optional>
          <textarea id="rf-install" className={ui.textarea} maxLength={10000} value={install} onChange={(e) => setInstall(e.target.value)} />
        </Field>
        {addRelease.isError && (
          <p className={ui.fieldError} role="alert">
            {describeError(addRelease.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Ce que l'achat débloque (formation Learn)                           */
/* ------------------------------------------------------------------ */

export function TargetDialog({ product, open, onClose }: { product: ProductDetail; open: boolean; onClose: () => void }) {
  return open ? <TargetForm product={product} onClose={onClose} /> : null;
}

function TargetForm({ product, onClose }: { product: ProductDetail; onClose: () => void }) {
  const toast = useToast();
  const { addTarget } = useProductMutations(product.id);
  const teaching = useTeaching();
  const classrooms = useMyClassrooms();
  const courses = useMemo(() => teaching.data?.pages.flatMap((p) => p.results) ?? [], [teaching.data]);
  const ownClassrooms = useMemo(
    () => (classrooms.data?.pages.flatMap((p) => p.results) ?? []).filter((c) => c.my_role === "owner" || c.my_role === "instructor"),
    [classrooms.data],
  );
  const [kind, setKind] = useState<"course" | "classroom">("course");
  const [course, setCourse] = useState("");
  const [part, setPart] = useState("course");
  const [classroom, setClassroom] = useState("");
  const outline = useCourse(kind === "course" ? course : "");
  const taken = new Set(product.targets.map((t) => t.target_id));

  const target = kind === "classroom" ? (classroom ? { scope: "classroom", target: classroom } : null) : !course ? null : part === "course" ? { scope: "course", target: course } : { scope: part.split(":")[0], target: part.split(":")[1] };
  const ready = Boolean(target) && !taken.has(target!.target);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready || !target) return;
    addTarget.mutate(target, {
      onSuccess: () => {
        toast("Contenu associé au produit.", { tone: "success" });
        onClose();
      },
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={addTarget.isPending}
      title="Ce que l'achat débloque"
      footer={
        <button type="submit" form="target-form" className={cx(ui.button, ui.primary)} disabled={!ready || addTarget.isPending}>
          {addTarget.isPending ? "Association…" : "Associer"}
        </button>
      }
    >
      <form id="target-form" className={layout.form} onSubmit={submit}>
        <div className={layout.chips} role="group" aria-label="Type de contenu">
          <button type="button" className={ui.chip} aria-pressed={kind === "course"} onClick={() => setKind("course")}>
            Un cours (ou une partie)
          </button>
          <button type="button" className={ui.chip} aria-pressed={kind === "classroom"} onClick={() => setKind("classroom")}>
            Une classe entière
          </button>
        </div>
        {kind === "course" ? (
          teaching.isPending ? (
            <p className={ui.hint}>Chargement de vos cours…</p>
          ) : courses.length === 0 ? (
            <p className={ui.hint}>Vous n&apos;enseignez encore aucun cours. Créez-en un dans Learn, puis revenez l&apos;associer.</p>
          ) : (
            <>
              <Field id="tf-course" label="Cours">
                <select
                  id="tf-course"
                  className={ui.select}
                  value={course}
                  onChange={(e) => {
                    setCourse(e.target.value);
                    setPart("course");
                  }}
                >
                  <option value="">Choisir un cours…</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} — {c.classroom_title}
                    </option>
                  ))}
                </select>
              </Field>
              {course && (
                <Field id="tf-part" label="Accès vendu" hint="Le cours entier, ou seulement un module ou un chapitre.">
                  <select id="tf-part" className={ui.select} value={part} onChange={(e) => setPart(e.target.value)} disabled={outline.isPending}>
                    <option value="course">Tout le cours</option>
                    {(outline.data?.modules ?? []).map((m) => (
                      <optgroup key={m.id} label={`Module : ${m.title}`}>
                        <option value={`module:${m.id}`}>Tout le module « {m.title} »</option>
                        {m.chapters.map((ch) => (
                          <option key={ch.id} value={`chapter:${ch.id}`}>
                            Chapitre : {ch.title}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
              )}
            </>
          )
        ) : classrooms.isPending ? (
          <p className={ui.hint}>Chargement de vos classes…</p>
        ) : ownClassrooms.length === 0 ? (
          <p className={ui.hint}>Vous n&apos;êtes propriétaire ou enseignant d&apos;aucune classe.</p>
        ) : (
          <Field id="tf-classroom" label="Classe">
            <select id="tf-classroom" className={ui.select} value={classroom} onChange={(e) => setClassroom(e.target.value)}>
              <option value="">Choisir une classe…</option>
              {ownClassrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        {target && taken.has(target.target) && <p className={ui.hint}>Ce contenu est déjà débloqué par ce produit.</p>}
        {addTarget.isError && (
          <p className={ui.fieldError} role="alert">
            {describeError(addTarget.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Panneau vendeur : publication, offres, images, version, contenus    */
/* ------------------------------------------------------------------ */

export function SellerPanel({ product }: { product: ProductDetail }) {
  const toast = useToast();
  const m = useProductMutations(product.id);
  const mediaRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [variant, setVariant] = useState<Variant | null | undefined>(undefined);
  const [release, setRelease] = useState(false);
  const [target, setTarget] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const needsRelease = product.kind === "application" || product.kind === "software";
  const needsTarget = product.kind === "course";
  const activeVariants = product.variants.filter((v) => v.is_active !== false);
  const steps = [
    { label: "Au moins une offre active (prix)", done: activeVariants.length > 0 },
    ...(needsRelease ? [{ label: "Une version avec au moins un fichier", done: Boolean(product.latest_release?.files.length) }] : []),
    ...(needsTarget ? [{ label: "Au moins un cours, module, chapitre ou classe débloqué", done: product.targets.length > 0 }] : []),
    { label: "Une image de présentation (conseillé)", done: product.media.length > 0, optional: true },
  ];
  const publishable = steps.every((s) => s.done || s.optional);

  const upload = async (files: FileList) => {
    const list = Array.from(files).slice(0, 10);
    let added = 0;
    for (const [i, file] of list.entries()) {
      try {
        setUploading(i / list.length);
        const id = await uploadFile(file, "product_media", { onProgress: (p) => setUploading((i + p) / list.length) });
        await m.addMedia.mutateAsync(id);
        added += 1;
      } catch (error) {
        toast(`${file.name} : ${describeError(error)}`, { tone: "error" });
      }
    }
    setUploading(null);
    if (added) toast(added > 1 ? `${added} images ajoutées.` : "Image ajoutée.", { tone: "success" });
  };

  return (
    <section className={layout.panelCard} aria-labelledby="gestion-produit">
      <h2 id="gestion-produit" className={layout.panelTitle}>
        <PenIcon aria-hidden="true" />
        Gérer le produit
      </h2>
      <div className={layout.stack} style={{ gap: 14 }}>
        {product.status === "draft" && (
          <>
            <ul className={styles.checklist} aria-label="Avant de publier">
              {steps.map((s) => (
                <li key={s.label} data-done={s.done || undefined}>
                  {s.done ? <CheckIcon aria-hidden="true" /> : <ClockIcon aria-hidden="true" />}
                  <span>
                    {s.label}
                    <span className="bb-visually-hidden">{s.done ? " : fait" : " : à faire"}</span>
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={cx(ui.button, ui.primary)}
              disabled={!publishable || m.publish.isPending}
              onClick={() => m.publish.mutate(undefined, { onSuccess: () => toast("Produit publié : il est en vente.", { tone: "success" }), onError: (e) => toast(describeError(e), { tone: "error" }) })}
            >
              <CheckIcon />
              {m.publish.isPending ? "Publication…" : "Publier"}
            </button>
          </>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className={cx(ui.button, ui.secondary, ui.small)} onClick={() => setEditing(true)}>
            <PenIcon />
            Modifier
          </button>
          <button type="button" className={cx(ui.button, ui.secondary, ui.small)} onClick={() => mediaRef.current?.click()} disabled={uploading !== null}>
            <ImageIcon />
            {uploading !== null ? `Envoi… ${Math.round(uploading * 100)} %` : "Images"}
          </button>
          {product.kind !== "service" && product.kind !== "course" && (
            <button type="button" className={cx(ui.button, ui.secondary, ui.small)} onClick={() => setRelease(true)}>
              <UploadIcon />
              Nouvelle version
            </button>
          )}
          {needsTarget && (
            <button type="button" className={cx(ui.button, ui.secondary, ui.small)} onClick={() => setTarget(true)}>
              <LearnIcon />
              Contenu débloqué
            </button>
          )}
        </div>
        <input
          ref={mediaRef}
          type="file"
          hidden
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = "";
          }}
        />

        <div className={layout.stack} style={{ gap: 8 }}>
          <span className={ui.label} style={{ margin: 0 }}>
            Offres
          </span>
          {product.variants.map((v) => (
            <div key={v.id} className={styles.fileRow}>
              <TagIcon aria-hidden="true" width={18} height={18} />
              <span>
                <strong>
                  {v.name} · {v.price_minor === 0 ? "Gratuit" : formatMoney(v.price_minor, v.currency)}
                </strong>
                <small>
                  {v.is_active === false ? "Désactivée" : v.stock == null ? "Quantité illimitée" : `${v.stock} disponible${v.stock > 1 ? "s" : ""}`}
                </small>
              </span>
              <button type="button" className={ui.iconButton} aria-label={`Modifier l'offre ${v.name}`} onClick={() => setVariant(v)}>
                <PenIcon />
              </button>
              <button
                type="button"
                className={cx(ui.button, ui.ghost, ui.small)}
                disabled={m.updateVariant.isPending || (v.is_active !== false && activeVariants.length <= 1 && product.status === "published")}
                title={v.is_active !== false && activeVariants.length <= 1 && product.status === "published" ? "Un produit en vente garde au moins une offre active" : undefined}
                onClick={() => m.updateVariant.mutate({ variant: v.id, is_active: v.is_active === false }, { onError: (e) => toast(describeError(e), { tone: "error" }) })}
              >
                {v.is_active === false ? "Réactiver" : "Désactiver"}
              </button>
            </div>
          ))}
          <button type="button" className={cx(ui.button, ui.ghost, ui.small)} style={{ alignSelf: "flex-start" }} onClick={() => setVariant(null)}>
            <PlusIcon />
            Ajouter une offre
          </button>
        </div>

        {needsTarget && product.targets.length > 0 && (
          <div className={layout.stack} style={{ gap: 8 }}>
            <span className={ui.label} style={{ margin: 0 }}>
              Contenu débloqué
            </span>
            {product.targets.map((t) => (
              <div key={t.id} className={styles.fileRow}>
                <LearnIcon aria-hidden="true" width={18} height={18} />
                <span>
                  <strong>{t.label ?? "Contenu supprimé"}</strong>
                  <small>{SCOPE_LABELS[t.scope]}</small>
                </span>
                <button
                  type="button"
                  className={ui.iconButton}
                  aria-label={`Retirer ${t.label ?? "ce contenu"}`}
                  disabled={m.removeTarget.isPending}
                  onClick={() => m.removeTarget.mutate(t.id, { onError: (e) => toast(describeError(e), { tone: "error" }) })}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}

        {product.status === "published" && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <Pill tone="green">En vente</Pill>
            <button
              type="button"
              className={cx(ui.button, ui.ghost, ui.small)}
              disabled={m.update.isPending}
              onClick={() => m.update.mutate({ status: "draft" }, { onSuccess: () => toast("Produit retiré de la vente (brouillon).", { tone: "success" }), onError: (e) => toast(describeError(e), { tone: "error" }) })}
            >
              Retirer de la vente
            </button>
          </div>
        )}
      </div>
      <EditProductDialog product={product} open={editing} onClose={() => setEditing(false)} />
      <VariantDialog product={product} variant={variant ?? null} open={variant !== undefined} onClose={() => setVariant(undefined)} />
      <ReleaseDialog product={product} open={release} onClose={() => setRelease(false)} />
      <TargetDialog product={product} open={target} onClose={() => setTarget(false)} />
    </section>
  );
}
