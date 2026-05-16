/**
 * Module Travaux pour tiers — modèle aligné sur Odoo Field Service
 * (modules officiels `industry_fsm`, `project`, `sale_management`, `hr_timesheet`).
 *
 * IMPORTANT — sémantique Odoo FSM :
 *   La task FSM elle-même N'A PAS de product (pas de "type de service" sur la
 *   task). Les products (de type 'service') sont uniquement portés par les
 *   `sale.order.line` liées à la task via `task_id`. Le pattern Odoo est :
 *     1. L'opérateur crée une `project.task` avec is_fsm=True
 *     2. Sur le terrain, il ajoute des prestations → cela crée des
 *        `sale.order.line` sur le sale.order de la task, chacune référençant
 *        un `product.product` (type 'service' ou 'consu')
 *     3. Les timesheets (`account.analytic.line`) sont créés indépendamment,
 *        liés à la task (task_id) et optionnellement à une ligne (so_line)
 *
 * Notre modèle suit exactement ce pattern :
 *   WorkOrder        ↔ project.task (is_fsm=True) — SANS product
 *     .clientId      ↔ partner_id (res.partner)
 *     .userIds       ↔ tag_ids (project.tags) [voir note ci-dessous]
 *     .parcelIds     ↔ x_agri_parcel_ids (champ custom many2many agri.parcel)
 *     .status        ↔ stage_id (mapping via WO_STATUS_TO_STAGE)
 *     .priority      ↔ priority ('0' Faible / '1' Normale / '2' Haute / '3' Urgente)
 *     .tagIds        ↔ tag_ids (tags additionnels libres, hors employés)
 *     .fsmDone       ↔ fsm_done (clôture FSM)
 *     .invoiceRef    ↔ sale_order_id puis account.move (facture liée)
 *
 * NOTE — Assignation des opérateurs via étiquettes (pas user_ids) :
 *   La plupart des employés agricoles n'ont pas de compte Odoo (les licences
 *   res.users coûtent cher). Convention du projet : pour chaque employé, on
 *   crée une étiquette `project.tags` dédiée portant son nom, et on l'ajoute
 *   à `task.tag_ids` pour signaler qu'il doit/a fait la tâche.
 *
 *   Côté AgriQodo, on continue à manipuler `WorkOrder.userIds: AppUser.id[]`
 *   en local. Au sync, on résout chaque AppUser via `AppUser.odooTagId` pour
 *   obtenir la liste des `project.tags.id` à pousser dans `task.tag_ids`.
 *
 *   Si un employé a aussi un compte Odoo (`AppUser.odooUserId`), on peut
 *   parallèlement renseigner `task.user_ids` pour qu'il voie la tâche dans
 *   son tableau de bord Field Service personnel.
 *
 *   WorkOrderLine    ↔ sale.order.line (lié à la task via task_id)
 *     .workType      ↔ product_id (product.product type='service' ou 'consu')
 *     .billingUnit   ↔ product_uom_id (heures / ha / unité)
 *     .unitRateChf   ↔ price_unit
 *     .surfaceHa     ↔ product_uom_qty (si billing='hectare')
 *     .durationHours ↔ product_uom_qty (si billing='heure')
 *     .totalChf      ↔ price_subtotal (HT)
 *
 *   WorkTimeEntry    ↔ account.analytic.line (timesheet hr_timesheet)
 *     .operatorId    ↔ employee_id (via AppUser.odooEmployeeId → hr.employee.id)
 *     .lineId        ↔ so_line (analytic_line.so_line, refacturation)
 *     .date          ↔ date
 *     .durationHours ↔ unit_amount
 *     .notes         ↔ name (description timesheet)
 *
 * Les champs startTime / endTime ne sont pas natifs Odoo (timesheet stocke
 * juste la durée). Ils restent côté UI pour faciliter la saisie ; le sync
 * convertit en `unit_amount = (end - start) / 60` au push Odoo.
 */

export type WorkOrderStatus = 'planned' | 'in-progress' | 'done' | 'invoiced' | 'cancelled';

