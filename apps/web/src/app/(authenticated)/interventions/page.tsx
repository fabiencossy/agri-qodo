"use client";

/**
 * Page conservée pour compat des anciens liens. Redirige vers
 * /activites où le carnet, les travaux tiers et les travaux internes
 * cohabitent dans une seule liste avec filtres (décision Fabien
 * 2026-05-06 : "il ne faut pas une page carnet des champs mais
 * uniquement une page qui regroupe tout").
 */
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function InterventionsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/activites");
  }, [router]);
  return null;
}
