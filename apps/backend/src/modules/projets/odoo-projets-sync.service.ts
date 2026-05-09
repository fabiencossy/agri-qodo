/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import { OdooClientManager } from "@/modules/odoo/odoo-client-manager.service";

/**
 * Sync bidirectionnelle Projet AQ ↔ project.project Odoo (2026-05-09).
 *
 * Décision Fabien : « les projets Agri Qodo doivent être exactement les
 * mêmes qu'Odoo, bidirectionnel synchronisé ».
 *
 * Sens de sync :
 * - **Pull** (`pullFromOdoo`) : tous les `project.project` Odoo actifs
 *   du tenant sont upsertés en Projet AQ. Le mapping se fait par
 *   `odooProjectId`. Si un Projet AQ existe déjà avec cet ID, son nom
 *   et son archive sont mis à jour depuis Odoo. Si un Projet AQ
 *   n'existe pas encore (nouveau côté Odoo), il est créé avec type
 *   AUTRE par défaut.
 * - **Push create** (`pushCreate`) : un Projet AQ créé localement est
 *   poussé vers Odoo (project.project create), `odooProjectId` est
 *   stocké au retour.
 * - **Push update** (`pushUpdate`) : nom + archive (active=false) sont
 *   propagés vers Odoo si `odooProjectId` est posé.
 * - **Push archive** (`pushArchive`) : à la suppression côté AQ, on
 *   archive plutôt que supprimer côté Odoo (FK constraints).
 *
 * Tout est best-effort : si Odoo down ou non configuré, l'opération
 * AQ réussit quand même, l'utilisateur peut re-pousser via le bouton
 * Resync.
 */
@Injectable()
export class OdooProjetsSyncService {
  private readonly log = new Logger(OdooProjetsSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odoo: OdooClientManager,
  ) {}

  /**
   * Pull tous les `project.project` Odoo actifs du tenant et upsert
   * dans Projet AQ. Retourne un résumé pour l'UI.
   */
  async pullFromOdoo(tenantId: string): Promise<{
    pulled: number;
    created: number;
    updated: number;
    archivedFromOdoo: number;
    skipped: number;
  }> {
    const client = await this.odoo.forTenant(tenantId).catch(() => null);
    if (!client) {
      return { pulled: 0, created: 0, updated: 0, archivedFromOdoo: 0, skipped: 0 };
    }

    let rows: Array<{ id: number; name: string; active: boolean }>;
    try {
      // Inclut les inactifs pour propager l'archive côté AQ. Le filtre
      // `active=true` par défaut d'Odoo est contourné via le domain.
      rows = await client.searchRead<{ id: number; name: string; active: boolean }>(
        "project.project",
        ["|", ["active", "=", true], ["active", "=", false]],
        { fields: ["id", "name", "active"], limit: 500, order: "name asc" },
      );
    } catch (e) {
      this.log.warn(`pullFromOdoo échoué pour tenant ${tenantId} : ${(e as Error).message}`);
      return { pulled: 0, created: 0, updated: 0, archivedFromOdoo: 0, skipped: 0 };
    }

    const now = new Date();
    let created = 0;
    let updated = 0;
    let archivedFromOdoo = 0;
    let skipped = 0;

    for (const row of rows) {
      const existing = await this.prisma.projet.findFirst({
        where: { tenantId, odooProjectId: row.id },
        select: { id: true, nom: true, archive: true },
      });

      if (existing) {
        const wantArchive = !row.active;
        const wantNom = row.name.trim().slice(0, 120);
        const changes: { nom?: string; archive?: boolean } = {};
        if (wantNom !== existing.nom) changes.nom = wantNom;
        if (wantArchive !== existing.archive) changes.archive = wantArchive;
        if (Object.keys(changes).length === 0) {
          // Touch odooSyncedAt même sans changement pour traçabilité.
          await this.prisma.projet.update({
            where: { id: existing.id },
            data: { odooSyncedAt: now },
          });
          skipped++;
          continue;
        }
        try {
          await this.prisma.projet.update({
            where: { id: existing.id },
            data: { ...changes, odooSyncedAt: now },
          });
          updated++;
          if (changes.archive === true) archivedFromOdoo++;
        } catch {
          // Conflit unique sur nom (si un autre projet local porte déjà
          // ce nom) : on log et skip plutôt que de tomber.
          this.log.warn(
            `pullFromOdoo : conflit nom sur tenant ${tenantId} pour Odoo project ${row.id}`,
          );
          skipped++;
        }
        continue;
      }

      // Nouveau projet côté Odoo, pas encore dans AQ.
      try {
        const finalNom = await this.uniqueNom(tenantId, row.name.trim().slice(0, 120));
        await this.prisma.projet.create({
          data: {
            tenantId,
            nom: finalNom,
            type: "AUTRE",
            archive: !row.active,
            odooProjectId: row.id,
            odooSyncedAt: now,
          },
        });
        created++;
      } catch (e) {
        this.log.warn(`pullFromOdoo create skip ${row.name} : ${(e as Error).message}`);
        skipped++;
      }
    }

    return { pulled: rows.length, created, updated, archivedFromOdoo, skipped };
  }

