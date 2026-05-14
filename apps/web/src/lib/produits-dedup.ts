/**
 * Déduplication par libellé pour les listes produits et matériels.
 * Centralise la logique partagée entre /produits, le picker plein écran
 * et la sheet "Ajouter des produits".
 *
 * Stratégie de tri (cf Fabien 2026-05-06 "tjs des doublons" ×3) :
 *   1. Perso mappé Odoo + catégorie réelle      (priorité haute)
 *   2. Global avec catégorie réelle
 *   3. Perso mappé Odoo en catégorie AUTRE (issu d'une sync foireuse)
 *   4. Perso non mappé Odoo
 *   5. Reste
 */
import type { Materiel } from "./materiels";
import type { Produit } from "./produits";

export function dedupProduits(list: Produit[]): Produit[] {
  const groups = new Map<string, Produit[]>();
  for (const p of list) {
    const key = p.libelle.toLowerCase().trim();
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }
  const result: Produit[] = [];
  for (const arr of groups.values()) {
    arr.sort((a, b) => scoreProduit(a) - scoreProduit(b));
    if (arr[0]) result.push(arr[0]);
  }
  return result;
}

function scoreProduit(p: Produit): number {
  const isPersoMapped = p.tenantId !== null && p.odooProductId !== null;
  const isReal = p.categorie !== "AUTRE";
  if (isPersoMapped && isReal) return 0;
  if (p.tenantId === null && isReal) return 1;
  if (isPersoMapped) return 2;
  if (p.tenantId !== null) return 3;
  return 4;
}

export function dedupMateriels(list: Materiel[]): Materiel[] {
  const groups = new Map<string, Materiel[]>();
  for (const m of list) {
    const key = m.libelle.toLowerCase().trim();
    const arr = groups.get(key) ?? [];
    arr.push(m);
    groups.set(key, arr);
  }
  const result: Materiel[] = [];
  for (const arr of groups.values()) {
    arr.sort((a, b) => scoreMateriel(a) - scoreMateriel(b));
    if (arr[0]) result.push(arr[0]);
  }
  return result;
}

function scoreMateriel(m: Materiel): number {
  const isPersoMapped = m.tenantId !== null && m.odooProductId !== null;
  const isReal = m.categorie !== "AUTRE";
  if (isPersoMapped && isReal) return 0;
  if (m.tenantId === null && isReal) return 1;
  if (isPersoMapped) return 2;
  if (m.tenantId !== null) return 3;
  return 4;
}
