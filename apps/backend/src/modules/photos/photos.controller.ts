import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { PhotosService } from "./photos.service";

interface MulterFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@ApiTags("photos")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("photos")
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Post("upload")
  @ApiOperation({
    summary:
      "Upload d'une photo attachée à une intervention (carnet) ou un travail (tiers). Push immédiat en ir.attachment Odoo (best-effort).",
  })
  @ApiQuery({ name: "interventionId", required: false })
  @ApiQuery({ name: "travailId", required: false })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @UploadedFile() file: MulterFile | undefined,
    @Query("interventionId") interventionId?: string,
    @Query("travailId") travailId?: string,
  ) {
    if (!file) throw new BadRequestException("Champ multipart `file` manquant.");
    return this.photos.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      ...(interventionId ? { interventionId } : {}),
      ...(travailId ? { travailId } : {}),
    });
  }

  @Get()
  @ApiOperation({ summary: "Liste les photos d'une intervention ou d'un travail." })
  @ApiQuery({ name: "interventionId", required: false })
  @ApiQuery({ name: "travailId", required: false })
  list(@Query("interventionId") interventionId?: string, @Query("travailId") travailId?: string) {
    return this.photos.list({
      ...(interventionId ? { interventionId } : {}),
      ...(travailId ? { travailId } : {}),
    });
  }

  @Get(":id/binary")
  @ApiOperation({
    summary: "Proxy vers le binaire d'une photo (lit ir.attachment.datas côté Odoo).",
  })
  async binary(@Param("id", new ParseUUIDPipe()) id: string, @Res() res: Response): Promise<void> {
    const result = await this.photos.getBinary(id);
    if (!result) {
      throw new NotFoundException("Binaire indisponible (photo non encore poussée sur Odoo).");
    }
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.originalName.replace(/"/g, "")}"`,
    );
    res.send(result.buffer);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Supprime une photo (unlink ir.attachment Odoo + purge local)." })
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.photos.remove(id);
  }
}
