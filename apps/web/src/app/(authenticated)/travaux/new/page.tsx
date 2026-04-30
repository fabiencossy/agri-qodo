"use client";

/**
 * Nouveau travail — `/travaux/new`.
 *
 * Form unifié mobile-first avec :
 * - Métadonnées : titre, date, client (partenaire), parcelle, notes.
 * - Toggle "Travail interne" (non facturable, cache les prix).
 * - Lignes PRODUITS (ProduitSearchSelect — création inline OK).
 * - Lignes HEURES avec heure début / fin → durée auto.
 *   Présélection de l'employé courant ; possibilité d'ajouter d'autres
 *   employés (chef d'équipe).
 * - Total CHF estimé en bas (caché si interne).
 * - Sticky bottom action bar mobile (Save + Annuler).
 */
import { ArrowLeft, ClipboardList, Plus, Save, Trash2, UserCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ParcelleSearchSelect } from "@/components/ui/parcelle-search-select";
import { PartenaireSelect } from "@/components/ui/partenaire-select";
import { ProduitSearchSelect } from "@/components/ui/produit-search-select";
import { useCurrentUser } from "@/lib/auth";
import { type Produit, useProduits } from "@/lib/produits";
import {
  type CreateLigneHeureInput,
  type CreateLigneProduitInput,
  formatCHF,
  formatDuree,
  useCreateTravail,
  useTravail,
  useUpdateTravail,
} from "@/lib/travaux";
import { useUsers } from "@/lib/users";

