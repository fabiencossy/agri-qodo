/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import Link from "next/link";

const LINKS = [
  { href: "/cgu", label: "CGU" },
  { href: "/politique-confidentialite", label: "Confidentialité" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cookies", label: "Cookies" },
] as const;

export function LegalFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer
      className={
        compact
          ? "mt-6 text-center text-[11px] text-foreground/50"
          : "mt-12 border-t border-border pt-6 pb-8 text-center text-xs text-foreground/60"
      }
    >
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {LINKS.map((l, i) => (
          <span key={l.href} className="flex items-center gap-x-3">
            <Link href={l.href} className="hover:text-foreground/90 hover:underline">
              {l.label}
            </Link>
            {i < LINKS.length - 1 && (
              <span aria-hidden className="text-foreground/30">
                ·
              </span>
            )}
          </span>
        ))}
      </nav>
      <p className="mt-2">© {new Date().getFullYear()} Qodo SA · AGPL v3 · Hébergé en Suisse</p>
    </footer>
  );
}
