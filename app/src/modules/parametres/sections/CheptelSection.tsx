import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LIVESTOCK_CATALOG, SPECIES_LABELS } from '../../troupeau/livestock.catalog';
import { useLivestockEntries, resetLivestockToMocks } from '../../troupeau/livestock.store';
import { balanceForFarm } from '../../troupeau/livestock.helpers';
import type { LivestockSpecies } from '../../troupeau/livestock.types';
import { useCan } from '../../users/permissions';
import { SectionCard, EmptyState, SecondaryButton, PrimaryButton } from './_shared';
import { inputClass } from './_styles';

export function CheptelSection() {
  const entries = useLivestockEntries();
  const canAdmin = useCan('parametres', 'admin');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LivestockSpecies | 'all'>('all');

  const balance = useMemo(() => balanceForFarm(entries), [entries]);

  const filteredCatalog = useMemo(() => {
    const lc = search.toLowerCase().trim();
    return LIVESTOCK_CATALOG.filter((c) => {
      if (filter !== 'all' && c.species !== filter) return false;
      if (!lc) return true;
      return c.label.toLowerCase().includes(lc) || (c.description ?? '').toLowerCase().includes(lc);
    });
  }, [search, filter]);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Effectifs de l'exploitation"
        description="Saisis sur la page /troupeau et utilisés pour le bilan de fumure exploitation."
        actions={
          <Link to="/troupeau">
            <PrimaryButton>Aller au module Troupeau</PrimaryButton>
          </Link>
        }
      >
        {entries.length === 0 ? (
          <EmptyState>Aucun effectif enregistré.</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Têtes" value={balance.totalHeadCount.toString()} />
            <Stat label="UGB" value={balance.totalUgb.toString()} />
            <Stat label="N excrété" value={`${balance.totalNKg.toLocaleString('fr-CH')} kg/an`} />
            <Stat
              label="P₂O₅ excrété"
              value={`${balance.totalPKg.toLocaleString('fr-CH')} kg/an`}
            />
          </div>
        )}
        {canAdmin && entries.length > 0 && (
          <div className="mt-3 flex justify-end">
            <SecondaryButton
              onClick={() => {
                if (confirm('Réinitialiser les effectifs avec les mocks Darval ?')) {
                  resetLivestockToMocks();
                }
              }}
            >
              Réinitialiser aux mocks
            </SecondaryButton>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={`Catalogue ${filteredCatalog.length} catégories`}
        description="Normes UGB et excrétions selon DBF Agroscope 2017 / OEngrais 2024. Référentiel figé."
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une catégorie"
            className={`${inputClass} max-w-sm`}
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as LivestockSpecies | 'all')}
            className={`${inputClass} max-w-xs`}
          >
            <option value="all">Toutes espèces</option>
            {Object.entries(SPECIES_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-(--color-border) text-left text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
                <th className="py-2 pr-2">Catégorie</th>
                <th className="px-2 py-2 text-right">UGB</th>
                <th className="px-2 py-2 text-right">N kg/an</th>
                <th className="px-2 py-2 text-right">P₂O₅ kg/an</th>
                <th className="px-2 py-2 text-right">K₂O kg/an</th>
                <th className="px-2 py-2 text-right">Effluents/an</th>
              </tr>
            </thead>
            <tbody>
              {filteredCatalog.map((c) => (
                <tr key={c.key} className="border-b border-(--color-border)">
                  <td className="py-2 pr-2">
                    <div className="font-medium">{c.label}</div>
                    {c.description && (
                      <div className="text-[11px] text-(--color-muted)">{c.description}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{c.ugbPerHead}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{c.nKgPerHeadYear}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{c.pKgPerHeadYear}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{c.kKgPerHeadYear}</td>
                  <td className="px-2 py-2 text-right text-[11px] text-(--color-muted)">
                    {c.manureVolumePerHeadYear} {c.manureVolumeUnit === 'm3' ? 'm³' : 't'}{' '}
                    {c.manureType === 'lisier'
                      ? 'lisier'
                      : c.manureType === 'fientes'
                        ? 'fientes'
                        : 'fumier'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-(--radius-sm) border border-(--color-border) bg-[#fbfbf9] p-3">
      <div className="text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
