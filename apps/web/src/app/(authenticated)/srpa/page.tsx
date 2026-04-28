"use client";

import { ClipboardList, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  emojiCategorie,
  formatDateFr,
  libelleCategorie,
  moisCleAnnee,
  moisLibelle,
  type SortieSrpa,
  useDeleteSortie,
  useSrpa,
} from "@/lib/srpa";

export default function SrpaPage() {
  const sorties = useSrpa();
  const deleteMutation = useDeleteSortie();

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, SortieSrpa[]>();
    for (const s of sorties.data ?? []) {
      const key = moisCleAnnee(s.date);
      const list = groups.get(key) ?? [];
      list.push(s);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [sorties.data]);

  const onDelete = (id: string, date: string, categorie: string) => {
    if (confirm(`Supprimer la sortie du ${formatDateFr(date)} pour ${categorie} ?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <>
      <Breadcrumb
        items={[{ label: "Accueil", href: "/" }, { label: "SRPA — Sorties au pâturage" }]}
      />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold">SRPA — Sorties au pâturage</h1>
            <p className="mt-1 text-foreground/70">
              {sorties.data
                ? `${sorties.data.length} sortie${sorties.data.length > 1 ? "s" : ""} enregistrée${sorties.data.length > 1 ? "s" : ""}`
                : "Chargement…"}
            </p>
          </div>
          <Link href="/srpa/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Saisir une sortie
            </Button>
          </Link>
        </div>

        {sorties.isError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger les sorties. Vérifie ta connexion.
          </div>
        )}

        {sorties.data && sorties.data.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-foreground/30" />
            <h2 className="mt-4 text-lg font-semibold">Aucune sortie enregistrée</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Enregistrez les sorties de vos animaux pour le respect du SRPA (paiements directs
              PER).
            </p>
            <Link href="/srpa/new" className="mt-6 inline-block">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Première sortie
              </Button>
            </Link>
          </div>
        )}

        {groupedByMonth.length > 0 && (
          <div className="space-y-8">
            {groupedByMonth.map(([key, items]) => (
              <section key={key}>
                <h2 className="mb-3 text-lg font-semibold capitalize">{moisLibelle(key)}</h2>
                <ul className="space-y-2">
                  {items.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green/10 text-2xl">
                          {emojiCategorie(s.categorie)}
                        </span>
                        <div>
                          <div className="font-medium">
                            {libelleCategorie(s.categorie)}
                            {s.nombreAnimaux !== null && (
                              <span className="ml-2 font-normal text-foreground/60">
                                · {s.nombreAnimaux} animal
                                {s.nombreAnimaux > 1 ? "x" : ""}
                              </span>
                            )}
                            {s.dureeMinutes !== null && (
                              <span className="ml-2 font-normal text-foreground/60">
                                · {Math.round(s.dureeMinutes / 60)} h
                              </span>
                            )}
                          </div>
                          <div className="text-sm capitalize text-foreground/60">
                            {formatDateFr(s.date)}
                          </div>
                          {s.notes && <p className="mt-1 text-sm text-foreground/70">{s.notes}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => onDelete(s.id, s.date, libelleCategorie(s.categorie))}
                        disabled={deleteMutation.isPending}
                        className="rounded-md p-1.5 text-foreground/50 hover:bg-red-50 hover:text-red-600"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
