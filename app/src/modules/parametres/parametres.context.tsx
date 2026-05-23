import { createContext, useContext, type ReactNode } from 'react';

const ParametresMobileSelectorContext = createContext<ReactNode>(null);

export const ParametresMobileSelectorProvider = ParametresMobileSelectorContext.Provider;

/** Hook pour SectionCard et toute section qui veut injecter l'engrenage de
 *  navigation paramètres dans son header. Retourne `null` hors ParametresLayout. */
export function useParametresMobileSelector(): ReactNode {
  return useContext(ParametresMobileSelectorContext);
}
