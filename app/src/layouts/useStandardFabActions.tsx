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
    // "Cette page" = uniquement l'action contextuelle dominante (highlight)
    // + les éventuelles extraActions de la page. Le reste est accessible via
    // le catalogue global "Tous les secteurs" — pas de duplication.
    if (onlyExtraActions) {
      return extraActions ? [...extraActions] : [];
    }

    const assolementUrl = parcelId ? `/assolement?parcel=${parcelId}` : '/assolement';

    const highlightedAction: FabAction | null = (() => {
      switch (highlight) {
        case 'intervention':
          return {
            id: 'std-intervention',
            label: 'Créer une intervention',
            icon: <FabInterventionIcon />,
            variant: 'primary',
            onClick: onAddIntervention ?? (() => openInterventionForm({ parcelId })),
          };
        case 'observation':
          return {
            id: 'std-observation',
            label: 'Ajouter une observation',
            icon: <FabObserveIcon />,
            variant: 'primary',
            onClick:
              onAddObservation ??
              (() => openInterventionForm({ parcelId, category: 'observation' })),
          };
        case 'segment':
          return {
            id: 'std-segment',
            label: "Ajouter un segment d'assolement",
            icon: <FabCalendarIcon />,
            variant: 'primary',
            onClick: onAddSegment ?? (() => navigate(assolementUrl)),
          };
        case 'parcelle':
          return {
            id: 'std-parcelle',
            label: 'Nouvelle parcelle (dessin)',
            icon: <FabDrawIcon />,
            variant: 'primary',
            onClick: onNewParcel ?? (() => navigate('/parcellaire')),
          };
        case 'horaires':
          return {
            id: 'std-horaires',
            label: 'Saisir une présence',
            icon: <FabClockIcon />,
            variant: 'primary',
            onClick: () => navigate('/rh/saisir'),
          };
        default:
          return null;
      }
    })();

    const result: FabAction[] = [];
    if (extraActions && extraActions.length > 0) result.push(...extraActions);
    if (highlightedAction) result.push(highlightedAction);
    return result;
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
