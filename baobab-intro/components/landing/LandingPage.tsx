import { HeroSection } from "./HeroSection";
import { IntroGate } from "./IntroGate";
import { LANDING_ROOT_ID } from "./intro-gate-script";
import { SiteHeader } from "./SiteHeader";
import { ChannelsSection } from "./sections/ChannelsSection";
import { CopilotSection } from "./sections/CopilotSection";
import { CtaBanner } from "./sections/CtaBanner";
import { FaqSection } from "./sections/FaqSection";
import { IntegrationsSection } from "./sections/IntegrationsSection";
import { ProblemSection } from "./sections/ProblemSection";
import { SecuritySection } from "./sections/SecuritySection";
import { SiteFooter } from "./sections/SiteFooter";
import { StatsSection } from "./sections/StatsSection";
import { WorkspaceSection } from "./sections/WorkspaceSection";
import styles from "./LandingPage.module.css";

/**
 * Landing page LE BAOBAB.
 * Composants serveur par défaut ; seuls sont clients : l'en-tête (menu mobile),
 * les onglets de l'espace de travail, les boutons « Voir l'intro » et la cinématique.
 */
export function LandingPage() {
  return (
    <>
      <div id={LANDING_ROOT_ID} className={styles.page}>
        <SiteHeader />
        <main className={styles.main}>
          <HeroSection />
          <ProblemSection />
          <ChannelsSection />
          <WorkspaceSection />
          <StatsSection />
          <CopilotSection />
          <IntegrationsSection />
          <SecuritySection />
          <FaqSection />
          <CtaBanner />
        </main>
        <SiteFooter />
      </div>
      <IntroGate />
    </>
  );
}
