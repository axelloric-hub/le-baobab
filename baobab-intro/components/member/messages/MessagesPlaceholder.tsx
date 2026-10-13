import { MessageIcon } from "../ui/icons";
import styles from "./Messages.module.css";

/** Ordinateur : volet droit quand aucune conversation n'est ouverte. */
export function MessagesPlaceholder() {
  return (
    <section className={styles.threadPane} aria-label="Aucune conversation ouverte">
      <div className={styles.placeholder}>
        <div>
          <span className={styles.placeholderIcon} aria-hidden="true">
            <MessageIcon />
          </span>
          <h2>Vos conversations</h2>
          <p>Choisissez une conversation à gauche, ou lancez-en une nouvelle avec « Nouveau ». Les messages arrivent en temps réel.</p>
        </div>
      </div>
    </section>
  );
}
