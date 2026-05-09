/**
 * Liste des codes espèce reconnus par le Suisse-Bilanz (clés
 * `besoinNParCulture` du domain). Sert de catalogue UI pour le select
 * « Culture en place » sur la fiche parcelle. Si l'agriculteur saisit
 * un code absent de cette liste, le bilan le signalera dans
 * « Cultures sans coefficient connu ».
 */
export interface CultureOption {
  code: string;
  label: string;
  groupe:
    | "Grandes cultures"
    | "Prairies & pâturages"
    | "Vergers & vigne"
    | "Légumes"
    | "SPB / jachère";
}

export const CULTURE_OPTIONS: CultureOption[] = [
  // Prairies & pâturages — en premier car typique d'un statut initial
  { code: "prairie_permanente", label: "Prairie permanente", groupe: "Prairies & pâturages" },
  { code: "prairie_temporaire", label: "Prairie temporaire", groupe: "Prairies & pâturages" },
  { code: "paturage_intensif", label: "Pâturage intensif", groupe: "Prairies & pâturages" },
  { code: "paturage_extensif", label: "Pâturage extensif", groupe: "Prairies & pâturages" },
  { code: "prairie_extensive", label: "Prairie extensive (SPB)", groupe: "Prairies & pâturages" },
  {
    code: "prairie_peu_intensive",
    label: "Prairie peu intensive (SPB)",
    groupe: "Prairies & pâturages",
  },
  // Grandes cultures
  { code: "ble_panifiable", label: "Blé panifiable", groupe: "Grandes cultures" },
  { code: "ble_fourrager", label: "Blé fourrager", groupe: "Grandes cultures" },
  { code: "orge", label: "Orge", groupe: "Grandes cultures" },
  { code: "mais_grain", label: "Maïs grain", groupe: "Grandes cultures" },
  { code: "mais_ensilage", label: "Maïs ensilage", groupe: "Grandes cultures" },
  { code: "colza", label: "Colza", groupe: "Grandes cultures" },
  { code: "tournesol", label: "Tournesol", groupe: "Grandes cultures" },
  { code: "pomme_de_terre", label: "Pomme de terre", groupe: "Grandes cultures" },
  { code: "betterave_sucre", label: "Betterave sucrière", groupe: "Grandes cultures" },
  { code: "soja", label: "Soja", groupe: "Grandes cultures" },
  { code: "pois_proteagineux", label: "Pois protéagineux", groupe: "Grandes cultures" },
  { code: "feverole", label: "Féverole", groupe: "Grandes cultures" },
  { code: "luzerne", label: "Luzerne", groupe: "Grandes cultures" },
  // Vergers & vigne
  { code: "vigne", label: "Vigne", groupe: "Vergers & vigne" },
  { code: "verger_pommes", label: "Verger pommes", groupe: "Vergers & vigne" },
  { code: "verger_poires", label: "Verger poires", groupe: "Vergers & vigne" },
  { code: "verger_cerises", label: "Verger cerises", groupe: "Vergers & vigne" },
  { code: "verger_prunes", label: "Verger prunes", groupe: "Vergers & vigne" },
  { code: "verger_abricots", label: "Verger abricots", groupe: "Vergers & vigne" },
  // Légumes
  { code: "carotte", label: "Carotte", groupe: "Légumes" },
  { code: "oignon", label: "Oignon", groupe: "Légumes" },
  { code: "poireau", label: "Poireau", groupe: "Légumes" },
  { code: "courge", label: "Courge", groupe: "Légumes" },
  { code: "salade", label: "Salade", groupe: "Légumes" },
  // SPB / jachère
  { code: "jachere_florale", label: "Jachère florale (SPB)", groupe: "SPB / jachère" },
  { code: "jachere_tournante", label: "Jachère tournante (SPB)", groupe: "SPB / jachère" },
  { code: "bande_fleurie", label: "Bande fleurie (SPB)", groupe: "SPB / jachère" },
  { code: "surface_litiere", label: "Surface à litière (SPB)", groupe: "SPB / jachère" },
];

export const CULTURE_LABEL_BY_CODE = new Map(CULTURE_OPTIONS.map((c) => [c.code, c.label]));

/** Libellé humain pour un code, avec fallback sur le code brut si inconnu. */
export function libelleCulture(code: string | null | undefined): string {
  if (!code) return "—";
  return CULTURE_LABEL_BY_CODE.get(code) ?? code;
}
