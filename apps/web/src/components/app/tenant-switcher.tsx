"use client";

import { Check, ChevronsUpDown, Handshake, Home } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type AccessibleTenant, getActiveTenantId, setActiveTenantId } from "@/lib/active-tenant";
import { useAccessibleTenants } from "@/lib/tenants";

/**
 * Bascule entre exploitations accessibles (mon tenant + liens partenaires
 * ACTIVE). Compact pour la sidebar et la topbar mobile.
 */
export function TenantSwitcher() {
  const tenants = useAccessibleTenants();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const list = tenants.data ?? [];
  const activeId = getActiveTenantId();
  const home = list.find((t) => t.kind === "home");
  const current = list.find((t) => t.id === activeId) ?? home ?? list[0];

  if (!current) return null;

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left text-sm hover:bg-muted"
      >
        <span className="flex-shrink-0">
          {current.kind === "home" ? (
            <Home className="h-4 w-4 text-green" />
          ) : (
            <Handshake className="h-4 w-4 text-amber-600" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{current.nom}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-foreground/40" />
      </button>
      {open && list.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
          <ul className="py-1">
            {list.map((t) => (
              <Item key={t.id} tenant={t} active={t.id === current.id} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Item({ tenant, active }: { tenant: AccessibleTenant; active: boolean }) {
  const onSelect = () => {
    if (active) return;
    // Pour l'exploitation home, on retire le header (null) ; pour un
    // partenaire on pose son id explicitement.
    setActiveTenantId(tenant.kind === "home" ? null : tenant.id);
  };
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
          active ? "bg-green/5" : ""
        }`}
      >
        <span className="mt-0.5 flex-shrink-0">
          {tenant.kind === "home" ? (
            <Home className="h-4 w-4 text-green" />
          ) : (
            <Handshake className="h-4 w-4 text-amber-600" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{tenant.nom}</span>
          <span className="block font-mono text-xs text-foreground/50">{tenant.code}</span>
          {tenant.kind === "partner" && tenant.niveau && (
            <span className="text-xs text-amber-700">
              Partenaire ·{" "}
              {tenant.niveau === "LECTURE"
                ? "lecture seule"
                : tenant.niveau === "VALIDATION"
                  ? "validation"
                  : "saisie directe"}
            </span>
          )}
        </span>
        {active && <Check className="h-4 w-4 flex-shrink-0 text-green" />}
      </button>
    </li>
  );
}

/**
 * Banner visible sur toutes les pages quand on travaille sur un tenant
 * partenaire — pour qu'on n'oublie jamais qu'on n'est pas chez soi.
 */
export function PartnerTenantBanner() {
  const tenants = useAccessibleTenants();
  const activeId = getActiveTenantId();
  if (!activeId || !tenants.data) return null;
  const active = tenants.data.find((t) => t.id === activeId);
  if (!active || active.kind !== "partner") return null;
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      <Handshake className="-mt-0.5 mr-1 inline h-4 w-4" />
      Tu travailles sur l'exploitation partenaire <strong>{active.nom}</strong> (
      {active.niveau === "LECTURE" ? "lecture seule" : "saisie directe"}).{" "}
      <button type="button" onClick={() => setActiveTenantId(null)} className="underline">
        Revenir à mon exploitation
      </button>
    </div>
  );
}
