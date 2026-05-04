/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
"use client";

import { Cookie, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "agriqodo:cookie-banner-dismissed";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") setVisible(true);
    } catch {
      // localStorage indisponible (mode privé strict) — on n'affiche pas
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Information cookies"
      className="fixed inset-x-2 bottom-2 z-[9200] mx-auto max-w-3xl rounded-2xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur sm:inset-x-4 sm:bottom-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green/10 text-green">
          <Cookie className="h-5 w-5" />
        </span>
        <div className="flex-1 text-sm">
          <p className="font-semibold">Stockage local pour faire tourner l'app</p>
          <p className="mt-1 text-foreground/70">
            Agri Qodo n'utilise <strong>aucun cookie publicitaire</strong> ni mesure d'audience
            tiers. On garde uniquement ce qu'il faut pour te garder connecté et sauvegarder tes
            préférences locales.{" "}
            <Link
              href="/cookies"
              className="font-medium text-green underline hover:text-green-dark"
            >
              Détail des stockages
            </Link>
            .
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-green px-4 text-sm font-semibold text-white hover:bg-green-dark"
          >
            J'ai compris
          </button>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="-m-1 rounded-full p-1 text-foreground/50 hover:bg-muted hover:text-foreground/80"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
