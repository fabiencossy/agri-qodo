import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FabAction } from './FabContext';
import { useInterventionForm } from './InterventionFormProvider';
import {
  FabCalendarIcon,
  FabClockIcon,
  FabDrawIcon,
  FabInterventionIcon,
  FabObserveIcon,
  FabOpenIcon,
} from './fab-icons';

/**
 * Identifie l'action mise en avant (variant 'primary') sur la page courante.
 * Permet à chaque page de signaler son action contextuelle dominante sans
 * dupliquer la liste de toutes les actions.
 */
export type FabHighlight =
  | 'intervention'
  | 'observation'
  | 'segment'
  | 'parcelle'
  | 'horaires'
  | 'open-fiche'
  | null;

export interface StandardFabOpts {
  /** Action à mettre en avant pour cette page. */
  highlight?: FabHighlight;
  /** Si une parcelle est sélectionnée/en focus : pré-remplit les liens carnet/assolement. */
  parcelId?: string;
  /** Override pour "Ajouter un segment" — utile depuis ParcelleDetailPage (ouvre l'éditeur inline plutôt que navigate). */
  onAddSegment?: () => void;
  /** Override pour "Nouvelle parcelle" — utile depuis ParcellairePage (active l'outil dessin sur la carte). */
  onNewParcel?: () => void;
  /** Override pour "Créer une intervention" — utile pour ouvrir un modal local plutôt que navigate. */
  onAddIntervention?: () => void;
  /** Override pour "Ajouter une observation". */
  onAddObservation?: () => void;
  /** Actions supplémentaires (en tête de liste) — ex: "Ouvrir la fiche" sur la carte avec sélection. */
  extraActions?: ReadonlyArray<FabAction>;
  /**
   * Si vrai, **n'affiche QUE les `extraActions`** (en mode invité/managed, où
   * Intervention / Observation / Segment / Présence renvoient à des modules
   * bloqués et seraient trompeurs). La page parent doit fournir au moins une
   * extraAction (typiquement "Nouveau bon de travail").
   */
  onlyExtraActions?: boolean;
}

/**
 * Set d'actions FAB **standard** présentes sur toutes les pages.
 *
 * Le but : l'utilisateur retrouve toujours les mêmes actions principales depuis
 * n'importe quelle page de l'app — création d'intervention, observation,
 * segment d'assolement, parcelle, saisie horaire. La page courante met en
 * avant celle qui correspond à son contexte (variant 'primary').
 *
 * @see FabAction
 */
export function useStandardFabActions(opts: StandardFabOpts = {}): FabAction[] {
  const navigate = useNavigate();
  const { openInterventionForm } = useInterventionForm();
  const {
    highlight,
    parcelId,
    onAddSegment,
    onNewParcel,
    onAddIntervention,
    onAddObservation,
    extraActions,
    onlyExtraActions,
  } = opts;

  return useMemo<FabAction[]>(() => {
    // Mode invité/managed : on n'expose QUE les extraActions de la page.
    // Évite d'afficher "Créer une intervention", "Ajouter un segment", etc.
    // qui pointeraient vers Carnet/Assolement/RH bloqués → trompeur.
    if (onlyExtraActions) {
      return extraActions ? [...extraActions] : [];
    }
    const assolementUrl = parcelId ? `/assolement?parcel=${parcelId}` : '/assolement';
    const primary = (h: FabHighlight) =>
      h === highlight ? ('primary' as const) : ('secondary' as const);

    // "Créer une intervention" est l'action métier la plus importante de l'app :
    // toujours en première position, jamais déplacée. Ouvre directement le
    // formulaire en modal global (pas de navigation).
    const intervention: FabAction = {
      id: 'std-intervention',
      label: 'Créer une intervention',
      icon: <FabInterventionIcon />,
      variant: primary('intervention'),
      onClick: onAddIntervention ?? (() => openInterventionForm({ parcelId })),
    };

    const others: FabAction[] = [
      {
        id: 'std-observation',
        label: 'Ajouter une observation',
        icon: <FabObserveIcon />,
        variant: primary('observation'),
        onClick:
          onAddObservation ?? (() => openInterventionForm({ parcelId, category: 'observation' })),
      },
      {
        id: 'std-segment',
        label: "Ajouter un segment d'assolement",
        icon: <FabCalendarIcon />,
        variant: primary('segment'),
        onClick: onAddSegment ?? (() => navigate(assolementUrl)),
      },
      {
        id: 'std-parcelle',
        label: 'Nouvelle parcelle (dessin)',
        icon: <FabDrawIcon />,
        variant: primary('parcelle'),
        onClick: onNewParcel ?? (() => navigate('/parcellaire')),
      },
      {
        id: 'std-horaires',
        label: 'Saisir une présence',
        icon: <FabClockIcon />,
        variant: primary('horaires'),
        onClick: () => navigate('/rh/saisir'),
      },
    ];

    // Si une action autre que "Créer une intervention" est en surbrillance,
    // on la remonte juste après "Créer une intervention" — visibilité immédiate
    // de l'action contextuelle dominante de la page courante.
    if (highlight && highlight !== 'intervention') {
      const idx = others.findIndex((a) => a.variant === 'primary');
      if (idx > 0) {
        const [highlighted] = others.splice(idx, 1);
        if (highlighted) others.unshift(highlighted);
      }
    }

    const standard: FabAction[] = [intervention, ...others];
    return extraActions && extraActions.length > 0 ? [...extraActions, ...standard] : standard;
  }, [
    navigate,
    openInterventionForm,
    parcelId,
    highlight,
    onAddIntervention,
    onAddObservation,
    onAddSegment,
    onNewParcel,
    extraActions,
    onlyExtraActions,
  ]);
}

/**
 * Helper : crée une action contextuelle "Ouvrir la fiche" à passer en `extraActions`
 * quand une parcelle est sélectionnée sur la carte. Le `parcelId` est utilisé
 * comme identifiant de l'action et figure dans l'aria-label pour cohérence.
 */
export function openFicheAction(parcelId: string, onClick: () => void): FabAction {
  return {
    id: `open-fiche-${parcelId}`,
    label: 'Ouvrir la fiche',
    icon: <FabOpenIcon />,
    variant: 'primary',
    onClick,
  };
}
