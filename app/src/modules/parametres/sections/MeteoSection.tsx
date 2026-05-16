import { updateMeteoSettings, useIntegrations, type MeteoSettings } from '../integrations.store';
import { useCan } from '../../users/permissions';
import { Field, SectionCard } from './_shared';
import { inputClass, selectClass } from './_styles';

const STATIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'PUY', label: 'PUY — Pully (VD)' },
  { id: 'WYN', label: 'WYN — Wynau (BE)' },
  { id: 'CHA', label: 'CHA — Chasseral (BE/NE)' },
  { id: 'PAY', label: 'PAY — Payerne (VD)' },
  { id: 'EVO', label: 'EVO — Évolène (VS)' },
  { id: 'GVE', label: 'GVE — Genève-Cointrin' },
  { id: 'GSB', label: 'GSB — Col du Grand-St-Bernard (VS)' },
  { id: 'MAH', label: 'MAH — Mathod (VD)' },
];

export function MeteoSection() {
  const { meteo } = useIntegrations();
  const canAdmin = useCan('parametres', 'admin');

  const setField = <K extends keyof MeteoSettings>(k: K, v: MeteoSettings[K]) =>
    updateMeteoSettings({ [k]: v } as Partial<MeteoSettings>);

  return (
    <div className="space-y-4">
      <SectionCard
        title="MétéoSuisse"
        description="Auto-remplir la météo lors des interventions, alertes pluie pour épandage. Branchement réel Phase 3."
      >
        <label className="mb-3 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={meteo.enabled}
            onChange={(e) => setField('enabled', e.target.checked)}
            disabled={!canAdmin}
          />
          Intégration MétéoSuisse activée
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Station de référence">
            <select
              value={meteo.stationId}
              onChange={(e) => setField('stationId', e.target.value)}
              className={selectClass}
              disabled={!canAdmin || !meteo.enabled}
            >
              {STATIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Latitude (WGS84)"
            hint="Position GPS de la ferme — utilisé en fallback si pas de station"
          >
            <input
              type="number"
              step="0.000001"
              value={meteo.latitude ?? ''}
              onChange={(e) =>
                setField('latitude', e.target.value ? Number(e.target.value) : (undefined as never))
              }
              placeholder="46.6447"
              className={inputClass}
              disabled={!canAdmin || !meteo.enabled}
            />
          </Field>
          <Field label="Longitude (WGS84)">
            <input
              type="number"
              step="0.000001"
              value={meteo.longitude ?? ''}
              onChange={(e) =>
                setField(
                  'longitude',
                  e.target.value ? Number(e.target.value) : (undefined as never),
                )
              }
              placeholder="6.6378"
              className={inputClass}
              disabled={!canAdmin || !meteo.enabled}
            />
          </Field>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={meteo.autoFillIntervention}
              onChange={(e) => setField('autoFillIntervention', e.target.checked)}
              disabled={!canAdmin || !meteo.enabled}
            />
            Auto-remplir la météo lors de la création d'une intervention
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={meteo.alertOnRainBeforeSpread}
              onChange={(e) => setField('alertOnRainBeforeSpread', e.target.checked)}
              disabled={!canAdmin || !meteo.enabled}
            />
            Alerter si {`>`} 5mm de pluie prévus 48h après un épandage
          </label>
        </div>
      </SectionCard>
    </div>
  );
}
