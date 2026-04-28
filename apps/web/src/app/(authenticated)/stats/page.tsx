import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export default function StatsPage() {
  return (
    <ComingSoon
      icon={BarChart3}
      title="Statistiques"
      module="M12 — Pilotage économique (V3)"
      description="Marge brute par parcelle et par culture, marge par UGB, simulateur paiements directs, benchmarking anonymisé entre exploitations comparables."
    />
  );
}
