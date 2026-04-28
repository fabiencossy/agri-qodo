"use client";

import { Beef, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { useAnimauxSummary, useCreateBatch, useRemoveBatch } from "@/lib/animaux";
import {
  type AnimalCategorie,
  CATEGORIES_ORDER,
  emojiCategorie,
  libelleCategorie,
} from "@/lib/srpa";

export default function AnimauxPage() {
  const summary = useAnimauxSummary();
  const totalActifs = (summary.data ?? []).reduce((acc, s) => acc + s.nombreActifs, 0);

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Cheptel" }]} />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Beef className="h-7 w-7 text-green" />
              Cheptel
            </h1>
            <p className="mt-1 text-foreground/70">
              {summary.data
                ? `${totalActifs} animal${totalActifs > 1 ? "x" : ""} actif${totalActifs > 1 ? "s" : ""} sur l'exploitation`
                : "Chargement…"}
            </p>
          </div>
        </div>

        {summary.isError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger le cheptel.
          </div>
        )}

        {summary.data && (
          <div className="space-y-3">
            {CATEGORIES_ORDER.map((cat) => {
              const row = summary.data?.find((s) => s.categorie === cat);
              return <CategorieRow key={cat} categorie={cat} current={row?.nombreActifs ?? 0} />;
            })}
          </div>
        )}
      </div>
    </>
  );
}

function CategorieRow({ categorie, current }: { categorie: AnimalCategorie; current: number }) {
  const [delta, setDelta] = useState(1);
  const createBatch = useCreateBatch();
  const removeBatch = useRemoveBatch();
  const isPending = createBatch.isPending || removeBatch.isPending;

  const onAdd = () => {
    if (delta < 1) return;
    createBatch.mutate({ categorie, nombre: delta });
  };
  const onRemove = () => {
    if (delta < 1 || delta > current) return;
    if (!confirm(`Retirer ${delta} ${libelleCategorie(categorie).toLowerCase()} ?`)) return;
    removeBatch.mutate({ categorie, nombre: delta });
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background p-4 ${
        current === 0 ? "opacity-60" : ""
      }`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green/10 text-2xl">
        {emojiCategorie(categorie)}
      </span>
      <div className="flex-1">
        <div className="font-medium">{libelleCategorie(categorie)}</div>
        <div className="text-sm tabular-nums text-foreground/60">
          {current} actif{current > 1 ? "s" : ""}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={9999}
          value={delta}
          onChange={(e) => setDelta(Math.max(1, Number(e.target.value) || 1))}
          className="h-10 w-20 rounded-lg border border-border bg-background px-2 text-base tabular-nums"
        />
        <Button
          variant="ghost"
          onClick={onRemove}
          disabled={isPending || current === 0 || delta > current}
          aria-label="Retirer"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button onClick={onAdd} disabled={isPending} aria-label="Ajouter">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
