"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useCreateStore, useStoreMutations } from "@/features/shop/hooks";
import type { ProductKind, Store } from "@/features/shop/types";
import { shopApi } from "@/features/shop/api";
import { describeError, fieldError } from "@/lib/api/errors";
import { toMinor } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { PriceField, SlugInput, slugError } from "../learn/ClassroomDialogs";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Field, slugify } from "../ui/Field";
import layout from "../ui/Page.module.css";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { KIND_HINTS, KIND_LABELS } from "./labels";

/* ------------------------------------------------------------------ */
/* Ouvrir une boutique                                                 */
/* ------------------------------------------------------------------ */

export function CreateStoreDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <CreateStore onClose={onClose} /> : null;
}

function CreateStore({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateStore();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const effectiveSlug = slug ?? slugify(name);
  const ready = name.trim().length >= 2 && /^[a-z0-9-]{3,80}$/.test(effectiveSlug);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready || create.isPending) return;
    create.mutate(
      { name: name.trim(), slug: effectiveSlug, description: description.trim() },
      {
        onSuccess: (st) => {
          toast(`Boutique « ${st.name} » ouverte.`, { tone: "success" });
          onClose();
          router.push(ROUTES.store(st.slug));
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={create.isPending}
      title="Ouvrir ma boutique"
      footer={
        <button type="submit" form="create-store" className={cx(ui.button, ui.primary)} disabled={!ready || create.isPending}>
          {create.isPending ? "Ouverture…" : "Ouvrir la boutique"}
        </button>
      }
    >
      <form id="create-store" className={layout.form} onSubmit={submit} noValidate>
        <Field id="store-name" label="Nom de la boutique" hint="Votre nom, votre studio ou votre marque : « Studio Kalaba », « Kits Django Dakar »…" error={fieldError(create.error, "name")}>
          <input id="store-name" data-autofocus className={ui.input} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <SlugInput id="store-slug" prefix="/boutique/b/" value={effectiveSlug} onChange={setSlug} error={slugError(create.error)} />
        <Field id="store-description" label="Présentation" optional error={fieldError(create.error, "description")}>
          <textarea id="store-description" className={ui.textarea} maxLength={5000} placeholder="Ce que vous vendez, pour qui, et comment vous accompagnez vos clients." value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
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
/* Modifier une boutique                                               */
/* ------------------------------------------------------------------ */

export function EditStoreDialog({ store, open, onClose }: { store: Store; open: boolean; onClose: () => void }) {
  return open ? <EditStore store={store} onClose={onClose} /> : null;
}

function EditStore({ store, onClose }: { store: Store; onClose: () => void }) {
  const toast = useToast();
  const { update } = useStoreMutations(store.slug);
  const [name, setName] = useState(store.name);
  const [description, setDescription] = useState(store.description);
  const ready = name.trim().length >= 2;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    update.mutate(
      { name: name.trim(), description: description.trim() },
      {
        onSuccess: () => {
          toast("Boutique mise à jour.", { tone: "success" });
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
      title="Modifier la boutique"
      footer={
        <button type="submit" form="edit-store" className={cx(ui.button, ui.primary)} disabled={!ready || update.isPending}>
          {update.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      }
    >
      <form id="edit-store" className={layout.form} onSubmit={submit}>
        <Field id="edit-store-name" label="Nom" error={fieldError(update.error, "name")}>
          <input id="edit-store-name" data-autofocus className={ui.input} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="edit-store-description" label="Présentation" optional error={fieldError(update.error, "description")}>
          <textarea id="edit-store-description" className={ui.textarea} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
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
/* Nouveau produit (brouillon + première offre)                        */
/* ------------------------------------------------------------------ */

const KINDS = Object.keys(KIND_LABELS) as ProductKind[];

/** Référence unique de l'offre : dérivée du titre + 4 caractères aléatoires (le vendeur n'a rien à inventer). */
export const makeSku = (title: string) => `${slugify(title, 40).toUpperCase() || "PRODUIT"}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export function CreateProductDialog({ store, open, onClose }: { store: string; open: boolean; onClose: () => void }) {
  return open ? <CreateProduct store={store} onClose={onClose} /> : null;
}

function CreateProduct({ store, onClose }: { store: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { createProduct } = useStoreMutations(store);
  const [kind, setKind] = useState<ProductKind>("template");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [license, setLicense] = useState<"personal" | "team" | "commercial">("personal");
  const [free, setFree] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("XAF");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const price = free ? 0 : toMinor(amount, currency);
  const licensed = kind !== "service" && kind !== "course";
  const ready = title.trim().length >= 3 && price !== null && (free || price > 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const slug = `${slugify(title, 70) || "produit"}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const product = await createProduct.mutateAsync({ kind, slug, title: title.trim(), description: description.trim(), ...(licensed ? { license_type: license } : {}) });
      try {
        await shopApi.addVariant(product.id, { sku: makeSku(title), name: "Standard", price_minor: price ?? 0, currency, stock: null });
      } catch (variantError) {
        toast(`Produit créé, mais le prix n'a pas pu être enregistré : ${describeError(variantError)}`, { tone: "error" });
      }
      toast("Brouillon créé : complétez-le puis publiez-le.", { tone: "success" });
      onClose();
      router.push(ROUTES.product(product.id));
    } catch (createError) {
      setError(createError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title="Nouveau produit"
      footer={
        <button type="submit" form="create-product" className={cx(ui.button, ui.primary)} disabled={!ready || busy}>
          {busy ? "Création…" : "Créer le brouillon"}
        </button>
      }
    >
      <form id="create-product" className={layout.form} onSubmit={submit} noValidate>
        <Field id="product-kind" label="Type de produit" hint={KIND_HINTS[kind]}>
          <select id="product-kind" className={ui.select} value={kind} onChange={(e) => setKind(e.target.value as ProductKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="product-title" label="Titre" error={fieldError(error, "title")}>
          <input id="product-title" data-autofocus className={ui.input} maxLength={160} placeholder="ex. : Kit de démarrage Django + Mobile Money" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field id="product-description" label="Description" optional error={fieldError(error, "description")}>
          <textarea id="product-description" className={ui.textarea} style={{ minHeight: 140 }} maxLength={20000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {licensed && (
          <Field id="product-license" label="Licence accordée à l'acheteur">
            <select id="product-license" className={ui.select} value={license} onChange={(e) => setLicense(e.target.value as typeof license)}>
              <option value="personal">Personnelle (un développeur)</option>
              <option value="team">Équipe</option>
              <option value="commercial">Commerciale (projets clients)</option>
            </select>
          </Field>
        )}
        <PriceField id="product-price" free={free} setFree={setFree} amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} label="Prix" />
        <p className={ui.hint} style={{ margin: 0 }}>
          Le produit est créé en brouillon : ajoutez des images{kind === "application" || kind === "software" ? ", une version téléchargeable" : ""}
          {kind === "course" ? ", le cours qu'il débloque" : ""} puis publiez-le.
        </p>
        {Boolean(error) && !fieldError(error, "title") && (
          <p className={ui.fieldError} role="alert">
            {describeError(error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}
