"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCatalog, useCertificates, useClassrooms, useEnrollments, useMyClassrooms, useTeaching } from "@/features/learn/hooks";
import type { Classroom } from "@/features/learn/types";
import { plural } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { AwardIcon, CommunityIcon, ExternalIcon, LearnIcon, PlusIcon, SearchIcon, SparklesIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Skeleton, Spinner } from "../ui/States";
import { TabPanel, Tabs, useUrlTab } from "../ui/Tabs";
import ui from "../ui/ui.module.css";
import { CreateClassroomDialog } from "./ClassroomDialogs";
import { CourseCard, CourseCardSkeleton } from "./CourseCard";
import { CLASSROOM_PRIVACY, LEVELS, ROLE_LABELS } from "./labels";
import styles from "./Learn.module.css";

const TAB_IDS = ["catalogue", "mes-cours", "classes", "certificats"] as const;
const ISSUED = new Intl.DateTimeFormat("fr", { day: "numeric", month: "long", year: "numeric" });

function Grid({ children }: { children: React.ReactNode }) {
  return <div className={layout.grid}>{children}</div>;
}

function LoadingGrid() {
  return (
    <Grid>
      {[0, 1, 2, 3].map((i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </Grid>
  );
}

function More({ query, label }: { query: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown }; label: string }) {
  if (!query.hasNextPage) return null;
  return (
    <div className={layout.more}>
      {query.isFetchingNextPage ? (
        <Spinner label="Chargement de la suite" />
      ) : (
        <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => query.fetchNextPage()}>
          {label}
        </button>
      )}
    </div>
  );
}

function CatalogTab() {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [free, setFree] = useState("");
  const catalog = useCatalog({ q, level, free });
  const list = useMemo(() => catalog.data?.pages.flatMap((p) => p.results) ?? [], [catalog.data]);
  const filtered = Boolean(q.trim() || level || free);
  return (
    <>
      <div className={layout.toolbar}>
        <div className={layout.searchBox}>
          <SearchIcon />
          <input className={ui.input} type="search" placeholder="Rechercher un cours : Django, data, Flutter…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un cours" />
        </div>
      </div>
      <div className={layout.chips} role="group" aria-label="Filtres">
        <button type="button" className={ui.chip} aria-pressed={!level} onClick={() => setLevel("")}>
          Tous niveaux
        </button>
        {Object.entries(LEVELS).map(([value, label]) => (
          <button key={value} type="button" className={ui.chip} aria-pressed={level === value} onClick={() => setLevel(level === value ? "" : value)}>
            {label}
          </button>
        ))}
        <button type="button" className={ui.chip} aria-pressed={free === "true"} onClick={() => setFree(free === "true" ? "" : "true")}>
          Gratuits
        </button>
      </div>
      {catalog.isPending ? (
        <LoadingGrid />
      ) : catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<LearnIcon />}
          title={filtered ? "Aucun cours ne correspond" : "Aucun cours publié pour l'instant"}
          text={filtered ? "Essayez un autre mot ou retirez un filtre." : "Les cours des classes publiques apparaîtront ici dès leur publication."}
        />
      ) : (
        <>
          <Grid>
            {list.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </Grid>
          <More query={catalog} label="Afficher plus de cours" />
        </>
      )}
    </>
  );
}

function MyCoursesTab({ goCatalog }: { goCatalog: () => void }) {
  const enrollments = useEnrollments();
  const teaching = useTeaching();
  const enrolled = useMemo(() => (enrollments.data?.pages.flatMap((p) => p.results) ?? []).filter((e) => e.status !== "dropped"), [enrollments.data]);
  const taught = useMemo(() => teaching.data?.pages.flatMap((p) => p.results) ?? [], [teaching.data]);
  if (enrollments.isPending || teaching.isPending) return <LoadingGrid />;
  if (enrollments.isError) return <ErrorState error={enrollments.error} onRetry={() => enrollments.refetch()} />;
  if (enrolled.length === 0 && taught.length === 0) {
    return (
      <EmptyState
        icon={<LearnIcon />}
        title="Vous ne suivez aucun cours"
        text="Inscrivez-vous à un cours du catalogue : votre progression s'affichera ici et dans le menu latéral."
        actions={
          <button type="button" className={cx(ui.button, ui.primary)} onClick={goCatalog}>
            <SparklesIcon />
            Voir le catalogue
          </button>
        }
      />
    );
  }
  return (
    <>
      {enrolled.length > 0 && (
        <section aria-labelledby="cours-suivis" className={layout.stack}>
          <h2 id="cours-suivis" className={layout.sectionTitle}>
            Cours suivis
          </h2>
          <Grid>
            {enrolled.map((e) => (
              <CourseCard key={e.course.id} course={e.course} progress={e.progress} />
            ))}
          </Grid>
          <More query={enrollments} label="Afficher plus" />
        </section>
      )}
      {taught.length > 0 && (
        <section aria-labelledby="cours-enseignes" className={layout.stack}>
          <h2 id="cours-enseignes" className={layout.sectionTitle}>
            Cours que j&apos;enseigne
          </h2>
          <Grid>
            {taught.map((c) => (
              <CourseCard key={c.id} course={c} showStatus />
            ))}
          </Grid>
          <More query={teaching} label="Afficher plus" />
        </section>
      )}
    </>
  );
}

