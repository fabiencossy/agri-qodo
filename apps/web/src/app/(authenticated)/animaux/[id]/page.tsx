"use client";

import { ArrowLeft, Beef, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  bvdBadge,
  LABELS,
  STATUTS_BVD,
  USAGES,
  useAnimal,
  useDeleteAnimal,
  useUpdateAnimal,
} from "@/lib/animaux";
import {
  type AnimalCategorie,
  CATEGORIES_ORDER,
  emojiCategorie,
  libelleCategorie,
} from "@/lib/srpa";

function ageString(naissance: string | null, mort: string | null): string {
  if (!naissance) return "—";
  const start = new Date(naissance);
  const end = mort ? new Date(mort) : new Date();
  if (Number.isNaN(start.getTime())) return "—";
  const ageAns = (end.getTime() - start.getTime()) / (365.25 * 86_400_000);
  if (ageAns < 1) {
    const mois = Math.floor((end.getTime() - start.getTime()) / (30 * 86_400_000));
    return `${mois} mois`;
  }
  return `${ageAns.toFixed(1)} ans`;
}

function dateFr(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-CH");
}

function dateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default function AnimalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const query = useAnimal(params.id);
  const update = useUpdateAnimal();
  const del = useDeleteAnimal();

  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({
    nom: "",
    numeroBoucle: "",
    sexe: "" as "" | "M" | "F",
    dateNaissance: "",
    dateMort: "",
    usage: "",
    secteurLabel: "",
    statutBvd: "",
    categorie: "" as "" | AnimalCategorie,
  });

  useEffect(() => {
    if (!query.data) return;
    const a = query.data;
    setDraft({
      nom: a.nom ?? "",
      numeroBoucle: a.numeroBoucle ?? "",
      sexe: (a.sexe ?? "") as "" | "M" | "F",
      dateNaissance: dateInputValue(a.dateNaissance),
      dateMort: dateInputValue(a.dateMort),
      usage: a.usage ?? "",
      secteurLabel: a.secteurLabel ?? "",
      statutBvd: a.statutBvd ?? "",
      categorie: a.categorie,
    });
  }, [query.data]);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-foreground/60">Chargement…</div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Impossible de charger cet animal.
        </p>
        <Link href="/animaux" className="mt-3 inline-block text-sm underline">
          Retour au cheptel
        </Link>
      </div>
    );
  }

  const a = query.data;
  const bvd = bvdBadge(a.statutBvd);
  const isDead = !!a.dateMort;

  const handleSave = async () => {
    const patch: Parameters<typeof update.mutateAsync>[0] = {
      id: a.id,
      categorie: (draft.categorie || a.categorie) as AnimalCategorie,
    };
    if (draft.nom) patch.nom = draft.nom;
    if (draft.numeroBoucle) patch.numeroBoucle = draft.numeroBoucle;
    if (draft.sexe) patch.sexe = draft.sexe;
    if (draft.dateNaissance) patch.dateNaissance = draft.dateNaissance;
    if (draft.dateMort) patch.dateMort = draft.dateMort;
    if (draft.usage) patch.usage = draft.usage;
    if (draft.secteurLabel) patch.secteurLabel = draft.secteurLabel;
    if (draft.statutBvd) patch.statutBvd = draft.statutBvd;
    await update.mutateAsync(patch);
    setEdit(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer définitivement cet animal ?`)) return;
    await del.mutateAsync(a.id);
    router.push("/animaux");
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Cheptel", href: "/animaux" },
          { label: a.nom ?? a.numeroBoucle ?? libelleCategorie(a.categorie) },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-start gap-3">
          <Link href="/animaux" className="mt-1 text-foreground/60 hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <span aria-hidden className="text-3xl">
                {emojiCategorie(a.categorie)}
              </span>
              {a.nom ?? <Beef className="h-7 w-7 text-green" />}
              {!a.nom && (
                <span className="font-mono text-base font-normal text-foreground/70">
                  {a.numeroBoucle ?? `#${a.id.slice(0, 6)}`}
                </span>
              )}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-foreground/60">
              <span>{libelleCategorie(a.categorie)}</span>
              {a.sexe && (
                <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-xs">
                  {a.sexe === "M" ? "♂ Mâle" : "♀ Femelle"}
                </span>
              )}
              <span>· {ageString(a.dateNaissance, a.dateMort)}</span>
              {isDead && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                  Mort
                </span>
              )}
              {!isDead && a.isActive && (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  Actif
                </span>
              )}
              {bvd && (
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${bvd.color}`}>
                  BVD: {bvd.label}
                </span>
              )}
            </p>
          </div>
          {!edit && (
            <Button variant="secondary" size="sm" onClick={() => setEdit(true)}>
              Modifier
            </Button>
          )}
        </div>

        {!edit ? (
          <section className="mb-4 grid gap-4 rounded-2xl border border-border bg-background p-5 sm:grid-cols-2">
            <Info label="N° boucle BDTA" value={a.numeroBoucle ?? "—"} mono />
            <Info label="Nom" value={a.nom ?? "—"} />
            <Info label="Catégorie" value={libelleCategorie(a.categorie)} />
            <Info label="Sexe" value={a.sexe === "M" ? "Mâle" : a.sexe === "F" ? "Femelle" : "—"} />
            <Info label="Date de naissance" value={dateFr(a.dateNaissance)} />
            <Info label="Date de mort" value={dateFr(a.dateMort)} />
            <Info
              label="Usage"
              value={USAGES.find((u) => u.value === a.usage)?.label ?? a.usage ?? "—"}
            />
            <Info
              label="Secteur / Label"
              value={LABELS.find((l) => l.value === a.secteurLabel)?.label ?? a.secteurLabel ?? "—"}
            />
            <Info
              label="Statut BVD"
              value={STATUTS_BVD.find((s) => s.value === a.statutBvd)?.label ?? a.statutBvd ?? "—"}
            />
            <Info label="Dernière mise à jour" value={dateFr(a.updatedAt)} />
          </section>
        ) : (
          <section className="mb-4 grid gap-4 rounded-2xl border border-border bg-background p-5 sm:grid-cols-2">
            <Field label="Catégorie">
              <select
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
                value={draft.categorie || a.categorie}
                onChange={(e) =>
                  setDraft({ ...draft, categorie: e.target.value as AnimalCategorie })
                }
              >
                {CATEGORIES_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {emojiCategorie(c)} {libelleCategorie(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="N° boucle BDTA">
              <Input
                value={draft.numeroBoucle}
                onChange={(e) => setDraft({ ...draft, numeroBoucle: e.target.value })}
                placeholder="CH 120.1234.5678.9"
              />
            </Field>
            <Field label="Nom">
              <Input
                value={draft.nom}
                onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
                placeholder="Marguerite, Rébecca…"
              />
            </Field>
            <Field label="Sexe">
              <select
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
                value={draft.sexe}
                onChange={(e) => setDraft({ ...draft, sexe: e.target.value as "" | "M" | "F" })}
              >
                <option value="">— Non spécifié —</option>
                <option value="F">♀ Femelle</option>
                <option value="M">♂ Mâle</option>
              </select>
            </Field>
            <Field label="Date de naissance">
              <Input
                type="date"
                value={draft.dateNaissance}
                onChange={(e) => setDraft({ ...draft, dateNaissance: e.target.value })}
              />
            </Field>
            <Field label="Date de mort (vide = vivant)">
              <Input
                type="date"
                value={draft.dateMort}
                onChange={(e) => setDraft({ ...draft, dateMort: e.target.value })}
              />
            </Field>
            <Field label="Usage">
              <select
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
                value={draft.usage}
                onChange={(e) => setDraft({ ...draft, usage: e.target.value })}
              >
                <option value="">— Non spécifié —</option>
                {USAGES.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Secteur / Label">
              <select
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
                value={draft.secteurLabel}
                onChange={(e) => setDraft({ ...draft, secteurLabel: e.target.value })}
              >
                <option value="">— Non spécifié —</option>
                {LABELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Statut BVD">
              <select
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
                value={draft.statutBvd}
                onChange={(e) => setDraft({ ...draft, statutBvd: e.target.value })}
              >
                <option value="">— Non spécifié —</option>
                {STATUTS_BVD.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </section>
        )}

        <section className="mb-4 rounded-2xl border border-dashed border-border bg-muted/20 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Historique
          </h2>
          <p className="mt-2 text-sm text-foreground/50">
            L'historique détaillé (entrées BDTA, vêlages, traitements vétérinaires, mouvements de
            lot) sera affiché ici dès qu'il sera disponible. Pour les bovins, tu peux re-importer le
            CSV BDTA pour rafraîchir les dates.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          {edit && (
            <>
              <Button onClick={handleSave} disabled={update.isPending}>
                <Save className="mr-1 h-4 w-4" />
                {update.isPending ? "Sauvegarde…" : "Sauvegarder"}
              </Button>
              <Button variant="ghost" onClick={() => setEdit(false)}>
                Annuler
              </Button>
            </>
          )}
          <div className="flex-1" />
          {!edit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={del.isPending}
              className="text-red-700 hover:bg-red-50"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Supprimer
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function Info({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="mb-0.5 text-xs uppercase tracking-wide text-foreground/50">{label}</p>
      <p className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