  /**
   * Push un Projet AQ vers Odoo (create). Retourne l'odooProjectId créé,
   * ou null si Odoo non configuré / push échoué (best-effort).
   */
  async pushCreate(tenantId: string, projetId: string): Promise<number | null> {
    const projet = await this.prisma.projet.findFirst({
      where: { id: projetId, tenantId },
      select: {
        id: true,
        nom: true,
        description: true,
        odooProjectId: true,
        archive: true,
        dateDebut: true,
        dateFin: true,
        allowBillable: true,
        odooPartnerId: true,
      },
    });
    if (!projet) return null;
    if (projet.odooProjectId) return projet.odooProjectId; // déjà push

    const client = await this.odoo.forTenant(tenantId).catch(() => null);
    if (!client) return null;

    try {
      const payload: Record<string, unknown> = {
        name: projet.nom,
        active: !projet.archive,
        // Activate timesheets sur tous les projets sync depuis AQ —
        // les heures saisies AQ remonteront en account.analytic.line.
        allow_timesheets: true,
        allow_billable: projet.allowBillable,
      };
      if (projet.description) payload.description = projet.description;
      if (projet.dateDebut) payload.date_start = projet.dateDebut.toISOString().slice(0, 10);
      if (projet.dateFin) payload.date = projet.dateFin.toISOString().slice(0, 10);
      if (projet.odooPartnerId) payload.partner_id = projet.odooPartnerId;

      const odooId = await client.create("project.project", payload);
      await this.prisma.projet.update({
        where: { id: projet.id },
        data: { odooProjectId: odooId, odooSyncedAt: new Date() },
      });
      this.log.log(`pushCreate Projet ${projet.id} → Odoo project.project #${odooId}`);
      return odooId;
    } catch (e) {
      this.log.warn(`pushCreate échoué pour Projet ${projet.id} : ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Push update (nom + archive) vers Odoo. Best-effort. Skip si
   * `odooProjectId` n'est pas posé (le projet n'a pas encore été créé
   * côté Odoo ; on appelle `pushCreate` à la place).
   */
  async pushUpdate(
    tenantId: string,
    projetId: string,
    changes: { nom?: string; archive?: boolean },
  ): Promise<void> {
    if (Object.keys(changes).length === 0) return;
    const projet = await this.prisma.projet.findFirst({
      where: { id: projetId, tenantId },
      select: { id: true, odooProjectId: true },
    });
    if (!projet || !projet.odooProjectId) return;

    const client = await this.odoo.forTenant(tenantId).catch(() => null);
    if (!client) return;

    const payload: Record<string, unknown> = {};
    if (changes.nom !== undefined) payload.name = changes.nom;
    if (changes.archive !== undefined) payload.active = !changes.archive;

    try {
      await client.write("project.project", [projet.odooProjectId], payload);
      await this.prisma.projet.update({
        where: { id: projet.id },
        data: { odooSyncedAt: new Date() },
      });
    } catch (e) {
      this.log.warn(
        `pushUpdate échoué pour Projet ${projet.id} → Odoo #${projet.odooProjectId} : ${(e as Error).message}`,
      );
    }
  }

  /**
   * À la suppression d'un Projet AQ, on archive plutôt que supprime
   * côté Odoo (FK : tasks, timesheets, etc. peuvent référencer le projet).
   */
  async pushArchive(tenantId: string, odooProjectId: number): Promise<void> {
    const client = await this.odoo.forTenant(tenantId).catch(() => null);
    if (!client) return;
    try {
      await client.write("project.project", [odooProjectId], { active: false });
    } catch (e) {
      this.log.warn(
        `pushArchive échoué pour Odoo project #${odooProjectId} : ${(e as Error).message}`,
      );
    }
  }

  /**
   * Trouve un nom unique pour un nouveau Projet — si `nom` existe déjà
   * dans le tenant, ajoute un suffixe `(2)`, `(3)`, … (rare cas où Odoo
   * autorise les doublons mais AQ a `@@unique([tenantId, nom])`).
   */
  private async uniqueNom(tenantId: string, nom: string): Promise<string> {
    const exists = await this.prisma.projet.findFirst({
      where: { tenantId, nom },
      select: { id: true },
    });
    if (!exists) return nom;
    for (let i = 2; i < 100; i++) {
      const candidate = `${nom} (${i})`.slice(0, 120);
      const conflict = await this.prisma.projet.findFirst({
        where: { tenantId, nom: candidate },
        select: { id: true },
      });
      if (!conflict) return candidate;
    }
    // Improbable. Fallback timestamp.
    return `${nom.slice(0, 100)} (${Date.now()})`;
  }
}

export type OdooProjetsSyncResult = Awaited<ReturnType<OdooProjetsSyncService["pullFromOdoo"]>>;