interface DraftLigneProduit {
  uid: string;
  produitId?: string | undefined;
  libelle: string;
  quantite: number;
  unite?: string | undefined;
  prixUnitaireCHF?: number | undefined;
  notes?: string | undefined;
}
interface DraftLigneHeure {
  uid: string;
  userId: string;
  heureDebut?: string;
  heureFin?: string;
  dureeMinutes: number;
  tauxHoraireCHF?: number | undefined;
  notes?: string | undefined;
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function combineDateTime(date: string, time: string): string | undefined {
  if (!date || !time) return undefined;
  const iso = `${date}T${time}:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function dureeFromTimes(date: string, debut?: string, fin?: string): number | null {
  const start = combineDateTime(date, debut ?? "");
  const end = combineDateTime(date, fin ?? "");
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return null;
  return Math.round(diff / 60000);
}

export default function NewTravailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const create = useCreateTravail();
  const update = useUpdateTravail();
  const me = useCurrentUser();
  const users = useUsers();
  const produits = useProduits();

  // Mode édition : ?edit={travailId} → pré-remplit le form depuis l'API.
  const editId = searchParams.get("edit") ?? undefined;
  const isEditMode = !!editId;
  const existingTravail = useTravail(editId);

  // Date pré-remplie via query string (ex: depuis le calendrier
  // /mes-heures qui passe ?date=YYYY-MM-DD).
  const dateParam = searchParams.get("date");
  const [titre, setTitre] = useState("");
  const [date, setDate] = useState(
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayIso(),
  );
  const [partenaireId, setPartenaireId] = useState("");
  const [parcelleId, setParcelleId] = useState("");
  const [interne, setInterne] = useState(false);
  const [notes, setNotes] = useState("");
  const [lignesProduit, setLignesProduit] = useState<DraftLigneProduit[]>([]);
  const [lignesHeure, setLignesHeure] = useState<DraftLigneHeure[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Pré-remplissage en mode édition depuis le travail existant.
  const loadedRef = useState({ id: "" })[0];
  useEffect(() => {
    if (!isEditMode || !existingTravail.data) return;
    if (loadedRef.id === existingTravail.data.id) return; // déjà chargé
    loadedRef.id = existingTravail.data.id;
    const t = existingTravail.data;
    setTitre(t.titre);
    setDate(t.date.slice(0, 10));
    setPartenaireId(t.partenaireId ?? "");
    setParcelleId(t.parcelleId ?? "");
    setInterne(t.interne);
    setNotes(t.notes ?? "");
    setLignesProduit(
      t.lignesProduit.map((l) => ({
        uid: uid(),
        ...(l.produitId ? { produitId: l.produitId } : {}),
        libelle: l.libelle,
        quantite: Number(l.quantite),
        unite: l.unite,
        ...(l.prixUnitaireCHF ? { prixUnitaireCHF: Number(l.prixUnitaireCHF) } : {}),
        ...(l.notes ? { notes: l.notes } : {}),
      })),
    );
    setLignesHeure(
      t.lignesHeure.map((l) => ({
        uid: uid(),
        userId: l.userId,
        ...(l.heureDebut ? { heureDebut: l.heureDebut.slice(11, 16) } : {}),
        ...(l.heureFin ? { heureFin: l.heureFin.slice(11, 16) } : {}),
        dureeMinutes: l.dureeMinutes,
        ...(l.tauxHoraireCHF ? { tauxHoraireCHF: Number(l.tauxHoraireCHF) } : {}),
        ...(l.notes ? { notes: l.notes } : {}),
      })),
    );
  }, [existingTravail.data, isEditMode, loadedRef]);

  // Présélection : ligne heures vide pour l'utilisateur courant (create only).
  const meId = me.data?.id;
  useEffect(() => {
    if (!meId || isEditMode) return;
    setLignesHeure((prev) =>
      prev.length === 0 ? [{ uid: uid(), userId: meId, dureeMinutes: 0 }] : prev,
    );
  }, [meId, isEditMode]);

  const totalProduits = useMemo(
    () => lignesProduit.reduce((s, l) => s + (l.prixUnitaireCHF ?? 0) * l.quantite, 0),
    [lignesProduit],
  );
  const totalHeures = useMemo(
    () => lignesHeure.reduce((s, l) => s + (l.tauxHoraireCHF ?? 0) * (l.dureeMinutes / 60), 0),
    [lignesHeure],
  );
  const totalDureeMin = useMemo(
    () => lignesHeure.reduce((s, l) => s + l.dureeMinutes, 0),
    [lignesHeure],
  );

  const isChef = me.data?.role === "OWNER";

  const addLigneProduit = () => {
    setLignesProduit((prev) => [...prev, { uid: uid(), libelle: "", quantite: 0, unite: "kg" }]);
  };
  const updateProduit = (idx: number, patch: Partial<DraftLigneProduit>) => {
    setLignesProduit((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const removeProduit = (idx: number) => {
    setLignesProduit((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLigneHeure = () => {
    setLignesHeure((prev) => [...prev, { uid: uid(), userId: me.data?.id ?? "", dureeMinutes: 0 }]);
  };
  const updateHeure = (idx: number, patch: Partial<DraftLigneHeure>) => {
    setLignesHeure((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, ...patch };
        // Recalcule la durée si début et fin saisis.
        if (patch.heureDebut !== undefined || patch.heureFin !== undefined) {
          const d = dureeFromTimes(date, next.heureDebut, next.heureFin);
          if (d !== null) next.dureeMinutes = d;
        }
        return next;
      }),
    );
  };
  const removeHeure = (idx: number) => {
    setLignesHeure((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!titre.trim()) {
      setError("Donne un titre au travail (ex : Récolte champ Loup).");
      return;
    }
    const lignesProduitClean: CreateLigneProduitInput[] = lignesProduit
      .filter((l) => l.libelle.trim() && l.quantite > 0)
      .map((l) => {
        const out: CreateLigneProduitInput = {
          libelle: l.libelle.trim(),
          quantite: l.quantite,
          unite: l.unite ?? "kg",
        };
        if (l.produitId) out.produitId = l.produitId;
        if (!interne && l.prixUnitaireCHF !== undefined) out.prixUnitaireCHF = l.prixUnitaireCHF;
        if (l.notes) out.notes = l.notes;
        return out;
      });
    const lignesHeureClean: CreateLigneHeureInput[] = lignesHeure
      .filter((l) => l.userId && l.dureeMinutes > 0)
      .map((l) => {
        const out: CreateLigneHeureInput = { userId: l.userId, dureeMinutes: l.dureeMinutes };
        const debutIso = combineDateTime(date, l.heureDebut ?? "");
        const finIso = combineDateTime(date, l.heureFin ?? "");
        if (debutIso) out.heureDebut = debutIso;
        if (finIso) out.heureFin = finIso;
        if (!interne && l.tauxHoraireCHF !== undefined) out.tauxHoraireCHF = l.tauxHoraireCHF;
        if (l.notes) out.notes = l.notes;
        return out;
      });

    const payload = {
      titre: titre.trim(),
      date,
      interne,
      ...(partenaireId && !interne ? { partenaireId } : {}),
      ...(parcelleId ? { parcelleId } : {}),
      ...(notes ? { notes } : {}),
      ...(lignesProduitClean.length > 0 ? { lignesProduit: lignesProduitClean } : {}),
      ...(lignesHeureClean.length > 0 ? { lignesHeure: lignesHeureClean } : {}),
    };
    try {
      if (isEditMode && editId) {
        const updated = await update.mutateAsync({ id: editId, ...payload });
        router.push(`/travaux/${updated.id}` as never);
      } else {
        const created = await create.mutateAsync(payload);
        router.push(`/travaux/${created.id}` as never);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Travaux", href: "/travaux" },
          { label: isEditMode ? "Modifier" : "Nouveau" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 pb-32 pt-6 sm:py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={isEditMode && editId ? (`/travaux/${editId}` as never) : "/travaux"}
            className="text-foreground/60 hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <ClipboardList className="h-6 w-6 text-green sm:h-7 sm:w-7" />
            {isEditMode ? "Modifier la prestation" : "Nouvelle prestation"}
          </h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* ----- Toggle interne en haut ----- */}
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4">
            <input
              type="checkbox"
              checked={interne}
              onChange={(e) => setInterne(e.target.checked)}
              className="mt-1 h-5 w-5 cursor-pointer accent-green"
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold">Travail interne (non facturable)</span>
              <span className="mt-0.5 block text-xs text-foreground/60">
                Pour entretien, formation, déplacement… Pas de client, pas de prix, pas d'export
                Odoo.
              </span>
            </span>
          </label>

          {/* ----- Métadonnées : Date → Client → Parcelle → Titre → Notes ----- */}
          <section className="space-y-4 rounded-2xl border border-border bg-background p-4 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
              Informations
            </h2>
            <Field label="Date">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 text-base"
              />
            </Field>
            {!interne && (
              <Field label="Client (optionnel)">
                <PartenaireSelect
                  value={partenaireId}
                  onChange={setPartenaireId}
                  placeholder="Choisir un client lié…"
                />
              </Field>
            )}
            <Field label="Parcelle (optionnel)">
              <ParcelleSearchSelect
                value={parcelleId}
                onChange={(id) => setParcelleId(id)}
                placeholder="Choisir une parcelle…"
              />
            </Field>
            <Field label="Titre / description" required>
              <Input
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex : Récolte champ Loup, Pulvérisation prés…"
                required
                className="h-12 text-base"
              />
            </Field>
            <Field label="Notes (optionnel)">
              <textarea
                className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Conditions, particularités…"
              />
            </Field>
          </section>

          {/* ----- Lignes produits ----- */}
          <section className="space-y-3 rounded-2xl border border-border bg-background p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
                Produits ({lignesProduit.length})
              </h2>
              <Button type="button" variant="secondary" size="sm" onClick={addLigneProduit}>
                <Plus className="mr-1 h-4 w-4" />
                Ajouter
              </Button>
            </div>
            {lignesProduit.length === 0 ? (
              <p className="text-sm text-foreground/50">
                Aucun produit. Ajoute des semences, engrais, phytos consommés.
              </p>
            ) : (
              <div className="space-y-3">
                {lignesProduit.map((l, idx) => (
                  <LigneProduitRow
                    key={l.uid}
                    ligne={l}
                    produits={produits.data ?? []}
                    onChange={(patch) => updateProduit(idx, patch)}
                    onRemove={() => removeProduit(idx)}
                    showPrice={!interne}
                  />
                ))}
              </div>
            )}
            {!interne && totalProduits > 0 && (
              <p className="text-right text-sm font-medium">
                Sous-total : <span className="font-mono">{formatCHF(totalProduits)}</span>
              </p>
            )}
          </section>

          {/* ----- Lignes heures ----- */}
          <section className="space-y-3 rounded-2xl border border-border bg-background p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
                Heures ({lignesHeure.length})
              </h2>
              <Button type="button" variant="secondary" size="sm" onClick={addLigneHeure}>
                <Plus className="mr-1 h-4 w-4" />
                Ajouter
              </Button>
            </div>
            {lignesHeure.length === 0 ? (
              <p className="text-sm text-foreground/50">
                Aucune heure. Ajoute le temps passé — alimente automatiquement le timesheet.
              </p>
            ) : (
              <div className="space-y-3">
                {lignesHeure.map((l, idx) => (
                  <LigneHeureRow
                    key={l.uid}
                    ligne={l}
                    users={users.data ?? []}
                    canChangeUser={isChef}
                    onChange={(patch) => updateHeure(idx, patch)}
                    onRemove={() => removeHeure(idx)}
                    showPrice={!interne}
                  />
                ))}
              </div>
            )}
            {totalDureeMin > 0 && (
              <p className="text-right text-sm font-medium">
                Sous-total : <span>{formatDuree(totalDureeMin)}</span>
                {!interne && totalHeures > 0 && (
                  <span className="ml-2 font-mono">{formatCHF(totalHeures)}</span>
                )}
              </p>
            )}
          </section>

          {/* ----- Total ----- */}
          {!interne && totalProduits + totalHeures > 0 && (
            <div className="rounded-2xl border-2 border-green bg-green/5 p-4 text-right">
              <p className="text-sm text-foreground/60">Total estimé HT</p>
              <p className="font-mono text-2xl font-bold text-green-dark">
                {formatCHF(totalProduits + totalHeures)}
              </p>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {/* ----- Sticky bottom bar mobile ----- */}
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pt-2">
            <div className="mx-auto flex max-w-3xl justify-end gap-2">
              <Link href="/travaux">
                <Button type="button" variant="ghost">
                  Annuler
                </Button>
              </Link>
              <Button type="submit" disabled={create.isPending} className="h-11 px-6">
                <Save className="mr-1 h-4 w-4" />
                {create.isPending || update.isPending
                  ? "Sauvegarde…"
                  : isEditMode
                    ? "Mettre à jour"
                    : "Sauvegarder"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function LigneProduitRow({
  ligne,
  onChange,
  onRemove,
  showPrice,
}: {
  ligne: DraftLigneProduit;
  produits: Produit[];
  onChange: (patch: Partial<DraftLigneProduit>) => void;
  onRemove: () => void;
  showPrice: boolean;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3">
      <div className="grid gap-2 sm:grid-cols-[2fr_auto]">
        <ProduitSearchSelect
          categorie="AUTRE"
          value={ligne.produitId ?? ""}
          onChange={(id, p) => {
            onChange({
              produitId: id || undefined,
              libelle: p?.libelle ?? ligne.libelle,
              unite: p?.unite ?? ligne.unite ?? "kg",
            });
          }}
          placeholder="Choisir un produit…"
        />
        <button
          type="button"
          onClick={onRemove}
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background text-red-700 hover:bg-red-50"
          aria-label="Supprimer cette ligne"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <Input
        value={ligne.libelle}
        onChange={(e) => onChange({ libelle: e.target.value })}
        placeholder="Libellé (auto si produit choisi, sinon libre)"
        className="h-11"
      />
      <div className={`grid gap-2 ${showPrice ? "grid-cols-3" : "grid-cols-2"}`}>
        <Input
          type="number"
          step="0.001"
          min="0"
          inputMode="decimal"
          value={ligne.quantite || ""}
          onChange={(e) => onChange({ quantite: Number(e.target.value) || 0 })}
          placeholder="Qté"
          aria-label="Quantité"
          className="h-11"
        />
        <Input
          value={ligne.unite ?? ""}
          onChange={(e) => onChange({ unite: e.target.value })}
          placeholder="kg"
          aria-label="Unité"
          className="h-11"
        />
        {showPrice && (
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={ligne.prixUnitaireCHF ?? ""}
            onChange={(e) =>
              onChange({
                prixUnitaireCHF: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="CHF/u"
            aria-label="Prix unitaire CHF"
            className="h-11"
          />
        )}
      </div>
      {showPrice && ligne.prixUnitaireCHF && ligne.quantite > 0 && (
        <p className="text-right text-xs text-foreground/60">
          {formatCHF(ligne.prixUnitaireCHF * ligne.quantite)}
        </p>
      )}
    </div>
  );
}

/**
 * Parse une chaîne saisie style qodo-clock en minutes :
 * - "720"   → 7h20  (HHMM compact)
 * - "7h20"  → 7h20
 * - "7:20"  → 7h20
 * - "7.5"   → 7h30  (décimal)
 * - "90"    → 1h30  (minutes)
 * - "1h"    → 1h00
 * - ""      → null
 */
function parseHhmm(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  // 7h20 / 7h
  const hMatch = /^(\d+)\s*h\s*(\d+)?$/.exec(s);
  if (hMatch) {
    const h = parseInt(hMatch[1] ?? "0", 10);
    const m = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
    if (m >= 60) return null;
    return h * 60 + m;
  }
  // 7:20
  const cMatch = /^(\d+):(\d+)$/.exec(s);
  if (cMatch) {
    const h = parseInt(cMatch[1] ?? "0", 10);
    const m = parseInt(cMatch[2] ?? "0", 10);
    if (m >= 60) return null;
    return h * 60 + m;
  }
  // 7.5 ou 7,5 décimal
  const dMatch = /^(\d+)[.,](\d+)$/.exec(s);
  if (dMatch) {
    const v = parseFloat(s.replace(",", "."));
    if (!Number.isFinite(v)) return null;
    return Math.round(v * 60);
  }
  // pure number : si > 24, c'est HHMM compact ou minutes
  const nMatch = /^(\d+)$/.exec(s);
  if (nMatch) {
    const n = parseInt(nMatch[1] ?? "0", 10);
    // Heuristique qodo-clock : ≤ 24 = heures, sinon HHMM si valide, sinon minutes
    if (n <= 24) return n * 60;
    // HHMM compact : les 2 derniers chiffres sont les minutes
    const m = n % 100;
    const h = Math.floor(n / 100);
    if (m < 60) return h * 60 + m;
    // Sinon traite comme minutes brutes
    return n;
  }
  return null;
}

function formatHhmmInput(dureeMinutes: number): string {
  if (dureeMinutes <= 0) return "";
  const h = Math.floor(dureeMinutes / 60);
  const m = dureeMinutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function HhmmInput({
  dureeMinutes,
  onChange,
}: {
  dureeMinutes: number;
  onChange: (d: number) => void;
}) {
  const [draft, setDraft] = useState(() => formatHhmmInput(dureeMinutes));
  const [error, setError] = useState(false);

  // Re-sync si parent change (toggle mode times → duree).
  useEffect(() => {
    setDraft(formatHhmmInput(dureeMinutes));
  }, [dureeMinutes]);

  const handleBlur = () => {
    const parsed = parseHhmm(draft);
    if (parsed === null && draft.trim() !== "") {
      setError(true);
      return;
    }
    setError(false);
    const value = parsed ?? 0;
    onChange(value);
    setDraft(formatHhmmInput(value));
  };

  return (
    <div>
      <label className="block">
        <span className="mb-0.5 block text-xs text-foreground/60">
          Durée (saisie rapide style qodo-clock)
        </span>
        <Input
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(false);
          }}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleBlur();
            }
          }}
          placeholder="720 = 7h20  ·  7.5 = 7h30  ·  90 = 1h30"
          className={`h-11 ${error ? "border-red-400" : ""}`}
        />
      </label>
      <p className="mt-1 text-[11px] text-foreground/50">
        Tape <code className="font-mono">720</code> pour 7h20, ou{" "}
        <code className="font-mono">7.5</code>, <code className="font-mono">7h20</code>,{" "}
        <code className="font-mono">7:20</code>, <code className="font-mono">90</code> (= 1h30).
      </p>
    </div>
  );
}

function LigneHeureRow({
  ligne,
  users,
  canChangeUser,
  onChange,
  onRemove,
  showPrice,
}: {
  ligne: DraftLigneHeure;
  users: { id: string; prenom: string; nom: string; email: string }[];
  canChangeUser: boolean;
  onChange: (patch: Partial<DraftLigneHeure>) => void;
  onRemove: () => void;
  showPrice: boolean;
}) {
  const [mode, setMode] = useState<"times" | "duree">(
    ligne.heureDebut || ligne.heureFin ? "times" : "duree",
  );
  const userObj = users.find((u) => u.id === ligne.userId);

  return (
    <div className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3">
      <div className="grid gap-2 sm:grid-cols-[2fr_auto]">
        {canChangeUser ? (
          <select
            className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            value={ligne.userId}
            onChange={(e) => onChange({ userId: e.target.value })}
          >
            <option value="">Choisir un employé…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.prenom} {u.nom}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex h-12 items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 text-sm">
            <UserCircle className="h-4 w-4 text-foreground/60" />
            <span className="font-medium">
              {userObj ? `${userObj.prenom} ${userObj.nom}` : "Toi"}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background text-red-700 hover:bg-red-50"
          aria-label="Supprimer cette ligne"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode("times")}
          className={`flex-1 rounded-md px-2 py-1 ${mode === "times" ? "bg-background font-medium shadow-sm" : "text-foreground/60"}`}
        >
          Heure début / fin
        </button>
        <button
          type="button"
          onClick={() => setMode("duree")}
          className={`flex-1 rounded-md px-2 py-1 ${mode === "duree" ? "bg-background font-medium shadow-sm" : "text-foreground/60"}`}
        >
          Durée libre
        </button>
      </div>

      {mode === "times" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-0.5 block text-xs text-foreground/60">Début</span>
            <Input
              type="time"
              value={ligne.heureDebut ?? ""}
              onChange={(e) => onChange({ heureDebut: e.target.value })}
              className="h-11"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-xs text-foreground/60">Fin</span>
            <Input
              type="time"
              value={ligne.heureFin ?? ""}
              onChange={(e) => onChange({ heureFin: e.target.value })}
              className="h-11"
            />
          </label>
        </div>
      ) : (
        <HhmmInput
          dureeMinutes={ligne.dureeMinutes}
          onChange={(d) => onChange({ dureeMinutes: d })}
        />
      )}

      {showPrice && (
        <Input
          type="number"
          step="0.5"
          min="0"
          inputMode="decimal"
          value={ligne.tauxHoraireCHF ?? ""}
          onChange={(e) =>
            onChange({
              tauxHoraireCHF: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="Taux CHF/h (vide = non facturable)"
          aria-label="Taux horaire CHF"
          className="h-11"
        />
      )}

      {ligne.dureeMinutes > 0 && (
        <p className="text-right text-xs text-foreground/60">
          {formatDuree(ligne.dureeMinutes)}
          {showPrice && ligne.tauxHoraireCHF && (
            <>
              {" · "}
              {formatCHF((ligne.dureeMinutes / 60) * ligne.tauxHoraireCHF)}
            </>
          )}
        </p>
      )}
    </div>
  );
}
