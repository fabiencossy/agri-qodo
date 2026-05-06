import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { type OdooClient, pickAdapter } from "@agri-qodo/odoo-client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import { OdooClientManager } from "@/modules/odoo/odoo-client-manager.service";

/**
 * Résultat du push : url Odoo + id sale.order ou project.task, pour
 * que le frontend puisse afficher un lien direct.
 *
 * Travail externe (avec partenaire/client OU non interne) → sale.order
 * brouillon. `odooSaleOrderId` set, `odooTaskId` null.
 *
 * Travail interne (`interne=true`) → project.task simple. Pas de
 * facturation. `odooTaskId` set, `odooSaleOrderId` null.
 */
export interface PushTravailResult {
  odooSaleOrderId: number | null;
  odooTaskId: number | null;
  /** "sale_order" pour les travaux facturables, "project_task" pour interne. */
  odooKind: "sale_order" | "project_task";
  odooUrl: string;
  partnerCreated: boolean;
  productsCreated: number;
  linesCount: number;
  /**
   * Id de la `industry.fsm.task` créée si au moins une ligne du travail
   * est un produit "physique" (consu/product) ET que le module Field
   * Service Management est installé sur le tenant Odoo. Null sinon
   * (services-only ou module FSM absent — fallback gracieux). Réservé
   * aux travaux externes (sale_order kind).
   */
  odooFsmTaskId: number | null;
}

interface OdooSaleOrderLineCreate {
  product_id?: number;
  name?: string;
  product_uom_qty?: number;
  price_unit?: number;
  /** Unité de mesure Odoo (uom.uom). Si absent, Odoo prend l'unité par défaut du produit. */
  product_uom?: number;
  /**
   * "line_section" pour un titre de section, "line_note" pour une note
   * libre. Si renseigné, Odoo n'attend ni product_id ni quantité —
   * c'est juste un séparateur visuel dans le devis.
   */
  display_type?: "line_section" | "line_note";
}

interface ResPartnerRow {
  id: number;
}

interface ProductProductRow {
  id: number;
  type?: "service" | "consu" | "product";
}

@Injectable()
export class OdooPushService {
  private readonly logger = new Logger(OdooPushService.name);

  // Cache mémoire (par process) du product.product "Heure de travail"
  // résolu/créé par tenant. Évite d'aller le rechercher à chaque push.
  private readonly hourProductCache = new Map<string, number>();

  // Cache mémoire du mapping uom (string → uom_id) par tenant. Évite
  // de relire uom.uom à chaque ligne. Clé : `${tenantId}:${uomLabelNormalized}`.
  private readonly uomIdCache = new Map<string, number>();

  // Cache mémoire du project.project "Agri Qodo — Carnet des champs"
  // résolu/créé par tenant. Sert de container aux project.task créées
  // pour les interventions cas A (perso, sans facturation).
  private readonly carnetProjectCache = new Map<string, number>();

