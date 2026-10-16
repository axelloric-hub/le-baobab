"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMe } from "@/features/me/me";
import { usePortfolio } from "@/features/people/hooks";
import { useShowcase, useShowcaseTechnologies } from "@/features/showcase/hooks";
import type { ShowcaseFilters, ShowcaseProject } from "@/features/showcase/types";
import { plural } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { PortfolioDialog } from "../profile/PortfolioDialogs";
import { cx } from "../ui/cx";
import { PenIcon, PlusIcon, ProjectIcon, SearchIcon, ShowcaseIcon, SparklesIcon, StarIcon, UserIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton, Spinner } from "../ui/States";
import { TabPanel, Tabs, useUrlTab } from "../ui/Tabs";
import ui from "../ui/ui.module.css";
import { visibilityOf } from "../ui/visibility";
import { ProjectCard, ProjectCardSkeleton } from "./ProjectCard";
import { PortfolioSettingsDialog } from "./ProjectDialogs";
import styles from "./Showcase.module.css";

const TAB_IDS = ["decouvrir", "mon-portfolio"] as const;

function LoadingGrid() {
  return (
    <div className={layout.grid}>
      {[0, 1, 2, 3].map((i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  );
}

type Paged = { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };

function More({ query }: { query: Paged }) {
  if (!query.hasNextPage) return null;
  return (
    <div className={layout.more}>
      {query.isFetchingNextPage ? (
        <Spinner label="Chargement de la suite" />
      ) : (
        <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => query.fetchNextPage()}>
          Afficher plus de projets
        </button>
      )}
    </div>
  );
}

function DiscoverTab({ onAdd }: { onAdd: () => void }) {
  const [q, setQ] = useState("");
  const [tech, setTech] = useState("");
  const [featured, setFeatured] = useState(false);
  const technologies = useShowcaseTechnologies();
  const filters: ShowcaseFilters = { q, tech, featured: featured ? "true" : "" };
  const projects = useShowcase(filters);
  const list = useMemo(() => projects.data?.pages.flatMap((p) => p.results) ?? [], [projects.data]);
  const filtered = Boolean(q.trim() || tech || featured);
  return (
    <>
      <div className={layout.toolbar}>
        <div className={layout.searchBox}>
          <SearchIcon />
          <input className={ui.input} type="search" placeholder="Rechercher un projet : paiement, santé, agritech…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un projet" />
        </div>
      </div>
      <div className={layout.chips} role="group" aria-label="Filtrer par technologie">
        <button type="button" className={ui.chip} aria-pressed={!tech && !featured} onClick={() => {
            setTech("");
            setFeatured(false);
          }}>
          Tous
        </button>
        <button type="button" className={ui.chip} aria-pressed={featured} onClick={() => setFeatured(!featured)}>
          <StarIcon aria-hidden="true" width={15} height={15} />
          Épinglés
        </button>
        {(technologies.data ?? []).map((t) => (
          <button key={t.slug} type="button" className={ui.chip} aria-pressed={tech === t.slug} onClick={() => setTech(tech === t.slug ? "" : t.slug)}>
            {t.name}
            <span style={{ opacity: 0.65 }}>{t.projects}</span>
          </button>
        ))}
      </div>
      {projects.isPending ? (
        <LoadingGrid />
      ) : projects.isError ? (
        <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<ShowcaseIcon />}
          title={filtered ? "Aucun projet ne correspond" : "Aucun projet présenté pour l'instant"}
          text={filtered ? "Essayez un autre mot ou retirez un filtre." : "Soyez le premier à présenter un projet : il apparaîtra ici pour toute la communauté."}
          actions={
            !filtered && (
              <button type="button" className={cx(ui.button, ui.primary)} onClick={onAdd}>
                <PlusIcon />
                Présenter un projet
              </button>
            )
          }
        />
      ) : (
        <>
          <div className={layout.grid}>
            {list.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
          <More query={projects} />
        </>
      )}
    </>
  );
}

function MyPortfolioTab({ username, onAdd }: { username: string; onAdd: () => void }) {
  const portfolio = usePortfolio(username);
  const mine = useShowcase({ user: username });
  const [settings, setSettings] = useState(false);
  const list = useMemo<ShowcaseProject[]>(() => {
    const all = mine.data?.pages.flatMap((p) => p.results) ?? [];
    return [...all].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
  }, [mine.data]);
  if (portfolio.isPending) return <Skeleton height={120} radius={18} />;
  if (portfolio.isError) return <ErrorState error={portfolio.error} onRetry={() => portfolio.refetch()} />;
  const pf = portfolio.data;
  const vis = visibilityOf(pf.visibility);
  const counts = [
    plural(list.length, "projet", "projets"),
    plural(pf.repositories.length, "dépôt", "dépôts"),
    plural(pf.experiences.length, "expérience", "expériences"),
    plural(pf.certificates.length, "certificat", "certificats"),
  ];
  return (
    <>
      <section className={cx(layout.panelCard, styles.portfolioCard)} aria-labelledby="mon-portfolio-titre">
        <div className={styles.portfolioText}>
          <h2 id="mon-portfolio-titre">{pf.title || "Mon portfolio"}</h2>
          <p>{pf.summary || (pf.title ? "Ajoutez une présentation : elle s'affiche en tête de votre portfolio." : "Ajoutez un titre et une présentation : ils s'affichent en tête de votre portfolio.")}</p>
          <p style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Pill tone={pf.visibility === "public" ? "green" : "neutral"}>
              <vis.Icon aria-hidden="true" width={14} height={14} />
              {vis.label}
            </Pill>
            <span className={ui.hint} style={{ margin: 0 }}>
              {counts.join(" · ")}
            </span>
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => setSettings(true)}>
            <PenIcon />
            Titre et visibilité
          </button>
          <Link href={ROUTES.profile(username)} className={cx(ui.button, ui.ghost)}>
            <UserIcon />
            Voir sur mon profil
          </Link>
        </div>
      </section>
      <div className={layout.pageHeader} style={{ alignItems: "center" }}>
        <h2 className={layout.sectionTitle} style={{ margin: 0 }}>
          Mes projets
        </h2>
        <button type="button" className={cx(ui.button, ui.primary)} onClick={onAdd}>
          <PlusIcon />
          Ajouter un projet
        </button>
      </div>
      {mine.isPending ? (
        <LoadingGrid />
      ) : mine.isError ? (
        <ErrorState error={mine.error} onRetry={() => mine.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<ProjectIcon />}
          title="Aucun projet dans votre portfolio"
          text="Présentez ce que vous avez construit : captures, technologies, lien vers le code et la démo. C'est la première chose que regardent les recruteurs."
          actions={
            <button type="button" className={cx(ui.button, ui.primary)} onClick={onAdd}>
              <PlusIcon />
              Ajouter mon premier projet
            </button>
          }
        />
      ) : (
        <>
          <div className={layout.grid}>
            {list.map((p) => (
              <ProjectCard key={p.id} project={p} showOwner={false} />
            ))}
          </div>
          <More query={mine} />
        </>
      )}
      <PortfolioSettingsDialog portfolio={pf} open={settings} onClose={() => setSettings(false)} />
    </>
  );
}

export function ShowcasePage() {
  const [tab, setTab] = useUrlTab(TAB_IDS);
  const me = useMe();
  const [adding, setAdding] = useState(false);
  const username = me.data?.username ?? "";
  return (
    <div className={layout.page}>
      <header className={layout.pageHeader}>
        <div className={layout.pageHeaderMain}>
          <span className={layout.pageHeaderIcon} aria-hidden="true">
            <ShowcaseIcon />
          </span>
          <div>
            <h1 className={layout.pageTitle}>Showcase</h1>
            <p className={layout.pageLead}>Les projets construits par la communauté : applications, API, outils et sites, avec leur code et leurs technologies.</p>
          </div>
        </div>
        <button type="button" className={cx(ui.button, ui.primary)} onClick={() => setAdding(true)} disabled={!username}>
          <PlusIcon />
          Présenter un projet
        </button>
      </header>
      <Tabs
        idPrefix="showcase"
        label="Showcase"
        value={tab}
        onChange={setTab}
        items={[
          { id: "decouvrir", label: "Découvrir", Icon: SparklesIcon },
          { id: "mon-portfolio", label: "Mon portfolio", Icon: ProjectIcon },
        ]}
      />
      <TabPanel idPrefix="showcase" id={tab} className={layout.stack}>
        {tab === "decouvrir" && <DiscoverTab onAdd={() => setAdding(true)} />}
        {tab === "mon-portfolio" && (username ? <MyPortfolioTab username={username} onAdd={() => setAdding(true)} /> : <Skeleton height={120} radius={18} />)}
      </TabPanel>
      {username && <PortfolioDialog kind={adding ? "projects" : null} username={username} onClose={() => setAdding(false)} />}
    </div>
  );
}
