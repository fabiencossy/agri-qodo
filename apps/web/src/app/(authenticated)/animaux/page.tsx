"use client";

import { Beef, Check, List, Minus, Plus, Tag, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IdentifierBovinDialog } from "@/components/animaux/identifier-bovin-dialog";
import { ImportBdtaDialog } from "@/components/animaux/import-bdta-dialog";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { isBovin, useAnimauxSummary, useSetEffectif, useUgb } from "@/lib/animaux";
import {
  type AnimalCategorie,
  CATEGORIES_ORDER,
  emojiCategorie,
  libelleCategorie,
} from "@/lib/srpa";

export default function AnimauxPage() {
  const summary = useAnimauxSummary();
  const ugb = useUgb();
  const [importOpen, setImportOpen] = useState(false);
  const totalActifs = (summary.data ?? []).reduce((acc, s) => acc + s.nombreActifs, 0);

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Cheptel" }]} />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Beef className="h-7 w-7 text-green" />
              Cheptel
            </h1>
            <p className="mt-1 text-foreground/70">
              {summary.data
                ? `${totalActifs} animau${totalActifs > 1 ? "x" : "l"} actif${totalActifs > 1 ? "s" : ""} sur l'exploitation`
                : "Chargement…"}
              {ugb.data && totalActifs > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatUgb(ugb.data.total)} UGB
                  </span>
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-foreground/50">
              UGB calculé selon Annexe 1 OPD (référentiel officiel CH). Le coefficient s'affine
              automatiquement quand la date de naissance d'un bovin est connue.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/animaux/liste">
              <Button variant="secondary">
                <List className="mr-1 h-4 w-4" />
                Vue détaillée
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1 h-4 w-4" />
              Importer depuis BDTA
            </Button>
          </div>
        </div>
        <ImportBdtaDialog open={importOpen} onClose={() => setImportOpen(false)} />

        {summary.isError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger le cheptel.
          </div>
        )}

        {summary.data && (
          <div className="space-y-3">
            {CATEGORIES_ORDER.map((cat) => {
              const row = summary.data?.find((s) => s.categorie === cat);
              const ugbRow = ugb.data?.parCategorie.find((p) => p.categorie === cat);
              return (
                <CategorieRow
                  key={cat}
                  categorie={cat}
                  current={row?.nombreActifs ?? 0}
                  ugbTotal={ugbRow?.ugbTotal ?? null}
                  coefMoyen={ugbRow?.coefMoyen ?? null}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function formatUgb(n: number): string {
  return n.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CategorieRow({
  categorie,
  current,
  ugbTotal,
  coefMoyen,
}: {
  categorie: AnimalCategorie;
  current: number;
  ugbTotal: number | null;
  coefMoyen: number | null;
}) {
  const [target, setTarget] = useState<number>(current);
  const [identifierOpen, setIdentifierOpen] = useState(false);
  const setEffectif = useSetEffectif();
  const isBovinCat = isBovin(categorie);

  // Resync local input quand le serveur renvoie une nouvelle valeur (après mutation
  // ou après chargement initial). Évite de désynchroniser si l'utilisateur tape.
  useEffect(() => {
    setTarget(current);
  }, [current]);

  const dirty = target !== current;
  const isPending = setEffectif.isPending;

  const onSave = () => {
    if (!dirty || target < 0) return;
    if (target < current) {
      const removed = current - target;
      const ok = confirm(
        `Retirer ${removed} ${libelleCategorie(categorie).toLowerCase()} ? Les non-identifiés sont retirés en priorité.`,
      );
      if (!ok) return;
    }
    setEffectif.mutate({ categorie, total: target });
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background p-4 ${
        current === 0 && !dirty ? "opacity-60" : ""
      }`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green/10 text-2xl">
        {emojiCategorie(categorie)}
      </span>
      <div className="flex-1">
        <div className="font-medium">{libelleCategorie(categorie)}</div>
        <div className="text-sm tabular-nums text-foreground/60">
          {current} actif{current > 1 ? "s" : ""}
          {current > 0 && ugbTotal !== null && coefMoyen !== null && (
            <span className="ml-2 text-foreground/50">
              · {formatUgb(ugbTotal)} UGB{" "}
              <span className="text-foreground/40">(× {coefMoyen})</span>
            </span>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        onClick={() => setTarget(Math.max(0, target - 1))}
        disabled={isPending || target === 0}
        aria-label="Diminuer le total"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <input
        type="number"
        min={0}
        max={99999}
        value={target}
        onChange={(e) => setTarget(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="h-10 w-24 rounded-lg border border-border bg-background px-2 text-center text-base tabular-nums"
      />
      <Button
        variant="ghost"
        onClick={() => setTarget(target + 1)}
        disabled={isPending}
        aria-label="Augmenter le total"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button onClick={onSave} disabled={!dirty || isPending}>
        <Check className="mr-1 h-4 w-4" />
        Valider
      </Button>
      {isBovinCat && current > 0 && (
        <Button
          variant="secondary"
          onClick={() => setIdentifierOpen(true)}
          aria-label="Identifier les bovins"
        >
          <Tag className="mr-1 h-4 w-4" />
          Identifier
        </Button>
      )}
      {isBovinCat && (
        <IdentifierBovinDialog
          categorie={categorie}
          totalActifs={current}
          open={identifierOpen}
          onClose={() => setIdentifierOpen(false)}
        />
      )}
    </div>
  );
}
