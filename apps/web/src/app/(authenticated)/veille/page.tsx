import { BookOpen } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export default function VeillePage() {
  return (
    <ComingSoon
      icon={BookOpen}
      title="Veille réglementaire"
      module="M15 — Documentation OPD/OPPh"
      description="Bibliothèque OPD, OPPh et guides Agridea avec résumés en français paysan, glossaire métier, calendrier réglementaire et alertes push sur les changements."
    />
  );
}