/**
 * Priorité Odoo FSM : '0' Faible / '1' Normale / '2' Haute / '3' Urgente.
 * Stocké en string pour matcher exactement le type Odoo (selection field).
 */
export type WorkOrderPriority = '0' | '1' | '2' | '3';

/**
 * Mapping local statut → identifiant de stage Odoo (Phase 3).
 * Les `stage_id` réels sont des entiers Odoo lus depuis l'instance ; on stocke
 * ici les noms de stages standard FSM. Le hook de sync mappera vers les IDs.
 */
export const WO_STATUS_TO_STAGE: Record<WorkOrderStatus, string> = {
  planned: 'New',
  'in-progress': 'In Progress',
  done: 'Done',
  invoiced: 'Invoiced',
  cancelled: 'Cancelled',
};

export const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  '0': 'Faible',
  '1': 'Normale',
  '2': 'Haute',
  '3': 'Urgente',
};

/**
 * Type de prestation = product.product Odoo (type 'service' pour FSM).
 * Le `key` local sera mappé vers `product.default_code` ou `product.id`.
 */
export interface WorkType {
  /** Identifiant stable (sera mappé sur product.default_code Odoo). */
  key: string;
  /** Libellé court (= product.name côté Odoo). */
  label: string;
  /** Description (équipement requis, conditions, etc.). */
  description?: string;
  /** Catégorie pour le regroupement (product.categ_id côté Odoo). */
  category: 'sol' | 'semis' | 'recolte' | 'traitement' | 'transport' | 'entretien' | 'autre';
  /** Tarif horaire par défaut (CHF). */
  defaultHourlyRateChf?: number;
  /** Tarif à l'hectare par défaut (CHF/ha). */
  defaultPerHectareRateChf?: number;
  /** Unité de facturation principale (mappée sur product.uom_id Odoo). */
  defaultBillingUnit: 'heure' | 'hectare' | 'forfait';
  /** Actif (product.active côté Odoo). */
  active: boolean;
  /** ID Odoo du product (rempli après 1re sync). */
  odooProductId?: number;
}

/**
 * Tiers facturable — mappé sur `res.partner` Odoo.
 */
export interface ThirdPartyClient {
  id: string;
  name: string;
  city?: string;
  email?: string;
  phone?: string;
  notes?: string;
  vatNumber?: string;
  active: boolean;
  /** Référence Odoo `res.partner.id` — Phase 3. */
  odooPartnerId?: number;
}

/**
 * Ligne de prestation = sale.order.line liée à la task Odoo (via `task_id`).
 */
export interface WorkOrderLine {
  id: string;
  /** Type de prestation (référence WorkType.key → product.product Odoo). */
  workType: string;
  /** Description spécifique (override product.description_sale). */
  description?: string;
  /** Surface (ha) — si billingUnit='hectare', sert de product_uom_qty. */
  surfaceHa?: number;
  /** Durée (h) — si billingUnit='heure', sert de product_uom_qty. */
  durationHours?: number;
  /** Unité de facturation (mappée sur product.uom_id). */
  billingUnit: 'heure' | 'hectare' | 'forfait';
  /** Tarif unitaire (CHF) — price_unit. */
  unitRateChf?: number;
  /** Total HT (CHF) — price_subtotal. */
  totalChf?: number;
  /** ID Odoo de la ligne de devis (rempli après sync). */
  odooSaleLineId?: number;
}

/**
 * Saisie de temps = account.analytic.line (timesheet Odoo).
 *
 * Plusieurs saisies par bon = plusieurs opérateurs ou journées d'intervention.
 * Le lien vers Odoo se fait via `AppUser.odooEmployeeId` → `hr.employee.id`.
 */
export interface WorkTimeEntry {
  id: string;
  /** Opérateur (référence AppUser.id ; AppUser.odooEmployeeId pour le sync). */
  operatorId: string;
  /** Date (ISO YYYY-MM-DD). Si omis : date du bon. */
  date?: string;
  /** Heure de début (HH:mm) — UI only, non synchro Odoo natif. */
  startTime?: string;
  /** Heure de fin (HH:mm) — UI only. */
  endTime?: string;
  /** Durée totale en heures décimales — analytic_line.unit_amount. */
  durationHours: number;
  /** Référence ligne du bon (mappée sur analytic_line.so_line). */
  lineId?: string;
  /** Notes (analytic_line.name côté Odoo). */
  notes?: string;
  /** ID Odoo du timesheet (rempli après sync). */
  odooAnalyticLineId?: number;
}

