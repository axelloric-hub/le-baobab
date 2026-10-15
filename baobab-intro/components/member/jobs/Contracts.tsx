"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useContracts, useMilestone } from "@/features/jobs/hooks";
import type { Contract, Milestone } from "@/features/jobs/types";
import { describeError } from "@/lib/api/errors";
import { currentUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { BriefcaseIcon } from "../ui/icons";
import layout from "../ui/Page.module.css";
import { Pill } from "../ui/Pill";
import { EmptyState, ErrorState, Spinner } from "../ui/States";
import { useToast } from "../ui/Toast";
import ui from "../ui/ui.module.css";
import { CONTRACT_STATUS, MILESTONE_STATUS } from "./labels";
import styles from "./Jobs.module.css";

const DAY = new Intl.DateTimeFormat("fr", { day: "numeric", month: "long", year: "numeric" });

/** Action possible sur un jalon pour MOI : démarrer et livrer (prestataire), valider (client). */
function nextAction(contract: Contract, milestone: Milestone, me: string | undefined) {
  if (contract.status !== "active") return null;
  const contractor = contract.contractor.username === me;
  if (contractor && milestone.status === "pending") return { action: "start" as const, label: "Démarrer" };
  if (contractor && milestone.status === "in_progress") return { action: "submit" as const, label: "Marquer comme livré" };
  if (!contractor && milestone.status === "submitted") return { action: "approve" as const, label: "Valider la livraison" };
  return null;
}

function ContractCard({ contract }: { contract: Contract }) {
  const me = currentUser()?.username;
  const toast = useToast();
  const advance = useMilestone();
  const other = contract.client.username === me ? contract.contractor : contract.client;
  const role = contract.client.username === me ? "Prestataire" : "Client";
  const status = CONTRACT_STATUS[contract.status] ?? CONTRACT_STATUS.active;
  return (
    <article className={layout.panelCard}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h3 className={styles.jobTitle}>{contract.title || (contract.kind === "freelance" ? "Mission freelance" : "Contrat de travail")}</h3>
          <p className={styles.jobOrg} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <Avatar name={other.display_name || other.username} src={other.avatar_url} size={24} />
            <span>
              {role}&nbsp;:{" "}
              <Link href={ROUTES.profile(other.username)} style={{ color: "inherit", fontWeight: 650 }}>
                {other.display_name || other.username}
              </Link>
            </span>
          </p>
        </div>
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>
      <p className={styles.jobOrg} style={{ marginTop: 8 }}>
        <strong>{formatMoney(contract.amount_minor, contract.currency)}</strong>
        {contract.start_date && ` · depuis le ${DAY.format(new Date(contract.start_date))}`}
      </p>
      {contract.milestones.length > 0 && (
        <ol className={styles.milestones} aria-label="Jalons">
          {contract.milestones.map((m) => {
            const ms = MILESTONE_STATUS[m.status] ?? MILESTONE_STATUS.pending;
            const next = nextAction(contract, m, me);
            return (
              <li key={m.id} className={styles.milestone}>
                <span>
                  {m.position}. {m.title}
                </span>
                <span>{formatMoney(m.amount_minor, contract.currency)}</span>
                <Pill tone={ms.tone}>{ms.label}</Pill>
                {next && (
                  <button
                    type="button"
                    className={cx(ui.button, ui.primary, ui.small)}
                    disabled={advance.isPending}
                    onClick={() =>
                      advance.mutate(
                        { id: m.id, action: next.action },
                        { onSuccess: () => toast("Jalon mis à jour.", { tone: "success" }), onError: (e) => toast(describeError(e), { tone: "error" }) },
                      )
                    }
                  >
                    {next.label}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}

/** Mes contrats (emploi ou mission), avec l'avancement des jalons. */
export function ContractsList() {
  const contracts = useContracts();
  const list = useMemo(() => contracts.data?.pages.flatMap((p) => p.results) ?? [], [contracts.data]);
  if (contracts.isPending) return <Spinner label="Chargement des contrats" />;
  if (contracts.isError) return <ErrorState error={contracts.error} onRetry={() => contracts.refetch()} />;
  if (list.length === 0) return <EmptyState icon={<BriefcaseIcon />} title="Aucun contrat" text="Un contrat est créé quand une offre d'embauche ou une proposition de mission est acceptée." />;
  return (
    <div className={styles.list}>
      {list.map((c) => (
        <ContractCard key={c.id} contract={c} />
      ))}
    </div>
  );
}
