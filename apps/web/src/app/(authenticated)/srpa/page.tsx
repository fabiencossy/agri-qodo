import { ClipboardList } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export default function SrpaPage() {
  return (
    <ComingSoon
      icon={ClipboardList}
      title="SRPA — Sorties au pâturage"
      module="M5 — Journal des sorties"
      description="Saisie quotidienne en 5 secondes : par catégorie d'animaux, géo-tag automatique, alertes en cas de défaut de sortie, registre annuel exportable."
    />
  );
}
