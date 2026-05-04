/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { ArrowLeft, Tractor } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LegalFooter } from "./legal-footer";

interface LegalPageShellProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export function LegalPageShell({ title, lastUpdated, children }: LegalPageShellProps) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm font-semibold text-green hover:text-green-dark"
          aria-label="Agri Qodo"
        >
          <Tractor className="h-4 w-4" />
          Agri Qodo
        </Link>
      </div>

      <article className="legal-article rounded-2xl border border-border bg-background p-6 sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm italic text-foreground/60">
          Dernière mise à jour : {lastUpdated}
        </p>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-foreground/80 sm:text-base [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground sm:[&_h2]:text-xl [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_li]:leading-relaxed [&_a]:font-medium [&_a]:text-green [&_a]:underline hover:[&_a]:text-green-dark [&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs sm:[&_table]:text-sm [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs">
          {children}
        </div>
      </article>

      <LegalFooter />
    </main>
  );
}
