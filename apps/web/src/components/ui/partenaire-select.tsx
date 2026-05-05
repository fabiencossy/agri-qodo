"use client";

import { Check, ChevronDown, ExternalLink, Loader2, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useCreateQuickClient, useOdooPartners } from "@/lib/odoo-partners";
import { usePartnerLinks } from "@/lib/partner-links";

interface AgriOption {
  kind: "agri";
  id: string; // Exploitation.id (utilisé comme partenaireId du Travail)
  nom: string;
  code: string;
  canton: string;
}

interface OdooOnlyOption {
  kind: "odoo";
  /** ID Exploitation Agri Qodo si lié via PartnerLink, sinon null. */
  id: string | null;
  /** ID Odoo (res.partner). */
  odooId: number;
  nom: string;
  ville: string | null;
  /** Si lié à une Exploitation Agri Qodo. */
  linked: boolean;
}

export interface PartenaireSelectProps {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Sélecteur Client unifié — Sprint 2 fusion-interventions.
 *
 * Affiche 2 sections :
 *  1. Partenaires Agri Qodo (PartnerLink ACTIVE) — sélectionnables direct.
 *  2. Clients Odoo (res.partner du tenant) — sélectionnables si liés
 *     à une Exploitation, sinon affichés en read-only avec bouton
 *     "Inviter sur Agri Qodo".
 *
 * Le partenaireId stocké côté Travail reste l'Exploitation Agri Qodo.
 */
export function PartenaireSelect({
  value,
  onChange,
  placeholder,
  disabled,
}: PartenaireSelectProps) {
  const links = usePartnerLinks();
  const odooPartners = useOdooPartners();
  const createClient = useCreateQuickClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Mode "création rapide" — formulaire inline dans le dropdown.
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    nom: "",
    ville: "",
    email: "",
    telephone: "",
  });
  const ref = useRef<HTMLDivElement>(null);

  const agriOptions: AgriOption[] = useMemo(() => {
    return (links.data ?? [])
      .filter((l) => l.status === "ACTIVE")
      .map((l) => ({
        kind: "agri" as const,
        id: l.partner.id,
        nom: l.partner.nom,
        code: l.partner.code,
        canton: l.partner.canton,
      }));
  }, [links.data]);

  const odooOnlyOptions: OdooOnlyOption[] = useMemo(() => {
    // On exclut ceux déjà visibles dans la section Agri (linkedExploitationId
    // = id d'une option Agri).
    const agriIds = new Set(agriOptions.map((o) => o.id));
    return (odooPartners.data ?? [])
      .filter((p) => !p.linkedExploitationId || !agriIds.has(p.linkedExploitationId))
      .map((p) => ({
        kind: "odoo" as const,
        id: p.linkedExploitationId,
        odooId: p.odooId,
        nom: p.name,
        ville: p.ville,
        linked: !!p.linkedExploitationId,
      }));
  }, [odooPartners.data, agriOptions]);

  const allSelectableId = useMemo(() => {
    const map = new Map<string, AgriOption | OdooOnlyOption>();
    for (const o of agriOptions) map.set(o.id, o);
    for (const o of odooOnlyOptions) if (o.id) map.set(o.id, o);
    return map;
  }, [agriOptions, odooOnlyOptions]);

  const selected = value ? allSelectableId.get(value) : undefined;

  const matchSearch = (text: string) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return text.toLowerCase().includes(q);
  };
  const filteredAgri = agriOptions.filter((o) => matchSearch(`${o.nom} ${o.code} ${o.canton}`));
  const filteredOdoo = odooOnlyOptions.filter((o) => matchSearch(`${o.nom} ${o.ville ?? ""}`));

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function submitCreate() {
    if (!draft.nom.trim()) return;
    try {
      const created = await createClient.mutateAsync({
        nom: draft.nom.trim(),
        ...(draft.ville.trim() ? { ville: draft.ville.trim() } : {}),
        ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
        ...(draft.telephone.trim() ? { telephone: draft.telephone.trim() } : {}),
      });
      onChange(created.exploitationId);
      setDraft({ nom: "", ville: "", email: "", telephone: "" });
      setCreating(false);
      setOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Création échouée.");
    }
  }

  const labelText = selected
    ? selected.kind === "agri"
      ? `${selected.nom} (${selected.code})`
      : selected.nom
    : (placeholder ?? "Choisir un client…");

  const empty =
    !links.isLoading &&
    !odooPartners.isLoading &&
    filteredAgri.length === 0 &&
    filteredOdoo.length === 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className={cn("truncate text-left", !selected && "text-foreground/40")}>
          {labelText}
        </span>
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-foreground/60" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[28rem] overflow-hidden rounded-lg border border-border bg-background shadow-lg">
          {creating ? (
            <div className="space-y-2 border-b border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                  Nouveau client
                </span>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  aria-label="Annuler la création"
                  className="rounded-full p-1 text-foreground/50 hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                autoFocus
                value={draft.nom}
                onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
                placeholder="Nom du client *"
                required
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              />
              <input
                value={draft.ville}
                onChange={(e) => setDraft({ ...draft, ville: e.target.value })}
                placeholder="Ville (optionnel)"
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="Email (optionnel)"
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
                />
                <input
                  value={draft.telephone}
                  onChange={(e) => setDraft({ ...draft, telephone: e.target.value })}
                  placeholder="Téléphone (optionnel)"
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
                />
              </div>
              <button
                type="button"
                onClick={submitCreate}
                disabled={!draft.nom.trim() || createClient.isPending}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-green py-2 text-sm font-semibold text-white hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createClient.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Créer et sélectionner
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-4 w-4 text-foreground/40" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un client…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-1 rounded-md border border-green bg-green/5 px-2 py-1 text-xs font-semibold text-green hover:bg-green/10"
              >
                <Plus className="h-3 w-3" />
                Nouveau
              </button>
            </div>
          )}
          <div className="max-h-80 overflow-y-auto">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm text-foreground/60 hover:bg-muted"
              >
                — Aucun client (interne) —
              </button>
            )}

            {empty ? (
              <div className="p-3 text-sm">
                <p className="mb-2 text-foreground/60">Aucun client trouvé.</p>
                <Link
                  href="/partenaires"
                  className="inline-flex items-center text-sm text-green underline"
                >
                  Inviter un partenaire →
                </Link>
              </div>
            ) : (
              <>
                {filteredAgri.length > 0 && <SectionHeader label="Partenaires Agri Qodo" />}
                {filteredAgri.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      onChange(o.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                      value === o.id && "bg-green/5",
                    )}
                  >
                    <span>
                      <span className="block font-medium">{o.nom}</span>
                      <span className="block font-mono text-xs text-foreground/50">
                        {o.code} · {o.canton}
                      </span>
                    </span>
                    {value === o.id && <Check className="h-4 w-4 text-green" />}
                  </button>
                ))}

                {filteredOdoo.length > 0 && <SectionHeader label="Clients Odoo" />}
                {filteredOdoo.map((o) => {
                  const selectable = !!o.id;
                  return (
                    <div
                      key={`odoo-${o.odooId}`}
                      className={cn(
                        "flex items-center justify-between gap-2 px-3 py-2 text-sm",
                        selectable ? "cursor-pointer hover:bg-muted" : "cursor-not-allowed",
                        value === o.id && "bg-green/5",
                      )}
                      onClick={() => {
                        if (!selectable || !o.id) return;
                        onChange(o.id);
                        setOpen(false);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{o.nom}</span>
                          {o.linked ? (
                            <span className="rounded-full border border-green bg-green/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-green">
                              Sur l'app
                            </span>
                          ) : (
                            <span className="rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-foreground/60">
                              Odoo seul
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-foreground/50">{o.ville ?? "—"}</span>
                      </div>
                      {selectable ? (
                        value === o.id && <Check className="h-4 w-4 text-green" />
                      ) : (
                        <Link
                          href="/partenaires"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-green hover:underline"
                          title="Inviter ce client à rejoindre Agri Qodo"
                        >
                          Inviter <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground/50">
      {label}
    </div>
  );
}