function ClassroomRow({ classroom }: { classroom: Classroom }) {
  return (
    <li>
      <Link href={ROUTES.classroom(classroom.slug)} className={layout.person} style={{ textDecoration: "none" }}>
        <Avatar name={classroom.title} size={44} />
        <span className={layout.personText}>
          <span className={layout.personName}>{classroom.title}</span>
          <span className={layout.personMeta}>
            {CLASSROOM_PRIVACY[classroom.privacy].label} · {plural(classroom.member_count, "membre", "membres")} · {plural(classroom.course_count, "cours", "cours")}
          </span>
        </span>
        <span className={layout.personActions}>
          {classroom.my_status === "pending" ? (
            <Pill tone="amber">Demande envoyée</Pill>
          ) : classroom.my_role ? (
            <Pill tone={classroom.my_role === "student" ? "neutral" : "brown"}>{ROLE_LABELS[classroom.my_role]}</Pill>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

function ClassesTab({ onCreate }: { onCreate: () => void }) {
  const [q, setQ] = useState("");
  const mine = useMyClassrooms();
  const discover = useClassrooms(q);
  const myList = useMemo(() => mine.data?.pages.flatMap((p) => p.results) ?? [], [mine.data]);
  const mySlugs = new Set(myList.map((c) => c.slug));
  const others = useMemo(() => (discover.data?.pages.flatMap((p) => p.results) ?? []).filter((c) => !mySlugs.has(c.slug)), [discover.data, mySlugs]);
  return (
    <>
      <div className={layout.pageHeader} style={{ alignItems: "flex-start" }}>
        <p className={layout.pageLead} style={{ maxWidth: "62ch", margin: 0 }}>
          Une classe réunit des enseignants et des élèves autour d&apos;un ou plusieurs cours : bootcamp, école, club, formation d&apos;entreprise.
        </p>
        <button type="button" className={cx(ui.button, ui.secondary)} onClick={onCreate}>
          <PlusIcon />
          Créer une classe
        </button>
      </div>
      {mine.isPending ? (
        <Skeleton height={120} radius={18} />
      ) : (
        myList.length > 0 && (
          <section aria-labelledby="mes-classes" className={layout.stack}>
            <h2 id="mes-classes" className={layout.sectionTitle}>
              Mes classes
            </h2>
            <ul className={layout.people}>
              {myList.map((c) => (
                <ClassroomRow key={c.slug} classroom={c} />
              ))}
            </ul>
          </section>
        )
      )}
      <section aria-labelledby="classes-publiques" className={layout.stack}>
        <h2 id="classes-publiques" className={layout.sectionTitle}>
          Classes publiques
        </h2>
        <div className={layout.searchBox}>
          <SearchIcon />
          <input className={ui.input} type="search" placeholder="Rechercher une classe…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une classe" />
        </div>
        {discover.isPending ? (
          <Skeleton height={120} radius={18} />
        ) : discover.isError ? (
          <ErrorState error={discover.error} onRetry={() => discover.refetch()} />
        ) : others.length === 0 ? (
          <EmptyState icon={<CommunityIcon />} title="Aucune autre classe publique" text="Créez la vôtre pour enseigner sur LE BAOBAB." />
        ) : (
          <ul className={layout.people}>
            {others.map((c) => (
              <ClassroomRow key={c.slug} classroom={c} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function CertificatesTab() {
  const certificates = useCertificates();
  if (certificates.isPending) return <LoadingGrid />;
  if (certificates.isError) return <ErrorState error={certificates.error} onRetry={() => certificates.refetch()} />;
  if (certificates.data.length === 0) {
    return <EmptyState icon={<AwardIcon />} title="Aucun certificat pour l'instant" text="Terminez un cours qui délivre un certificat : il apparaîtra ici, avec un lien de vérification à partager." />;
  }
  return (
    <Grid>
      {certificates.data.map((c) => (
        <article key={c.id} className={styles.certificate}>
          <AwardIcon width={28} height={28} style={{ color: "#a16207" }} aria-hidden="true" />
          <h3>{c.course}</h3>
          <p className={ui.hint} style={{ margin: 0 }}>
            Délivré le {ISSUED.format(new Date(c.issued_at))}
            {c.score_percent != null && ` · score ${Math.round(c.score_percent)} %`}
          </p>
          <p style={{ margin: 0 }}>
            Code de vérification&nbsp;: <span className={styles.code}>{c.verification_code}</span>
          </p>
          <Link href={ROUTES.certificate(c.verification_code)} className={cx(ui.button, ui.secondary, ui.small)} style={{ alignSelf: "flex-start" }} target="_blank">
            Page de vérification publique
            <ExternalIcon />
          </Link>
        </article>
      ))}
    </Grid>
  );
}

export function LearnPage() {
  const [tab, setTab] = useUrlTab(TAB_IDS);
  const [creating, setCreating] = useState(false);
  return (
    <div className={layout.page}>
      <header className={layout.pageHeader}>
        <div className={layout.pageHeaderMain}>
          <span className={layout.pageHeaderIcon} aria-hidden="true">
            <LearnIcon />
          </span>
          <div>
            <h1 className={layout.pageTitle}>Learn</h1>
            <p className={layout.pageLead}>Des cours conçus par et pour les développeurs africains, du premier programme à l&apos;expertise.</p>
          </div>
        </div>
      </header>
      <Tabs
        idPrefix="learn"
        label="Learn"
        value={tab}
        onChange={setTab}
        items={[
          { id: "catalogue", label: "Catalogue", Icon: SparklesIcon },
          { id: "mes-cours", label: "Mes cours", Icon: LearnIcon },
          { id: "classes", label: "Classes", Icon: CommunityIcon },
          { id: "certificats", label: "Certificats", Icon: AwardIcon },
        ]}
      />
      <TabPanel idPrefix="learn" id={tab} className={layout.stack}>
        {tab === "catalogue" && <CatalogTab />}
        {tab === "mes-cours" && <MyCoursesTab goCatalog={() => setTab("catalogue")} />}
        {tab === "classes" && <ClassesTab onCreate={() => setCreating(true)} />}
        {tab === "certificats" && <CertificatesTab />}
      </TabPanel>
      <CreateClassroomDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
