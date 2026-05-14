import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import { OdooClientManager } from "@/modules/odoo/odoo-client-manager.service";

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo par photo
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

interface UploadInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  interventionId?: string;
  travailId?: string;
}

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly odooClientManager: OdooClientManager,
  ) {}

  /**
   * Upload d'une photo + push immédiat en `ir.attachment` Odoo
   * attaché à la `project.task` de la parcelle (carnet) ou au
   * `sale.order` / `project.task` du Travail (tiers). Best-effort
   * sur le push Odoo : si erreur, la photo reste en local sans
   * odooAttachmentId, l'utilisateur peut retry.
   */
  async upload(input: UploadInput): Promise<{
    id: string;
    odooAttachmentId: number | null;
    mimeType: string;
    sizeBytes: number;
  }> {
    const { tenantId, userId } = this.tenantContext.get();

    if (!input.interventionId && !input.travailId) {
      throw new BadRequestException("Préciser exactement un parent : interventionId ou travailId.");
    }
    if (input.interventionId && input.travailId) {
      throw new BadRequestException(
        "Une photo ne peut être attachée qu'à un seul parent à la fois.",
      );
    }
    if (input.buffer.length === 0) {
      throw new BadRequestException("Fichier vide.");
    }
    if (input.buffer.length > MAX_BYTES) {
      throw new BadRequestException(
        `Fichier trop gros (${input.buffer.length} octets, max ${MAX_BYTES}).`,
      );
    }
    if (!ALLOWED_MIMES.has(input.mimeType)) {
      throw new BadRequestException(
        `Type MIME non supporté : ${input.mimeType}. Autorisés : ${[...ALLOWED_MIMES].join(", ")}.`,
      );
    }

    // Détermine la cible Odoo (res_model + res_id) avant tout, pour
    // savoir si on peut pousser. Si pas encore de task/sale.order, on
    // accepte quand même l'upload local (push différé au prochain save).
    const target = input.interventionId
      ? await this.resolveInterventionTarget(input.interventionId, tenantId)
      : await this.resolveTravailTarget(input.travailId as string, tenantId);

    let odooAttachmentId: number | null = null;
    if (target) {
      odooAttachmentId = await this.pushOdooAttachment(tenantId, input, target);
    }

    const photo = await this.prisma.photo.create({
      data: {
        tenantId,
        ...(input.interventionId ? { interventionId: input.interventionId } : {}),
        ...(input.travailId ? { travailId: input.travailId } : {}),
        ...(userId ? { uploadedByUserId: userId } : {}),
        originalName: input.originalName.slice(0, 250),
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        ...(odooAttachmentId !== null ? { odooAttachmentId } : {}),
      },
      select: {
        id: true,
        odooAttachmentId: true,
        mimeType: true,
        sizeBytes: true,
      },
    });
    return photo;
  }

  /**
   * Liste les photos liées à une intervention ou un travail.
   */
  async list(filter: { interventionId?: string; travailId?: string }): Promise<
    Array<{
      id: string;
      mimeType: string;
      sizeBytes: number;
      originalName: string;
      createdAt: Date;
      odooAttachmentId: number | null;
    }>
  > {
    const { tenantId } = this.tenantContext.get();
    if (!filter.interventionId && !filter.travailId) {
      throw new BadRequestException("Préciser interventionId ou travailId.");
    }
    return this.prisma.photo.findMany({
      where: {
        tenantId,
        ...(filter.interventionId ? { interventionId: filter.interventionId } : {}),
        ...(filter.travailId ? { travailId: filter.travailId } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        mimeType: true,
        sizeBytes: true,
        originalName: true,
        createdAt: true,
        odooAttachmentId: true,
      },
    });
  }

  /**
   * Récupère le binaire d'une photo via Odoo (proxy). On lit
   * `ir.attachment.datas` (base64) puis on retourne le Buffer décodé.
   */
  async getBinary(
    photoId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; originalName: string } | null> {
    const { tenantId } = this.tenantContext.get();
    const photo = await this.prisma.photo.findFirst({
      where: { id: photoId, tenantId },
      select: { odooAttachmentId: true, mimeType: true, originalName: true },
    });
    if (!photo) throw new NotFoundException("Photo introuvable.");
    if (!photo.odooAttachmentId) {
      // Pas encore push Odoo → pas de binaire disponible (best-effort).
      return null;
    }
    const client = await this.odooClientManager.forTenant(tenantId);
    const rows = await client.searchRead<{
      datas: string | false;
      mimetype?: string | false;
    }>("ir.attachment", [["id", "=", photo.odooAttachmentId]], {
      fields: ["datas", "mimetype"],
      limit: 1,
    });
    const first = rows[0];
    if (!first || !first.datas || typeof first.datas !== "string") return null;
    return {
      buffer: Buffer.from(first.datas, "base64"),
      mimeType:
        typeof first.mimetype === "string" && first.mimetype ? first.mimetype : photo.mimeType,
      originalName: photo.originalName,
    };
  }

  /**
   * Suppression : unlink côté Odoo (si attachment poussé) puis purge
   * local. Best-effort sur l'unlink Odoo : si erreur, on log et on
   * supprime quand même local (pour éviter les orphelins UI).
   */
  async remove(photoId: string): Promise<void> {
    const { tenantId } = this.tenantContext.get();
    const photo = await this.prisma.photo.findFirst({
      where: { id: photoId, tenantId },
      select: { id: true, odooAttachmentId: true },
    });
    if (!photo) throw new NotFoundException("Photo introuvable.");
    if (photo.odooAttachmentId) {
      try {
        const client = await this.odooClientManager.forTenant(tenantId);
        await client.unlink("ir.attachment", [photo.odooAttachmentId]);
      } catch (err) {
        this.logger.warn(
          `Unlink ir.attachment #${photo.odooAttachmentId} échoué pour photo ${photoId} : ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }
    await this.prisma.photo.delete({ where: { id: photo.id } });
  }

  // ----- helpers -----

  private async resolveInterventionTarget(
    interventionId: string,
    tenantId: string,
  ): Promise<{ res_model: string; res_id: number } | null> {
    const intervention = await this.prisma.intervention.findFirst({
      where: { id: interventionId, ownerTenantId: tenantId },
      include: { parcelle: { select: { odooTaskId: true } } },
    });
    if (!intervention) {
      throw new NotFoundException("Intervention introuvable.");
    }
    // Push possible seulement si la parcelle a déjà sa project.task
    // (créée au premier push d'intervention par OdooPushService).
    if (!intervention.parcelle.odooTaskId) return null;
    return { res_model: "project.task", res_id: intervention.parcelle.odooTaskId };
  }

  private async resolveTravailTarget(
    travailId: string,
    tenantId: string,
  ): Promise<{ res_model: string; res_id: number } | null> {
    const travail = await this.prisma.travail.findFirst({
      where: { id: travailId, tenantId },
      select: { odooSaleOrderId: true, odooTaskId: true },
    });
    if (!travail) {
      throw new NotFoundException("Travail introuvable.");
    }
    if (travail.odooSaleOrderId) {
      return { res_model: "sale.order", res_id: travail.odooSaleOrderId };
    }
    if (travail.odooTaskId) {
      return { res_model: "project.task", res_id: travail.odooTaskId };
    }
    return null;
  }

  private async pushOdooAttachment(
    tenantId: string,
    input: UploadInput,
    target: { res_model: string; res_id: number },
  ): Promise<number | null> {
    try {
      const client = await this.odooClientManager.forTenant(tenantId);
      const attachmentId = await client.create("ir.attachment", {
        name: input.originalName.slice(0, 250),
        type: "binary",
        datas: input.buffer.toString("base64"),
        mimetype: input.mimeType,
        res_model: target.res_model,
        res_id: target.res_id,
      });
      return attachmentId;
    } catch (err) {
      this.logger.warn(
        `Push ir.attachment échoué (${target.res_model} #${target.res_id}) : ${
          err instanceof Error ? err.message : err
        }`,
      );
      return null;
    }
  }
}
