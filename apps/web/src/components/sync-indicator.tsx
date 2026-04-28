"use client";

import { useEffect, useState } from "react";
import { rxdbHealthcheck } from "@/lib/rxdb";

type Status = "idle" | "ok" | "error";

/**
 * Pastille en haut de page indiquant l'état du stockage local.
 * Étapes ultérieures : refléter aussi l'état de sync avec le backend.
 */
export function SyncIndicator() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    let cancelled = false;
    rxdbHealthcheck()
      .then((ok) => {
        if (!cancelled) setStatus(ok ? "ok" : "error");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const color = status === "ok" ? "bg-green" : status === "error" ? "bg-red-500" : "bg-yellow-400";

  const label =
    status === "ok"
      ? "stockage local prêt"
      : status === "error"
        ? "stockage local indisponible"
        : "vérification…";

  return (
    <div className="flex items-center gap-2 text-sm text-foreground/70">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} aria-hidden />
      <span>{label}</span>
    </div>
  );
}
