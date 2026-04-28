import { Sprout } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export default function InterventionsPage() {
  return (
    <ComingSoon
      icon={Sprout}
      title="Carnet des champs"
      module="M2 — Saisie des interventions"
      description="Saisissez vos semis, fumures, traitements phyto et récoltes en moins de 30 secondes. Catalogue produits OFAG, photos, signature électronique et alertes délais d'attente."
    />
  );
}
