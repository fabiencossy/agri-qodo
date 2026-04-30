"use client";

/**
 * Nouveau travail facturable — `/travaux/new`.
 *
 * Form unifié avec :
 * - Métadonnées : titre, date, client (partenaire), parcelle, notes.
 * - Lignes PRODUITS (composant ProduitSearchSelect — création inline OK).
 * - Lignes HEURES (sélecteur employé + durée + taux horaire).
 * - Total CHF estimé en bas.
 *
 * Pas de push Odoo dans cette PR (Phase 1) — juste sauvegarde locale en
 * DRAFT. Le bouton "Valider" passe à VALIDATED, "Facturer Odoo" sera
 * ajouté en PR Phase 2.
 */
import { ArrowLeft, ClipboardList, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ParcelleSearchSelect } from "@/components/ui/parcelle-search-select";
import { ProduitSearchSelect } from "@/components/ui/produit-search-select";
import { type Produit, useProduits } from "@/lib/produits";
import {
  type CreateLigneHeureInput,
  type CreateLigneProduitInput,
  formatCHF,
  formatDuree,
  useCreateTravail,
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
  dureeMinutes: number;
  tauxHoraireCHF?: number | undefined;
  notes?: string | undefined;
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function NewTravailPage() {
  const router = useRouter();
  const create = useCreateTravail();
  const users = useUsers();
  const produits = useProduits();

  const [titre, setTitre] = useState("");
  const [date, setDate] = useState(todayIso());
  const [parcelleId, setParcelleId] = useState("");
  const [notes, setNotes] = useState("");
  const [lignesProduit, setLignesProduit] = useState<DraftLigneProduit[]>([]);
  const [lignesHeure, setLignesHeure] = useState<DraftLigneHeure[]>([]);
  const [error, setError] = useState<string | null>(null);

  const totalProduits = lignesProduit.reduce(
    (s, l) => s + (l.prixUnitaireCHF ?? 0) * l.quantite,
    0,
  );
  const totalHeures = lignesHeure.reduce(
    (s, l) => s + (l.tauxHoraireCHF ?? 0) * (l.dureeMinutes / 60),
    0,
  );
  const totalDureeMin = lignesHeure.reduce((s, l) => s + l.dureeMinutes, 0);

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
    setLignesHeure((prev) => [...prev, { uid: uid(), userId: "", dureeMinutes: 60 }]);
  };

  const updateHeure = (idx: number, patch: Partial<DraftLigneHeure>) => {
    setLignesHeure((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
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
        if (l.prixUnitaireCHF !== undefined) out.prixUnitaireCHF = l.prixUnitaireCHF;
        if (l.notes) out.notes = l.notes;
        return out;
      });
    const lignesHeureClean: CreateLigneHeureInput[] = lignesHeure
      .filter((l) => l.userId && l.dureeMinutes > 0)
      .map((l) => {
        const out: CreateLigneHeureInput = { userId: l.userId, dureeMinutes: l.dureeMinutes };
        if (l.tauxHoraireCHF !== undefined) out.tauxHoraireCHF = l.tauxHoraireCHF;
        if (l.notes) out.notes = l.notes;
        return out;
      });

    try {
      const created = await create.mutateAsync({
        titre: titre.trim(),
        date,
        ...(parcelleId ? { parcelleId } : {}),
        ...(notes ? { notes } : {}),
        ...(lignesProduitClean.length > 0 ? { lignesProduit: lignesProduitClean } : {}),
        ...(lignesHeureClean.length > 0 ? { lignesHeure: lignesHeureClean } : {}),
      });
      router.push(`/travaux/${created.id}` as never);
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
          { label: "Nouveau" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/travaux" className="text-foreground/60 hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <ClipboardList className="h-7 w-7 text-green" />
            Nouveau travail
          </h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* ----- Métadonnées ----- */}
          <section className="space-y-4 rounded-2xl border border-border bg-background p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
              Informations générales
            </h2>
            <Field label="Titre" required>
              <Input
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex : Récolte du champ Loup, Pulvérisation prés Jurassiens…"
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Parcelle (optionnel)">
                <ParcelleSearchSelect
                  value={parcelleId}
                  onChange={(id) => setParcelleId(id)}
                  placeholder="Choisir une parcelle…"
                />
              </Field>
            </div>
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
          <section className="space-y-3 rounded-2xl border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
                Produits consommés
              </h2>
              <Button type="button" variant="secondary" size="sm" onClick={addLigneProduit}>
                <Plus className="mr-1 h-4 w-4" />
                Ajouter
              </Button>
            </div>
            {lignesProduit.length === 0 ? (
              <p className="text-sm text-foreground/50">
                Aucun produit. Ajoute des semences, engrais, phytos consommés sur ce travail.
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
                  />
                ))}
              </div>
            )}
            {totalProduits > 0 && (
              <p className="text-right text-sm font-medium">
                Sous-total produits : <span className="font-mono">{formatCHF(totalProduits)}</span>
              </p>
            )}
          </section>

          {/* ----- Lignes heures ----- */}
          <section className="space-y-3 rounded-2xl border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
                Heures de travail
              </h2>
              <Button type="button" variant="secondary" size="sm" onClick={addLigneHeure}>
                <Plus className="mr-1 h-4 w-4" />
                Ajouter
              </Button>
            </div>
            {lignesHeure.length === 0 ? (
              <p className="text-sm text-foreground/50">
                Aucune heure. Ajoute le temps passé par chaque employé — ces heures alimenteront
                automatiquement le timesheet (pas de double saisie).
              </p>
            ) : (
              <div className="space-y-3">
                {lignesHeure.map((l, idx) => (
                  <LigneHeureRow
                    key={l.uid}
                    ligne={l}
                    users={users.data ?? []}
                    onChange={(patch) => updateHeure(idx, patch)}
                    onRemove={() => removeHeure(idx)}
                  />
                ))}
              </div>
            )}
            {totalDureeMin > 0 && (
              <p className="text-right text-sm font-medium">
                Sous-total heures : <span>{formatDuree(totalDureeMin)}</span>
                {totalHeures > 0 && (
                  <span className="ml-2 font-mono">{formatCHF(totalHeures)}</span>
                )}
              </p>
            )}
          </section>

          {/* ----- Total ----- */}
          {totalProduits + totalHeures > 0 && (
            <div className="rounded-2xl border-2 border-green bg-green/5 p-4 text-right">
              <p className="text-sm text-foreground/60">Total estimé HT</p>
              <p className="font-mono text-2xl font-bold text-green-dark">
                {formatCHF(totalProduits + totalHeures)}
              </p>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2">
            <Link href="/travaux">
              <Button type="button" variant="ghost">
                Annuler
              </Button>
            </Link>
            <Button type="submit" disabled={create.isPending}>
              <Save className="mr-1 h-4 w-4" />
              {create.isPending ? "Sauvegarde…" : "Sauvegarder en brouillon"}
            </Button>
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
}: {
  ligne: DraftLigneProduit;
  produits: Produit[];
  onChange: (patch: Partial<DraftLigneProduit>) => void;
  onRemove: () => void;
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
          placeholder="Choisir un produit du catalogue…"
        />
        <button
          type="button"
          onClick={onRemove}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-red-700 hover:bg-red-50"
          aria-label="Supprimer cette ligne"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <Input
        value={ligne.libelle}
        onChange={(e) => onChange({ libelle: e.target.value })}
        placeholder="Libellé (auto si produit choisi, sinon libre)"
      />
      <div className="grid grid-cols-3 gap-2">
        <Input
          type="number"
          step="0.001"
          min="0"
          value={ligne.quantite || ""}
          onChange={(e) => onChange({ quantite: Number(e.target.value) || 0 })}
          placeholder="Qté"
          aria-label="Quantité"
        />
        <Input
          value={ligne.unite ?? ""}
          onChange={(e) => onChange({ unite: e.target.value })}
          placeholder="kg"
          aria-label="Unité"
        />
        <Input
          type="number"
          step="0.01"
          min="0"
          value={ligne.prixUnitaireCHF ?? ""}
          onChange={(e) =>
            onChange({
              prixUnitaireCHF: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="Prix CHF/u (vide = non facturable)"
          aria-label="Prix unitaire CHF"
        />
      </div>
      {ligne.prixUnitaireCHF && ligne.quantite > 0 && (
        <p className="text-right text-xs text-foreground/60">
          {formatCHF(ligne.prixUnitaireCHF * ligne.quantite)}
        </p>
      )}
    </div>
  );
}

function LigneHeureRow({
  ligne,
  users,
  onChange,
  onRemove,
}: {
  ligne: DraftLigneHeure;
  users: { id: string; prenom: string; nom: string; email: string }[];
  onChange: (patch: Partial<DraftLigneHeure>) => void;
  onRemove: () => void;
}) {
  const heures = Math.floor(ligne.dureeMinutes / 60);
  const minutes = ligne.dureeMinutes % 60;

  return (
    <div className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3">
      <div className="grid gap-2 sm:grid-cols-[2fr_auto]">
        <select
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
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
        <button
          type="button"
          onClick={onRemove}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-red-700 hover:bg-red-50"
          aria-label="Supprimer cette ligne"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-0.5 block text-xs text-foreground/60">Heures</span>
          <Input
            type="number"
            min="0"
            max="24"
            value={heures}
            onChange={(e) => {
              const h = Math.max(0, Number(e.target.value) || 0);
              onChange({ dureeMinutes: h * 60 + minutes });
            }}
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-xs text-foreground/60">Minutes</span>
          <Input
            type="number"
            min="0"
            max="59"
            step="5"
            value={minutes}
            onChange={(e) => {
              const m = Math.max(0, Math.min(59, Number(e.target.value) || 0));
              onChange({ dureeMinutes: heures * 60 + m });
            }}
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-xs text-foreground/60">Taux CHF/h</span>
          <Input
            type="number"
            step="0.5"
            min="0"
            value={ligne.tauxHoraireCHF ?? ""}
            onChange={(e) =>
              onChange({
                tauxHoraireCHF: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="vide = interne"
          />
        </label>
      </div>
      {ligne.tauxHoraireCHF && ligne.dureeMinutes > 0 && (
        <p className="text-right text-xs text-foreground/60">
          {formatDuree(ligne.dureeMinutes)} ·{" "}
          {formatCHF((ligne.dureeMinutes / 60) * ligne.tauxHoraireCHF)}
        </p>
      )}
    </div>
  );
}
