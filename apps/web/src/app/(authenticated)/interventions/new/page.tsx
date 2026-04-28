import { Sprout } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export default function NewInterventionPage() {
  return (
    <ComingSoon
      icon={Sprout}
      title="Nouvelle intervention"
      module="M2 — Saisie d'intervention"
      description="Le formulaire de saisie rapide arrive très bientôt. Sélection parcelle, type d'opération, produit, quantité et c'est tout."
    />
  );
}
