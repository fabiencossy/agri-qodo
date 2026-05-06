"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Page conservée pour compat des anciens liens. Redirige vers /produits
 * où Biens et Prestations cohabitent désormais (fusion 2026-05-06).
 */
export default function MaterielsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/produits");
  }, [router]);
  return null;
}
