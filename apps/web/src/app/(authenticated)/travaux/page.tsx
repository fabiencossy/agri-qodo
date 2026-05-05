import { redirect } from "next/navigation";

/**
 * /travaux est unifié dans /activites (PRD fusion v0.2). Cette ancienne
 * route reste accessible pour rétro-compat mais redirige.
 */
export default function TravauxRedirect(): never {
  redirect("/activites");
}
