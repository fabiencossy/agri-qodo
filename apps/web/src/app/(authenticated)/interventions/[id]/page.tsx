import { redirect } from "next/navigation";

/**
 * La vue détail "lecture seule" d'une Intervention est supprimée —
 * décision Fabien 2026-05-14 : "les champs tjs ouverts" (idem Travail).
 * On redirige directement vers `/interventions/new?edit=ID` qui montre
 * tous les champs immédiatement modifiables.
 */
export default async function InterventionDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<never> {
  const { id } = await params;
  redirect(`/interventions/new?edit=${id}`);
}
