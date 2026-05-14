import { redirect } from "next/navigation";

/**
 * La vue détail "lecture seule" d'un Travail est supprimée — décision
 * Fabien 2026-05-14 "les champs tjs ouverts". On redirige directement
 * vers le formulaire d'édition (`/travaux/new?edit=ID`) qui montre
 * tous les champs en mode éditable + Total HT + bandeau Push Odoo +
 * boutons Valider / Annuler.
 */
export default async function TravailDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<never> {
  const { id } = await params;
  redirect(`/travaux/new?edit=${id}`);
}