  // Cache mémoire de la disponibilité du module Field Service Management
  // par tenant. true = `industry.fsm.task` répond aux requêtes Odoo,
  // false = module non installé (fallback gracieux : on skip la fsm.task).
  // Cleared à chaque restart du backend — c'est OK, l'overhead d'une
  // détection par session est négligeable.
  private readonly fsmAvailabilityCache = new Map<string, boolean>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly odooClientManager: OdooClientManager,
  ) {}

  /**
   * Pousse un travail vers Odoo en tant que sale.order brouillon.
   *
   * Mapping :
   *   - Travail.partenaire (Exploitation) → res.partner (lookup par nom,
   *     création si absent, mémorisé sur PartnerLink.odooPartnerId)
   *   - LigneTravailProduit.produit → product.product via odooProductId.
   *     Si pas de mapping, on lookup par libellé puis on crée un product
   *     consommable basique.
   *   - LigneTravailHeure → product.product service "Main d'œuvre" (unique
   *     par tenant, créé à la 1re push).
   *
   * Idempotence : si Travail.odooSaleOrderId est déjà posé, on refuse
   * (sécurité contre le double devis). L'utilisateur doit annuler côté
   * Odoo s'il veut re-pousser.
   */
  async pushTravail(travailId: string): Promise<PushTravailResult> {
    const { tenantId } = this.tenantContext.get();
    const travail = await this.prisma.travail.findFirst({
      where: { id: travailId, tenantId },
      include: {
        partenaire: { select: { id: true, nom: true, emailContact: true, telephone: true } },
        parcelle: { select: { id: true, nom: true } },
        lignesProduit: {
          include: {
            produit: { select: { id: true, libelle: true, odooProductId: true, unite: true } },
          },
        },
        lignesHeure: {
          include: {
            user: { select: { id: true, prenom: true, nom: true } },
          },
        },
      },
    });
    if (!travail) throw new NotFoundException("Travail introuvable");
    if (travail.odooSaleOrderId || travail.odooTaskId) {
      throw new ConflictException(
        `Travail déjà poussé vers Odoo (${travail.odooSaleOrderId ? `sale.order #${travail.odooSaleOrderId}` : `project.task #${travail.odooTaskId}`}). ` +
          `Annule côté Odoo avant de re-pousser.`,
      );
    }

    // Cas TRAVAIL INTERNE : pas de facturation → on crée juste une
    // project.task avec le détail des heures dans la description (chatter
    // Odoo). Pas de sale.order, pas de produits/services Odoo créés, pas
    // de fsm.task. Permet de tracer côté Odoo sans facturer.
    if (travail.interne) {
      return this.pushTravailAsTask(travailId, travail);
    }
    if (travail.lignesProduit.length === 0 && travail.lignesHeure.length === 0) {
      throw new BadRequestException(
        "Travail vide : ajoute au moins une ligne produit ou une ligne heure avant de pousser vers Odoo.",
      );
    }

    let client: OdooClient;
    try {
      client = await this.odooClientManager.forTenant(tenantId);
    } catch (err) {
      this.logger.error(`Push Odoo : pas de client pour tenant ${tenantId} : ${err}`);
      throw new ServiceUnavailableException(
        "Configuration Odoo absente ou invalide. Renseigne-la dans Paramètres → Odoo.",
      );
    }

    let partnerCreated = false;
    let productsCreated = 0;

    // 1. Résolution / création du res.partner (client) ----------------
    let partnerId: number | undefined;
    // Décision Fabien 2026-05-06 : si Travail.odooPartnerId est posé,
    // c'est un client Odoo "seul" (pas un partenaire Agri Qodo) — on
    // l'utilise directement, pas de lookup PartnerLink.
    if (travail.odooPartnerId) {
      partnerId = travail.odooPartnerId;
    } else if (travail.partenaireId && travail.partenaire) {
      const link = await this.prisma.partnerLink.findFirst({
        where: {
          OR: [
            { ownerTenantId: tenantId, partnerTenantId: travail.partenaireId },
            { ownerTenantId: travail.partenaireId, partnerTenantId: tenantId },
          ],
        },
      });
      if (link?.odooPartnerId) {
        partnerId = link.odooPartnerId;
      } else {
        // Lookup par nom dans Odoo
        const found = await client.searchRead<ResPartnerRow>(
          "res.partner",
          [["name", "=", travail.partenaire.nom]],
          { fields: ["id"], limit: 1 },
        );
        if (found.length > 0 && found[0]) {
          partnerId = found[0].id;
        } else {
          // Création
          partnerId = await client.create("res.partner", {
            name: travail.partenaire.nom,
            is_company: true,
            ...(travail.partenaire.emailContact ? { email: travail.partenaire.emailContact } : {}),
            ...(travail.partenaire.telephone ? { phone: travail.partenaire.telephone } : {}),
          });
          partnerCreated = true;
        }
        // Mémorise le mapping si on a un lien
        if (link) {
          await this.prisma.partnerLink.update({
            where: { id: link.id },
            data: { odooPartnerId: partnerId },
          });
        }
      }
    }
    // Si pas de partenaire (travail interne) : on utilise le tenant lui-même
    // comme client (Odoo refuse une commande sans partner).
    if (!partnerId) {
      const tenant = await this.prisma.exploitation.findUnique({
        where: { id: tenantId },
        select: { nom: true, emailContact: true },
      });
      const found = await client.searchRead<ResPartnerRow>(
        "res.partner",
        [["name", "=", tenant?.nom ?? "Interne"]],
        { fields: ["id"], limit: 1 },
      );
      if (found.length > 0 && found[0]) {
        partnerId = found[0].id;
      } else {
        partnerId = await client.create("res.partner", {
          name: tenant?.nom ?? "Interne",
          is_company: true,
          ...(tenant?.emailContact ? { email: tenant.emailContact } : {}),
        });
        partnerCreated = true;
      }
    }

    // 2. Construction des lignes ----------------------------------------
    const orderLines: OdooSaleOrderLineCreate[] = [];
    // Tracking des produits "physiques" (consu/product) pour la fsm.task
    // ultérieure. Format : {productId, qty, name} pour reconstruire les
    // lignes côté FSM si on en crée une.
    const physicalLines: { productId: number; qty: number; name: string }[] = [];

    // 2pre-section. Section en tête du devis avec date des travaux et
    // nom de la parcelle (demande Fabien 2026-05-06). Permet à
    // l'agriculteur et au client de voir d'un coup d'œil "à quoi
    // correspond ce devis" sans aller fouiller dans la note ou la
    // référence client.
    const dateLabel = travail.date.toLocaleDateString("fr-CH");
    const parcelleNom = travail.parcelle?.nom ?? null;
    const sectionTitle = parcelleNom
      ? `Travaux du ${dateLabel} — ${parcelleNom}`
      : `Travaux du ${dateLabel}`;
    orderLines.push({
      display_type: "line_section",
      name: sectionTitle,
    });

    // Décision Fabien 2026-05-06 : ne PAS ajouter de ligne placeholder
    // "Main d'œuvre" sur le devis — il n'en veut pas car non facturable
    // donc inutile pour le client. Conséquences :
    //   - Le devis ne contient que la section + les vraies lignes
    //     facturables (matériel à l'ha).
    //   - sale_line_id reste best-effort : la task sera liée à la 1re
    //     ligne facturable si Odoo l'accepte, sinon "Non facturable"
    //     (cas produits is_expense). Le smart button "Devis" reste
    //     visible via sale_order_id.
    //   - Les heures pointées remontent quand même sur la task via
    //     account.analytic.line direct (project_id + task_id), pas
    //     via sale_line_id — donc "Temps passé" non nul.
    const hourProductId = await this.ensureHourProductId(client, tenantId);

    // 2a. Lignes produit
    for (const lp of travail.lignesProduit) {
      let productId: number | undefined = lp.produit?.odooProductId ?? undefined;
      let productType: ProductProductRow["type"] | undefined;
      if (!productId) {
        // Lookup par libellé — on demande aussi `type` pour décider FSM
        // ou pas (cf §G6 mapping).
        const found = await client.searchRead<ProductProductRow>(
          "product.product",
          [["name", "=", lp.libelle]],
          { fields: ["id", "type"], limit: 1 },
        );
        if (found.length > 0 && found[0]) {
          productId = found[0].id;
          productType = found[0].type;
        } else {
          productId = await client.create("product.product", {
            name: lp.libelle,
            type: "consu",
            list_price: lp.prixUnitaireCHF ? Number(lp.prixUnitaireCHF) : 0,
          });
          productType = "consu";
          productsCreated++;
        }
        // Met à jour le produit local pour les futurs push
        if (lp.produit?.id) {
          await this.prisma.produit.update({
            where: { id: lp.produit.id },
            data: { odooProductId: productId },
          });
        }
      } else {
        // Produit déjà mappé : on relit son type pour le routage FSM.
        const got = await client.searchRead<ProductProductRow>(
          "product.product",
          [["id", "=", productId]],
          { fields: ["id", "type"], limit: 1 },
        );
        productType = got[0]?.type;
      }
      const line: OdooSaleOrderLineCreate = {
        product_id: productId,
        name: lp.libelle,
        product_uom_qty: Number(lp.quantite),
      };
      if (lp.prixUnitaireCHF) line.price_unit = Number(lp.prixUnitaireCHF);
      // Unité de mesure : on essaie de mapper lp.unite ("ha", "kg", "L"…)
      // vers un uom.uom Odoo. Si non résolu, Odoo prend l'unité par
      // défaut du produit (souvent "Unité(s)" — pas idéal pour des ha).
      const uomId = await this.resolveUomId(client, tenantId, lp.unite);
      if (uomId) line.product_uom = uomId;
      orderLines.push(line);
      // Routage FSM : seuls les produits "biens" (consu/product) — pas
      // les services — alimentent la future industry.fsm.task. Si
      // productType est inconnu, on prend la conservation max et on
      // l'inclut quand même (mieux vaut une fsm.task avec une ligne en
      // trop qu'une fsm.task vide).
      if (productType !== "service") {
        physicalLines.push({
          productId,
          qty: Number(lp.quantite),
          name: lp.libelle,
        });
      }
    }

    // 2b. Lignes heures saisies dans Agri Qodo (LigneTravailHeure).
    // Décision Fabien 2026-05-06 : ne PAS afficher la main d'œuvre
    // dans le devis quand elle n'est pas facturable (tauxHoraireCHF
    // null/0). On garde la ligne uniquement si l'agriculteur a
    // explicitement saisi un taux horaire (= il VEUT la facturer).
    // Les heures non facturables remontent quand même côté task via
    // account.analytic.line direct (cf push timesheet plus bas).
    for (const lh of travail.lignesHeure) {
      if (!lh.tauxHoraireCHF || Number(lh.tauxHoraireCHF) <= 0) continue;
      const heures = Number(lh.dureeMinutes) / 60;
      orderLines.push({
        product_id: hourProductId,
        name: lh.notes ?? `Travail (${heures.toFixed(2)}h)`,
        product_uom_qty: heures,
        price_unit: Number(lh.tauxHoraireCHF),
      });
    }

    // 3. Création du sale.order brouillon -------------------------------
    let saleOrderId: number;
    try {
      saleOrderId = await client.create("sale.order", {
        partner_id: partnerId,
        state: "draft",
        client_order_ref: travail.titre,
        note: travail.notes ?? "",
        order_line: orderLines.map((l) => [0, 0, l]),
      });
    } catch (err) {
      this.logger.error(
        `Push Odoo : sale.order create échoué pour travail ${travailId} : ${err instanceof Error ? err.message : err}`,
      );
      throw new ServiceUnavailableException(
        "Création du devis Odoo échouée. Vérifie les permissions du compte API et la config TVA.",
      );
    }

    // 4. Mémorisation côté local ----------------------------------------
    await this.prisma.travail.update({
      where: { id: travailId },
      data: { odooSaleOrderId: saleOrderId },
    });

    // 4.5. Sprint D prestations v0.3 §5.4 — création d'une project.task
    // standard liée au sale.order quand le tenant a configuré son projet
    // Travaux pour tiers dans /parametres/exploitation. Best-effort :
    // un échec ici ne casse pas le push sale.order. Permet de retrouver
    // le travail dans la vue projet Odoo et de le visualiser comme une
    // intervention terrain (sans dépendre d'industry_fsm).
    let projectTaskId: number | null = null;
    try {
      const tenantProject = await this.prisma.exploitation.findUnique({
        where: { id: tenantId },
        select: { odooProjectIdTravauxTiers: true },
      });
      if (tenantProject?.odooProjectIdTravauxTiers) {
        // Création de la project.task SANS sale_line_id : on lie juste
        // sale_order_id (le devis global). Si on essaie de poser
        // sale_line_id direct dans le create, Odoo rejette toute la
        // création quand le produit est marqué "dépense refacturée"
        // (is_expense=true) ou que le service_tracking ne le permet
        // pas — ce qui ferait perdre la task entière.
        projectTaskId = await client.create("project.task", {
          name: travail.titre,
          project_id: tenantProject.odooProjectIdTravauxTiers,
          partner_id: partnerId,
          date_deadline: travail.date.toISOString().slice(0, 10),
          sale_order_id: saleOrderId,
        });

        // sale_line_id : on cible la PREMIÈRE ligne du sale.order, qui
        // est par construction la ligne placeholder service "Suivi des
        // heures (non facturable)" ajoutée en tête (cf §2pre). Cette
        // ligne accepte toujours sale_line_id (service, qty=0, prix=0,
        // pas de is_expense) → la task est facturablement liée au
        // devis SANS jamais facturer les heures pointées. Best-effort :
        // si Odoo refuse pour une raison inattendue, on continue.
        try {
          // Exclure les sections (display_type='line_section') et notes
          // (display_type='line_note') — sinon on récupère la 1re ligne
          // qui est la section "Travaux du JJ/MM" et Odoo refuse de la
          // lier à la task ("Vous ne pouvez pas lier la ligne X car
          // dépense refacturée" = faux positif Odoo, en réalité c'est
          // juste qu'une section sans product_id n'est pas liable).
          const lines = await client.searchRead<{ id: number }>(
            "sale.order.line",
            [
              ["order_id", "=", saleOrderId],
              ["display_type", "=", false],
            ],
            { fields: ["id"], order: "sequence,id", limit: 1 },
          );
          const firstLineId = lines[0]?.id;
          if (firstLineId) {
            await client.write("project.task", [projectTaskId], {
              sale_line_id: firstLineId,
            });
          }
        } catch (err) {
          this.logger.warn(
            `sale_line_id non lié sur task #${projectTaskId} (devis ${saleOrderId} créé OK) : ${err instanceof Error ? err.message : err}`,
          );
        }

        // Liaison bidirectionnelle (tasks_ids est Many2many côté sale.order).
        await client.write("sale.order", [saleOrderId], {
          tasks_ids: [[4, projectTaskId, 0]],
        });
        await this.prisma.travail.update({
          where: { id: travailId },
          data: { odooTaskId: projectTaskId },
        });
        this.logger.log(
          `project.task #${projectTaskId} créée pour travail ${travailId} ↔ sale.order #${saleOrderId} (projet #${tenantProject.odooProjectIdTravauxTiers})`,
        );

        // Push des feuilles de temps : pour chaque LigneTravailHeure,
        // on crée un account.analytic.line (= timesheet) sur la task,
        // ce qui remplit "Temps passé" côté Odoo. Best-effort : si la
        // table n'existe pas ou le mapping employé manque, on log et
        // on continue. Si User.odooEmployeeId mappé, on l'utilise ;
        // sinon Odoo prendra l'employé associé au compte API.
        for (const lh of travail.lignesHeure) {
          try {
            const heures = Number(lh.dureeMinutes) / 60;
            // Lookup employé Odoo si User a un odooEmployeeId mappé.
            const userRow = await this.prisma.user.findUnique({
              where: { id: lh.user.id },
              select: { odooEmployeeId: true },
            });
            const employeeId = userRow?.odooEmployeeId ?? undefined;
            await client.create("account.analytic.line", {
              name: lh.notes ?? travail.titre,
              date: travail.date.toISOString().slice(0, 10),
              unit_amount: heures,
              project_id: tenantProject.odooProjectIdTravauxTiers,
              task_id: projectTaskId,
              ...(employeeId ? { employee_id: employeeId } : {}),
            });
          } catch (err) {
            this.logger.warn(
              `Timesheet non créé sur task #${projectTaskId} : ${err instanceof Error ? err.message : err}`,
            );
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        `Création project.task best-effort échouée pour travail ${travailId} : ${err instanceof Error ? err.message : err}`,
      );
    }

    // 5. Création optionnelle de la industry.fsm.task ------------------
    // Si au moins une ligne physique ET le module FSM est installé,
    // on crée une tâche Field Service liée au sale.order. Permet à
    // l'agriculteur de planifier l'intervention terrain depuis Odoo
    // sans devoir re-saisir les produits à livrer/utiliser.
    let odooFsmTaskId: number | null = null;
    if (physicalLines.length > 0) {
      odooFsmTaskId = await this.tryCreateFsmTask(client, tenantId, {
        saleOrderId,
        partnerId,
        title: travail.titre,
        date: travail.date,
        physicalLines,
      });
    }

    const tenant = await this.prisma.exploitation.findUnique({
      where: { id: tenantId },
      select: { odooUrl: true },
    });
    const odooUrl = tenant?.odooUrl
      ? `${tenant.odooUrl.replace(/\/+$/, "")}/odoo/sales/${saleOrderId}`
      : "";

    this.logger.log(
      `Push Odoo OK : travail ${travailId} → sale.order #${saleOrderId} (${orderLines.length} lignes)${
        projectTaskId ? ` + project.task #${projectTaskId}` : ""
      }${odooFsmTaskId ? ` + fsm.task #${odooFsmTaskId}` : ""}`,
    );

    return {
      odooSaleOrderId: saleOrderId,
      odooTaskId: null,
      odooKind: "sale_order",
      odooUrl,
      partnerCreated,
      productsCreated,
      linesCount: orderLines.length,
      odooFsmTaskId,
    };
  }

  /**
   * Push d'un travail INTERNE vers une `project.task` Odoo. Pas de
   * facturation : on crée simplement une tâche avec les détails (heures,
   * employés, parcelle…) dans la description. Permet de tracer côté
   * Odoo sans devis ni client.
   *
   * Le projet conteneur "Agri Qodo — Travaux internes" est créé au
   * premier push d'un tenant et caché ensuite (cache mémoire commun
   * avec le carnet).
   */
  private async pushTravailAsTask(
    travailId: string,
    travail: {
      titre: string;
      date: Date;
      notes: string | null;
      parcelle: { id: string; nom: string } | null;
      lignesHeure: Array<{
        dureeMinutes: number;
        notes: string | null;
        user: { prenom: string; nom: string };
      }>;
    },
  ): Promise<PushTravailResult> {
    const { tenantId } = this.tenantContext.get();
    let client: OdooClient;
    try {
      client = await this.odooClientManager.forTenant(tenantId);
    } catch (err) {
      this.logger.error(`Push Odoo (interne) : pas de client pour tenant ${tenantId} : ${err}`);
      throw new ServiceUnavailableException(
        "Configuration Odoo absente ou invalide. Renseigne-la dans Paramètres → Odoo.",
      );
    }

    // Projet conteneur des travaux internes — créé une fois par tenant.
    // Distinct du carnet pour ne pas mélanger.
    const projectId = await this.ensureInternalWorkProject(client, tenantId);

    const totalMin = travail.lignesHeure.reduce((s, l) => s + l.dureeMinutes, 0);
    const totalH = (totalMin / 60).toFixed(2);
    const lines: string[] = [
      `Date : ${travail.date.toISOString().slice(0, 10)}`,
      travail.parcelle ? `Parcelle : ${travail.parcelle.nom}` : null,
      `Total : ${totalH} h (${totalMin} min)`,
      "",
      "Détail heures :",
      ...travail.lignesHeure.map((l) => {
        const h = (l.dureeMinutes / 60).toFixed(2);
        const who = `${l.user.prenom} ${l.user.nom}`;
        const note = l.notes ? ` — ${l.notes}` : "";
        return `- ${who} : ${h} h${note}`;
      }),
      ...(travail.notes ? ["", `Notes : ${travail.notes}`] : []),
    ].filter(Boolean) as string[];
    const description = lines.join("\n");

    let taskId: number;
    try {
      taskId = await client.create("project.task", {
        name: travail.titre,
        project_id: projectId,
        description,
        date_deadline: travail.date.toISOString().slice(0, 10),
      });
    } catch (err) {
      this.logger.error(
        `Push project.task interne échoué pour travail ${travailId} : ${err instanceof Error ? err.message : err}`,
      );
      throw new ServiceUnavailableException(
        "Création de la tâche Odoo échouée. Vérifie les permissions du compte API.",
      );
    }

    await this.prisma.travail.update({
      where: { id: travailId },
      data: { odooTaskId: taskId },
    });

    const tenant = await this.prisma.exploitation.findUnique({
      where: { id: tenantId },
      select: { odooUrl: true },
    });
    const odooUrl = tenant?.odooUrl
      ? `${tenant.odooUrl.replace(/\/+$/, "")}/odoo/project/${projectId}/tasks/${taskId}`
      : "";

    this.logger.log(
      `Push Odoo OK (interne) : travail ${travailId} → project.task #${taskId} dans projet #${projectId}`,
    );

    return {
      odooSaleOrderId: null,
      odooTaskId: taskId,
      odooKind: "project_task",
      odooUrl,
      partnerCreated: false,
      productsCreated: 0,
      linesCount: travail.lignesHeure.length,
      odooFsmTaskId: null,
    };
  }

  /**
   * Résout l'ID uom.uom Odoo correspondant à une string métier ("ha",
   * "kg", "L", "t", "m³"…). Cache par tenant. Lookup tolérant à la
   * casse via name=ilike. Renvoie undefined si pas trouvé (Odoo
   * utilisera l'unité par défaut du produit).
   *
   * Demande Fabien 2026-05-06 : "l'unité est fausse alors que sur
   * agri qodo elle est juste". Avant ce helper, le push n'envoyait
   * pas product_uom et Odoo prenait "Unité(s)" même pour des ha/kg.
   */
  private async resolveUomId(
    client: OdooClient,
    tenantId: string,
    uomLabel: string | null | undefined,
  ): Promise<number | undefined> {
    if (!uomLabel) return undefined;
    const normalized = uomLabel.trim().toLowerCase();
    if (!normalized) return undefined;
    const cacheKey = `${tenantId}:${normalized}`;
    const cached = this.uomIdCache.get(cacheKey);
    if (cached !== undefined) return cached;

    // Synonymes courants côté Odoo FR pour matcher correctement même
    // quand l'agriculteur a saisi en minuscules ou avec/sans accent.
    const candidates: string[] = [uomLabel.trim()];
    const synonyms: Record<string, string[]> = {
      ha: ["ha", "Hectare", "hectares"],
      kg: ["kg", "Kg", "Kilogramme", "kilogrammes"],
      g: ["g", "Gramme", "grammes"],
      t: ["t", "Tonne", "tonnes"],
      l: ["L", "l", "Litre", "litres"],
      m3: ["m³", "m3", "Mètre cube", "mètres cubes"],
      "m³": ["m³", "m3", "Mètre cube"],
      dose: ["dose", "Dose", "doses"],
      unite: ["Unité(s)", "Unité", "unit"],
      heure: ["Heures", "heure", "h"],
    };
    if (synonyms[normalized]) candidates.push(...synonyms[normalized]);

    for (const candidate of candidates) {
      const found = await client.searchRead<{ id: number }>(
        "uom.uom",
        [["name", "=ilike", candidate]],
        { fields: ["id"], limit: 1 },
      );
      if (found.length > 0 && found[0]) {
        this.uomIdCache.set(cacheKey, found[0].id);
        return found[0].id;
      }
    }
    return undefined;
  }

  /**
   * Trouve ou crée le product.product service "Main d'œuvre (Agri Qodo)"
   * pour le tenant. Sert à deux usages :
   *   - lignes d'heures saisies dans Agri Qodo (LigneTravailHeure)
   *   - ligne placeholder "Suivi des heures" en tête du sale.order
   *     (ancrage sale_line_id de la project.task)
   * Cache mémoire pour éviter le lookup répété.
   */
  private async ensureHourProductId(client: OdooClient, tenantId: string): Promise<number> {
    const cached = this.hourProductCache.get(tenantId);
    if (cached) return cached;
    const found = await client.searchRead<ProductProductRow>(
      "product.product",
      [
        ["name", "=", "Main d'œuvre (Agri Qodo)"],
        ["type", "=", "service"],
      ],
      { fields: ["id"], limit: 1 },
    );
    let productId: number;
    if (found.length > 0 && found[0]) {
      productId = found[0].id;
    } else {
      productId = await client.create("product.product", {
        name: "Main d'œuvre (Agri Qodo)",
        type: "service",
        list_price: 0,
      });
    }
    this.hourProductCache.set(tenantId, productId);
    return productId;
  }

  /**
   * Trouve ou crée le project.project conteneur des travaux internes
   * pour le tenant. Cache mémoire pour éviter le lookup répété.
   */
  private async ensureInternalWorkProject(client: OdooClient, tenantId: string): Promise<number> {
    const cacheKey = `internal:${tenantId}`;
    const cached = this.carnetProjectCache.get(cacheKey);
    if (cached) return cached;

    // Sprint B prestations v0.3 §2 : si l'OWNER a configuré le projet
    // Odoo Carnet interne, on le réutilise pour les Travaux internes
    // (même rôle métier : tâche sans devis). Sinon fallback historique.
    const tenant = await this.prisma.exploitation.findUnique({
      where: { id: tenantId },
      select: { odooProjectIdCarnetInterne: true },
    });
    if (tenant?.odooProjectIdCarnetInterne) {
      this.carnetProjectCache.set(cacheKey, tenant.odooProjectIdCarnetInterne);
      return tenant.odooProjectIdCarnetInterne;
    }

    const projectName = "Agri Qodo — Travaux internes";
    const found = await client.searchRead<{ id: number }>(
      "project.project",
      [["name", "=", projectName]],
      { fields: ["id"], limit: 1 },
    );
    if (found.length > 0 && found[0]) {
      this.carnetProjectCache.set(cacheKey, found[0].id);
      return found[0].id;
    }
    const created = await client.create("project.project", {
      name: projectName,
      allow_billable: false,
    });
    this.carnetProjectCache.set(cacheKey, created);
    return created;
  }

  /**
   * Détecte la disponibilité du module Field Service Management sur le
   * tenant Odoo en interrogeant `ir.model`. Cache le résultat par tenant
   * pour éviter une requête à chaque push. Best-effort — un échec de
   * détection est traité comme "non disponible".
   */
  private async detectFsmAvailable(client: OdooClient, tenantId: string): Promise<boolean> {
    const cached = this.fsmAvailabilityCache.get(tenantId);
    if (cached !== undefined) return cached;

    const session = client.getSession();
    const adapter = pickAdapter(session?.majorVersion ?? 19);
    try {
      const found = await client.searchRead<{ id: number }>(
        "ir.model",
        [["model", "=", adapter.fsmTaskModel]],
        { fields: ["id"], limit: 1 },
      );
      const available = found.length > 0;
      this.fsmAvailabilityCache.set(tenantId, available);
      if (!available) {
        this.logger.log(
          `Module FSM non installé sur tenant ${tenantId} (modèle ${adapter.fsmTaskModel} introuvable) — fallback gracieux.`,
        );
      }
      return available;
    } catch (err) {
      this.logger.warn(
        `Détection FSM échouée pour tenant ${tenantId}, fallback "non disponible" : ${
          err instanceof Error ? err.message : err
        }`,
      );
      this.fsmAvailabilityCache.set(tenantId, false);
      return false;
    }
  }

  /**
   * Crée une `industry.fsm.task` liée au sale.order pour les lignes de
   * type "bien" (consu/product). Best-effort : si le module FSM n'est
   * pas installé OU si la création échoue, on skip et on garde le
   * sale.order seul. Ne throw jamais.
   */
  private async tryCreateFsmTask(
    client: OdooClient,
    tenantId: string,
    input: {
      saleOrderId: number;
      partnerId: number;
      title: string;
      date: Date;
      physicalLines: { productId: number; qty: number; name: string }[];
    },
  ): Promise<number | null> {
    const available = await this.detectFsmAvailable(client, tenantId);
    if (!available) return null;

    const session = client.getSession();
    const adapter = pickAdapter(session?.majorVersion ?? 19);

    try {
      const description = input.physicalLines.map((l) => `- ${l.name} × ${l.qty}`).join("\n");
      const taskId = await client.create(adapter.fsmTaskModel, {
        name: input.title,
        partner_id: input.partnerId,
        [adapter.fsmTaskSaleOrderField]: input.saleOrderId,
        planned_date_begin: input.date.toISOString().slice(0, 10),
        description,
      });
      this.logger.log(
        `${adapter.fsmTaskModel} #${taskId} créée pour sale.order #${input.saleOrderId} (${input.physicalLines.length} lignes physiques)`,
      );
      return taskId;
    } catch (err) {
      // Premier essai échoué : peut-être un champ inattendu. On retente
      // avec un payload minimal sans `planned_date_begin` ni le lien
      // sale.order, juste pour ne pas perdre l'historique côté Odoo.
      this.logger.warn(
        `Création ${adapter.fsmTaskModel} échouée, retry minimal : ${
          err instanceof Error ? err.message : err
        }`,
      );
      try {
        const taskId = await client.create(adapter.fsmTaskModel, {
          name: input.title,
          partner_id: input.partnerId,
        });
        // Tente le lien sale.order en write séparé (best-effort).
        try {
          await client.write(adapter.fsmTaskModel, [taskId], {
            [adapter.fsmTaskSaleOrderField]: input.saleOrderId,
          });
        } catch {
          // ignore — la fsm.task existe au moins
        }
        return taskId;
      } catch (err2) {
        this.logger.warn(
          `Retry minimal ${adapter.fsmTaskModel} échoué — fallback définitif (sale.order seul) : ${
            err2 instanceof Error ? err2.message : err2
          }`,
        );
        // On marque le tenant comme "FSM indisponible" pour ne pas
        // retenter à chaque push de cette session.
        this.fsmAvailabilityCache.set(tenantId, false);
        return null;
      }
    }
  }

  /**
   * Variante best-effort de `pushTravail` pour les déclenchements
   * automatiques (cas B après save d'intervention). Ne throw jamais —
   * log l'échec et renvoie null. Le Travail reste DRAFT sans
   * odooSaleOrderId, l'utilisateur peut re-pousser manuellement.
   */
  async tryPushTravailQuotation(travailId: string): Promise<PushTravailResult | null> {
    try {
      return await this.pushTravail(travailId);
    } catch (err) {
      this.logger.warn(
        `Push Odoo auto échoué pour travail ${travailId} : ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /**
   * Confirme un devis Odoo (sale.order draft) pour qu'il devienne une
   * commande client (state='sale'). Appelé automatiquement quand le
   * Travail passe DRAFT → VALIDATED.
   *
   * Idempotent côté Odoo : action_confirm sur un sale.order déjà
   * confirmé est un no-op. Best-effort : on ne throw pas pour ne pas
   * bloquer la validation locale.
   */
  async tryConfirmSaleOrder(
    travailId: string,
  ): Promise<{ confirmed: boolean; odooSaleOrderId: number | null }> {
    const { tenantId } = this.tenantContext.get();
    const travail = await this.prisma.travail.findFirst({
      where: { id: travailId, tenantId },
      select: { odooSaleOrderId: true },
    });
    if (!travail?.odooSaleOrderId) {
      return { confirmed: false, odooSaleOrderId: null };
    }

    let client: OdooClient;
    try {
      client = await this.odooClientManager.forTenant(tenantId);
    } catch (err) {
      this.logger.warn(
        `Confirm sale.order : pas de client Odoo pour tenant ${tenantId} : ${err instanceof Error ? err.message : err}`,
      );
      return { confirmed: false, odooSaleOrderId: travail.odooSaleOrderId };
    }

    try {
      await client.callKw("sale.order", "action_confirm", [[travail.odooSaleOrderId]]);
      this.logger.log(`Sale.order #${travail.odooSaleOrderId} confirmé (travail ${travailId})`);
      return { confirmed: true, odooSaleOrderId: travail.odooSaleOrderId };
    } catch (err) {
      this.logger.warn(
        `Confirm sale.order #${travail.odooSaleOrderId} échoué : ${err instanceof Error ? err.message : err}`,
      );
      return { confirmed: false, odooSaleOrderId: travail.odooSaleOrderId };
    }
  }

  /**
   * Push best-effort d'une intervention cas A (parcelle perso) vers
   * Odoo en tant que `project.task`. Pas de facturation (≠ cas B qui
   * fait sale.order). Sert juste à tracer l'activité côté Odoo pour
   * les rapports d'exploitation.
   *
   * Le projet container est créé/réutilisé une fois par tenant
   * ("Agri Qodo — Carnet des champs"). Idempotent : si l'intervention
   * a déjà un `odooTaskId`, on skip.
   */
  async tryPushInterventionTask(interventionId: string): Promise<{ taskId: number } | null> {
    const { tenantId } = this.tenantContext.get();
    try {
      const intervention = await this.prisma.intervention.findFirst({
        where: { id: interventionId, ownerTenantId: tenantId },
        include: {
          parcelle: { select: { nom: true } },
          materielRef: { select: { libelle: true } },
          produitRef: { select: { libelle: true } },
        },
      });
      if (!intervention) return null;
      if (intervention.odooTaskId) return { taskId: intervention.odooTaskId };

      const client = await this.odooClientManager.forTenant(tenantId);
      const projectId = await this.ensureCarnetProject(client, tenantId);

      const titreType = intervention.type.replace(/_/g, " ").toLowerCase();
      const titre = `${titreType.charAt(0).toUpperCase()}${titreType.slice(1)} — ${intervention.parcelle.nom}`;
      const descriptionLines = [
        `Date : ${intervention.dateOperation.toISOString().slice(0, 10)}`,
        intervention.materielRef ? `Matériel : ${intervention.materielRef.libelle}` : null,
        intervention.produitRef
          ? `Produit : ${intervention.produitRef.libelle}${intervention.quantite ? ` — ${intervention.quantite} ${intervention.unite ?? ""}` : ""}`
          : null,
        intervention.surfaceHa ? `Surface : ${Number(intervention.surfaceHa).toFixed(2)} ha` : null,
        intervention.notes ? `Notes : ${intervention.notes}` : null,
      ].filter(Boolean);

      const taskId = await client.create("project.task", {
        name: titre,
        project_id: projectId,
        description: descriptionLines.join("\n"),
        date_deadline: intervention.dateOperation.toISOString().slice(0, 10),
      });

      await this.prisma.intervention.update({
        where: { id: interventionId },
        data: { odooTaskId: taskId, odooTaskPushedAt: new Date() },
      });

      this.logger.log(
        `project.task #${taskId} créé pour intervention ${interventionId} (cas A, projet ${projectId})`,
      );
      return { taskId };
    } catch (err) {
      this.logger.warn(
        `Push project.task échoué pour intervention ${interventionId} : ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /**
   * Trouve ou crée le project.project conteneur du carnet des champs
   * pour le tenant. Cache mémoire pour éviter le lookup répété.
   */
  private async ensureCarnetProject(client: OdooClient, tenantId: string): Promise<number> {
    const cached = this.carnetProjectCache.get(tenantId);
    if (cached) return cached;

    // Sprint B prestations v0.3 §2 : si l'OWNER a configuré le projet
    // Odoo cible pour le Carnet interne dans Paramètres → Exploitation,
    // on l'utilise. Sinon fallback sur l'auto-creation historique pour
    // ne pas casser les tenants pré-Sprint B.
    const tenant = await this.prisma.exploitation.findUnique({
      where: { id: tenantId },
      select: { odooProjectIdCarnetInterne: true },
    });
    if (tenant?.odooProjectIdCarnetInterne) {
      this.carnetProjectCache.set(tenantId, tenant.odooProjectIdCarnetInterne);
      return tenant.odooProjectIdCarnetInterne;
    }

    const projectName = "Agri Qodo — Carnet des champs";
    const found = await client.searchRead<{ id: number }>(
      "project.project",
      [["name", "=", projectName]],
      { fields: ["id"], limit: 1 },
    );
    if (found.length > 0 && found[0]) {
      this.carnetProjectCache.set(tenantId, found[0].id);
      return found[0].id;
    }
    const created = await client.create("project.project", {
      name: projectName,
      allow_billable: false,
    });
    this.carnetProjectCache.set(tenantId, created);
    return created;
  }
}
