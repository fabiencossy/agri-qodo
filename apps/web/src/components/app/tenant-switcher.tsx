"use client";

import { Check, ChevronsUpDown, Home } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type AccessibleTenant, getActiveTenantId, setActiveTenantId } from "@/lib/active-tenant";
import { useAccessibleTenants } from "@/lib/tenants";

/**
 * Bascule entre exploitations accessibles via compte fédéré (même
 * email + password chez plusieurs exploitations). Si un seul tenant
 * est accessible, le switcher reste minimal (pas de menu).
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
  const current = list.find((t) => t.id === activeId) ?? list[0];

  if (!current) return null;
  const hasChoice = list.length > 1;

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={() => hasChoice && setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left text-sm ${
          hasChoice ? "hover:bg-muted" : "cursor-default"
        }`}
        disabled={!hasChoice}
      >
        <Home className="h-4 w-4 flex-shrink-0 text-green" />
        <span className="min-w-0 flex-1 truncate font-medium">{current.nom}</span>
        {hasChoice && <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-foreground/40" />}
      </button>
      {open && hasChoice && (
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
    setActiveTenantId(tenant.id);
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
        <Home className="mt-0.5 h-4 w-4 flex-shrink-0 text-green" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{tenant.nom}</span>
          <span className="block font-mono text-xs text-foreground/50">{tenant.code}</span>
        </span>
        {active && <Check className="h-4 w-4 flex-shrink-0 text-green" />}
      </button>
    </li>
  );
}
