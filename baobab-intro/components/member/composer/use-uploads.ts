"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeError } from "@/lib/api/errors";
import { checkFile, uploadFile, type UploadPurpose } from "@/lib/uploads/upload";

export interface UploadItem {
  key: string;
  file: File;
  preview: string;
  kind: "image" | "video" | "audio" | "file";
  progress: number;
  fileId?: string;
  error?: string;
  alt: string;
}

const kindOf = (type: string): UploadItem["kind"] => {
  const head = type.split("/")[0];
  return head === "image" || head === "video" || head === "audio" ? head : "file";
};

/**
 * Fichiers joints : vérification locale, envoi immédiat en arrière-plan (progression réelle),
 * annulation au retrait, libération des aperçus.
 */
export function useUploads(purpose: UploadPurpose, max: number) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());

  const patch = useCallback((key: string, update: Partial<UploadItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...update } : i))), []);

  const add = useCallback(
    async (files: FileList | File[]) => {
      const room = Math.max(0, max - items.length);
      for (const file of Array.from(files).slice(0, room)) {
        const key = `${file.name}-${file.size}-${crypto.randomUUID()}`;
        const item: UploadItem = { key, file, preview: URL.createObjectURL(file), kind: kindOf(file.type), progress: 0, alt: "" };
        setItems((list) => [...list, item]);
        const problem = await checkFile(file, purpose).catch(() => null);
        if (problem) {
          patch(key, { error: problem });
          continue;
        }
        const controller = new AbortController();
        controllers.current.set(key, controller);
        uploadFile(file, purpose, { signal: controller.signal, onProgress: (p) => patch(key, { progress: p }) })
          .then((fileId) => patch(key, { fileId, progress: 1 }))
          .catch((error) => {
            if (!controller.signal.aborted) patch(key, { error: describeError(error) });
          })
          .finally(() => controllers.current.delete(key));
      }
    },
    [items.length, max, patch, purpose],
  );

  const remove = useCallback((key: string) => {
    controllers.current.get(key)?.abort();
    setItems((list) => {
      const item = list.find((i) => i.key === key);
      if (item) URL.revokeObjectURL(item.preview);
      return list.filter((i) => i.key !== key);
    });
  }, []);

  const reset = useCallback(() => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    setItems((list) => {
      list.forEach((i) => URL.revokeObjectURL(i.preview));
      return [];
    });
  }, []);

  useEffect(() => () => controllers.current.forEach((c) => c.abort()), []);

  const busy = items.some((i) => !i.fileId && !i.error);
  const failed = items.some((i) => i.error);
  return { items, add, remove, reset, setAlt: (key: string, alt: string) => patch(key, { alt }), busy, failed };
}

/** Types acceptés par le sélecteur de fichiers (identiques au backend, apps/storage/services.py). */
export const ACCEPT = {
  post_media: "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/wav,application/pdf",
  status_image: "image/jpeg,image/png,image/webp,image/gif",
  status_video: "video/mp4,video/webm",
  status_audio: "audio/mpeg,audio/ogg,audio/wav",
};
