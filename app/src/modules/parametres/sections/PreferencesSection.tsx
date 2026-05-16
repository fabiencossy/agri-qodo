import { useState } from 'react';
import { usePreferences, updatePreferences } from '../preferences.store';
import { useCan } from '../../users/permissions';
import { Field, SectionCard, PrimaryButton } from './_shared';
import { selectClass } from './_styles';

export function PreferencesSection() {
  const prefs = usePreferences();
  const canWrite = useCan('parametres', 'admin');
  const [draft, setDraft] = useState(prefs);
  const [saved, setSaved] = useState(false);

  const setField = <K extends keyof typeof prefs>(k: K, v: (typeof prefs)[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const submit = () => {
    updatePreferences(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Format & affichage">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Langue d'interface">
            <select
              value={draft.language}
              onChange={(e) => setField('language', e.target.value as typeof draft.language)}
              className={selectClass}
              disabled={!canWrite}
            >
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label="Format de date">
            <select
              value={draft.dateFormat}
              onChange={(e) => setField('dateFormat', e.target.value as typeof draft.dateFormat)}
              className={selectClass}
              disabled={!canWrite}
            >
              <option value="dd.MM.yyyy">31.12.2026 (Suisse)</option>
              <option value="dd/MM/yyyy">31/12/2026</option>
              <option value="yyyy-MM-dd">2026-12-31 (ISO)</option>
            </select>
          </Field>
          <Field label="Devise">
            <select
              value={draft.currency}
              onChange={(e) => setField('currency', e.target.value as typeof draft.currency)}
              className={selectClass}
              disabled={!canWrite}
            >
              <option value="CHF">CHF (franc suisse)</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
          <Field label="Unité de surface">
            <select
              value={draft.surfaceUnit}
              onChange={(e) => setField('surfaceUnit', e.target.value as typeof draft.surfaceUnit)}
              className={selectClass}
              disabled={!canWrite}
            >
              <option value="ha">hectare (ha)</option>
              <option value="a">are (a)</option>
              <option value="m2">m²</option>
            </select>
          </Field>
          <Field label="Système d'unités">
            <select
              value={draft.unitSystem}
              onChange={(e) => setField('unitSystem', e.target.value as typeof draft.unitSystem)}
              className={selectClass}
              disabled={!canWrite}
            >
              <option value="metric">Métrique (kg, l)</option>
              <option value="imperial">Anglo-saxon (lb, gal)</option>
            </select>
          </Field>
          <Field label="Premier jour de la semaine">
            <select
              value={String(draft.firstDayOfWeek)}
              onChange={(e) => setField('firstDayOfWeek', Number(e.target.value) as 0 | 1)}
              className={selectClass}
              disabled={!canWrite}
            >
              <option value="1">Lundi</option>
              <option value="0">Dimanche</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Notifications">
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.notifyOnBalanceOver}
              onChange={(e) => setField('notifyOnBalanceOver', e.target.checked)}
              disabled={!canWrite}
            />
            Avertir si bilan de fumure {'>'} 110% des besoins (dépassement OEngrais)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.notifyOnWithholdingViolation}
              onChange={(e) => setField('notifyOnWithholdingViolation', e.target.checked)}
              disabled={!canWrite}
            />
            Avertir si récolte dans le délai d'attente phyto
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.notifyOnLowDosage}
              onChange={(e) => setField('notifyOnLowDosage', e.target.checked)}
              disabled={!canWrite}
            />
            Avertir si dose phyto en dehors de la plage OFAG
          </label>
        </div>
      </SectionCard>

      {canWrite && (
        <div className="flex items-center justify-end gap-2">
          {saved && <span className="text-xs text-(--color-success)">Enregistré ✓</span>}
          <PrimaryButton onClick={submit}>Enregistrer</PrimaryButton>
        </div>
      )}

      <p className="m-0 text-[11px] text-(--color-muted)">
        Les préférences sont stockées localement dans ce navigateur. Phase 3 : synchronisation avec
        le profil utilisateur côté serveur.
      </p>
    </div>
  );
}