/**
 * Bon de travail = project.task FSM (industry_fsm) avec lignes de devis et
 * timesheets associés.
 */
export interface WorkOrder {
  id: string;
  /** Date principale du bon. Mappée sur task.planned_date_begin. */
  date: string;
  /** Date d'échéance (ISO). Mappée sur task.date_deadline. */
  deadline?: string;
  /** Client tiers (res.partner). */
  clientId: string;
  /** Parcelles concernées (champ custom many2many). */
  parcelIds?: ReadonlyArray<string>;
  /** Machine globale (texte libre — pas natif Odoo, stocké en x_machine). */
  machine?: string;
  /** Description / contexte (task.description). */
  description?: string;
  /** Statut (mappé via WO_STATUS_TO_STAGE → stage_id Odoo). */
  status: WorkOrderStatus;
  /** Priorité (task.priority Odoo : '0' à '3'). */
  priority: WorkOrderPriority;
  /** Opérateurs assignés (task.user_ids, res.users many2many). */
  userIds: ReadonlyArray<string>;
  /** Tags (task.tag_ids, project.tags many2many — texte libre local). */
  tagIds?: ReadonlyArray<string>;
  /** Lignes de prestation (sale.order.line[]). */
  lines: WorkOrderLine[];
  /** Saisies de temps (account.analytic.line[]). */
  timeEntries: WorkTimeEntry[];
  /** Bon clôturé sur le terrain (FSM). */
  fsmDone?: boolean;
  /** Référence facture Odoo (account.move.name). */
  invoiceRef?: string;
  /** Date de facturation. */
  invoicedAt?: string;
  /** Notes internes (task.x_internal_notes ou message_post). */
  notes?: string;
  /** ID Odoo de la task (rempli après 1re sync). */
  odooTaskId?: number;
  /** ID Odoo du sale.order lié. */
  odooSaleOrderId?: number;
}

export interface WorkOrderFilters {
  year?: number;
  clientId?: string;
  workType?: string;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  search?: string;
}

// ─── Helpers de calcul ────────────────────────────────────────────────────

export function computeLineTotal(line: WorkOrderLine): number {
  if (typeof line.totalChf === 'number') return line.totalChf;
  if (!line.unitRateChf) return 0;
  if (line.billingUnit === 'hectare') return Math.round((line.surfaceHa ?? 0) * line.unitRateChf);
  if (line.billingUnit === 'heure') return Math.round((line.durationHours ?? 0) * line.unitRateChf);
  return line.unitRateChf; // forfait
}

export function computeWorkOrderTotal(wo: WorkOrder): number {
  return wo.lines.reduce((sum, l) => sum + computeLineTotal(l), 0);
}

export function computeWorkOrderDuration(wo: WorkOrder): number {
  // Si saisies de temps présentes : elles font foi (= total_hours_spent Odoo)
  if (wo.timeEntries.length > 0) {
    return Math.round(wo.timeEntries.reduce((sum, t) => sum + t.durationHours, 0) * 10) / 10;
  }
  // Sinon : somme des durées prévues sur les lignes
  const total = wo.lines.reduce((sum, l) => sum + (l.durationHours ?? 0), 0);
  return Math.round(total * 10) / 10;
}

export function computeWorkOrderSurface(wo: WorkOrder): number {
  const max = wo.lines.reduce((m, l) => Math.max(m, l.surfaceHa ?? 0), 0);
  return Math.round(max * 100) / 100;
}

/**
 * Calcule la durée d'une saisie depuis start/end (HH:mm).
 * Retourne 0 si invalide (end <= start). Utilisé pour la validation UI.
 */
export function durationFromTimes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const minutes = (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
  if (minutes <= 0) return 0;
  return Math.round((minutes / 60) * 100) / 100;
}
