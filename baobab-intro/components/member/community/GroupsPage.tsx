"use client";

import { useMemo, useState } from "react";
import { useCommunities, useDiscoverGroups, useMyGroupPages } from "@/features/community/hooks";
import type { Group } from "@/features/community/types";
import { InvitationsCard } from "../rail/RightRail";
import { cx } from "../ui/cx";
import { CommunityIcon, PlusIcon, SearchIcon, SparklesIcon } from "../ui/icons";
import { EmptyState, ErrorState, Spinner } from "../ui/States";
import { TabPanel, Tabs, useUrlTab } from "../ui/Tabs";
import ui from "../ui/ui.module.css";
import layout from "../ui/Page.module.css";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { GroupCard, GroupCardSkeleton } from "./GroupCard";

const TAB_IDS = ["decouvrir", "mes-groupes"] as const;

type Paged = ReturnType<typeof useMyGroupPages>;

function GroupGrid({ query, empty }: { query: Paged; empty: React.ReactNode }) {
  const groups = useMemo(() => query.data?.pages.flatMap((p) => p.results) ?? [], [query.data]);
  if (query.isPending) {
    return (
      <div className={layout.grid} aria-busy="true" aria-label="Chargement des groupes">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <GroupCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (query.isError && groups.length === 0) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (groups.length === 0) return <>{empty}</>;
  return (
    <>
      <div className={layout.grid}>
        {groups.map((group: Group) => (
          <GroupCard key={group.slug} group={group} />
        ))}
      </div>
      {query.hasNextPage && (
        <div className={layout.more}>
          {query.isFetchingNextPage ? (
            <Spinner label="Chargement de la suite" />
          ) : (
            <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => query.fetchNextPage()}>
              Afficher plus de groupes
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** « Communauté » : découvrir des groupes, retrouver les miens, en créer un. */
export function GroupsPage() {
  const [tab, setTab] = useUrlTab(TAB_IDS);
  const [search, setSearch] = useState("");
  const [community, setCommunity] = useState("");
  const [creating, setCreating] = useState(false);
  const communities = useCommunities();
  const discover = useDiscoverGroups(search, community);
  const mine = useMyGroupPages();
  const myCount = mine.data?.pages.reduce((n, p) => n + p.results.length, 0);
  const searching = search.trim().length >= 2 || Boolean(community);

  return (
    <div className={layout.page}>
      <header className={layout.pageHeader}>
        <div className={layout.pageHeaderMain}>
          <span className={layout.pageHeaderIcon} aria-hidden="true">
            <CommunityIcon />
          </span>
          <div>
            <h1 className={layout.pageTitle}>Communauté</h1>
            <p className={layout.pageLead}>Des groupes de développeurs africains pour apprendre, s&apos;entraider et construire ensemble.</p>
          </div>
        </div>
        <button type="button" className={cx(ui.button, ui.primary)} onClick={() => setCreating(true)}>
          <PlusIcon />
          Créer un groupe
        </button>
      </header>

      <Tabs
        idPrefix="groupes"
        label="Groupes"
        value={tab}
        onChange={setTab}
        items={[
          { id: "decouvrir", label: "Découvrir", Icon: SparklesIcon },
          { id: "mes-groupes", label: "Mes groupes", Icon: CommunityIcon, count: myCount },
        ]}
      />

      {tab === "decouvrir" ? (
        <TabPanel idPrefix="groupes" id="decouvrir" className={layout.stack}>
          <div className={layout.toolbar}>
            <div className={layout.searchBox}>
              <SearchIcon />
              <input
                className={ui.input}
                type="search"
                placeholder="Rechercher un groupe par son nom…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Rechercher un groupe"
              />
            </div>
          </div>
          {communities.data && communities.data.length > 0 && (
            <div className={layout.chips} role="group" aria-label="Filtrer par communauté">
              <button type="button" className={ui.chip} aria-pressed={!community} onClick={() => setCommunity("")}>
                Toutes
              </button>
              {communities.data.map((c) => (
                <button key={c.slug} type="button" className={ui.chip} aria-pressed={community === c.slug} onClick={() => setCommunity(community === c.slug ? "" : c.slug)} title={c.description || undefined}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <GroupGrid
            query={discover}
            empty={
              <EmptyState
                icon={<CommunityIcon />}
                title={searching ? "Aucun groupe ne correspond" : "Aucun groupe pour l'instant"}
                text={searching ? "Essayez un autre mot, ou créez le groupe qui manque." : "Lancez le premier groupe de la communauté : une techno, une ville, un projet…"}
                actions={
                  <button type="button" className={cx(ui.button, ui.primary)} onClick={() => setCreating(true)}>
                    <PlusIcon />
                    Créer un groupe
                  </button>
                }
              />
            }
          />
        </TabPanel>
      ) : (
        <TabPanel idPrefix="groupes" id="mes-groupes" className={layout.stack}>
          <InvitationsCard />
          <GroupGrid
            query={mine}
            empty={
              <EmptyState
                icon={<CommunityIcon />}
                title="Vous n'êtes membre d'aucun groupe"
                text="Rejoignez un groupe pour retrouver ses publications dans votre fil et échanger avec ses membres."
                actions={
                  <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => setTab("decouvrir")}>
                    <SparklesIcon />
                    Découvrir des groupes
                  </button>
                }
              />
            }
          />
        </TabPanel>
      )}

      <CreateGroupDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
