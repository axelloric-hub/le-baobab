"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckIcon, CloseIcon, SparklesIcon } from "./icons";
import styles from "./ui.module.css";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
  leaving?: boolean;
}

type ToastFn = (message: string, options?: { tone?: Tone; action?: ToastItem["action"]; duration?: number }) => void;

const ToastContext = createContext<ToastFn>(() => {});

/** Retour d'action discret (« Lien copié », « Publication enregistrée »), annoncé aux lecteurs d'écran. */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 220);
  }, []);

  const toast = useCallback<ToastFn>(
    (message, options = {}) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-2), { id, message, tone: options.tone ?? "info", action: options.action }]);
      window.setTimeout(() => dismiss(id), options.duration ?? (options.action ? 6000 : 3600));
    },
    [dismiss],
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.toastRegion} role="status" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={styles.toast} data-tone={item.tone} data-leaving={item.leaving || undefined}>
            {item.tone === "success" ? <CheckIcon /> : item.tone === "error" ? <CloseIcon /> : <SparklesIcon />}
            <span>{item.message}</span>
            {item.action && (
              <button
                type="button"
                className={styles.toastAction}
                onClick={() => {
                  item.action?.onClick();
                  dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
