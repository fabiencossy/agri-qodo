"use client";

import { Button } from "@/components/ui/button";
import {
  HeuresSimplesInput,
  type HeuresSimplesValue,
} from "@/components/activites/heures-simples-input";
import { FullscreenSheet } from "@/components/activites/fullscreen-sheet";

/**
 * Modal plein écran "Ajouter du temps" — début, fin, pause, durée
 * effective. Pas de taux horaire ici (décision Fabien 2026-05-14 :
 * "il ne faut pas mettre de taux horaire").
 */
export function TempsSheet({
  value,
  onChange,
  onClose,
}: {
  value: HeuresSimplesValue;
  onChange: (v: HeuresSimplesValue) => void;
  onClose: () => void;
}) {
  return (
    <FullscreenSheet
      title="Ajouter du temps"
      onClose={onClose}
      footer={
        <Button type="button" onClick={onClose} className="h-11 px-6">
          OK
        </Button>
      }
    >
      <HeuresSimplesInput value={value} onChange={onChange} />
    </FullscreenSheet>
  );
}
