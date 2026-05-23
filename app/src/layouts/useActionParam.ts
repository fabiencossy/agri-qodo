import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Consomme un (ou plusieurs) `?action=...&...autres params` depuis l'URL
 * et appelle `onAction({ action, params })`. Purge l'URL après consommation
 * pour éviter de re-déclencher au refresh / navigation arrière.
 *
 * Patte principale du FAB : pages consomment via ce hook.
 */
export function useActionParam(
  onAction: (ctx: { action: string; params: URLSearchParams }) => void,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const action = searchParams.get('action');
    if (!action) return;
    onAction({ action, params: searchParams });
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    // Conserve les autres params éventuels que l'appelant a déjà consommés ;
    // libre à lui de les supprimer s'ils étaient à usage unique.
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
}
