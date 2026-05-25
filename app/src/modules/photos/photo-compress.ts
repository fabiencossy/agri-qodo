/**
 * Compression d'image côté client via Canvas API.
 * Convertit n'importe quelle image (JPEG/PNG/HEIC du téléphone…) en WebP
 * avec contrainte de dimension max + qualité paramétrable.
 *
 * Génère à la fois la version "full" (1600px, q=0.7) et "thumb" (200px, q=0.7).
 *
 * Lit aussi les tags EXIF basiques (date de prise, GPS) via lecture binaire
 * minimale du JPEG (pas de lib pour limiter le poids — couvre 80% des cas).
 */

const FULL_MAX_DIMENSION = 1600;
const FULL_QUALITY = 0.7;
const THUMB_MAX_DIMENSION = 200;
const THUMB_QUALITY = 0.7;
const OUTPUT_MIME = 'image/webp';

export interface CompressResult {
  fullBlob: Blob;
  thumbDataUrl: string;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
  exifTakenAt?: string;
  exifLat?: number;
  exifLng?: number;
}

/**
 * Compresse une image. Lance une exception si le fichier n'est pas une image.
 */
export async function compressImage(file: File): Promise<CompressResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`Fichier non image : ${file.type}`);
  }

  const originalBytes = file.size;
  const exif = await readJpegExif(file).catch(() => undefined);

  const bitmap = await loadBitmap(file);
  try {
    const { canvas: fullCanvas, width, height } = drawScaled(bitmap, FULL_MAX_DIMENSION);
    const fullBlob = await canvasToBlob(fullCanvas, OUTPUT_MIME, FULL_QUALITY);

    const { canvas: thumbCanvas } = drawScaled(bitmap, THUMB_MAX_DIMENSION);
    const thumbBlob = await canvasToBlob(thumbCanvas, OUTPUT_MIME, THUMB_QUALITY);
    const thumbDataUrl = await blobToDataUrl(thumbBlob);

    return {
      fullBlob,
      thumbDataUrl,
      width,
      height,
      originalBytes,
      compressedBytes: fullBlob.size,
      exifTakenAt: exif?.takenAt,
      exifLat: exif?.lat,
      exifLng: exif?.lng,
    };
  } finally {
    bitmap.close?.();
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap supporte JPEG/PNG/WebP/GIF/BMP partout, HEIC sur Safari iOS récent.
  return await createImageBitmap(file);
}

function drawScaled(
  bitmap: ImageBitmap,
  maxDim: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const ratio = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non disponible');
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { canvas, width, height };
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error('toBlob renvoie null'));
        else resolve(b);
      },
      mime,
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

interface ExifResult {
  takenAt?: string;
  lat?: number;
  lng?: number;
}

/**
 * Lecture EXIF minimaliste sur JPEG (APP1 marker). Pas de dépendance.
 * Retourne date + GPS si présents. Pour PNG/WebP/HEIC : retourne {} (pas critique).
 */
async function readJpegExif(file: File): Promise<ExifResult> {
  if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') return {};
  // On lit max 256 Ko (header EXIF est toujours au tout début)
  const buf = await file.slice(0, 256 * 1024).arrayBuffer();
  const view = new DataView(buf);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return {};

  let offset = 2;
  while (offset < view.byteLength - 4) {
    const marker = view.getUint16(offset);
    if (marker === 0xffe1) {
      // APP1 = EXIF
      const size = view.getUint16(offset + 2);
      const exifStart = offset + 4;
      // "Exif\0\0" header puis TIFF
      if (view.getUint32(exifStart) === 0x45786966 && view.getUint16(exifStart + 4) === 0x0000) {
        const tiffStart = exifStart + 6;
        return parseExifTiff(view, tiffStart);
      }
      offset += 2 + size;
    } else if ((marker & 0xff00) === 0xff00 && marker !== 0xffff) {
      const size = view.getUint16(offset + 2);
      offset += 2 + size;
    } else {
      break;
    }
  }
  return {};
}

function parseExifTiff(view: DataView, tiffStart: number): ExifResult {
  const byteOrder = view.getUint16(tiffStart);
  const littleEndian = byteOrder === 0x4949;
  const get16 = (o: number) => view.getUint16(o, littleEndian);
  const get32 = (o: number) => view.getUint32(o, littleEndian);

  const ifd0Offset = get32(tiffStart + 4);
  const ifd0Start = tiffStart + ifd0Offset;
  if (ifd0Start + 2 > view.byteLength) return {};

  let exifIfdOffset = 0;
  let gpsIfdOffset = 0;
  const entryCount = get16(ifd0Start);
  for (let i = 0; i < entryCount; i++) {
    const entry = ifd0Start + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = get16(entry);
    if (tag === 0x8769) exifIfdOffset = get32(entry + 8); // ExifIFDPointer
    if (tag === 0x8825) gpsIfdOffset = get32(entry + 8); // GPSInfoIFDPointer
  }

  const result: ExifResult = {};

  if (exifIfdOffset) {
    const exifStart = tiffStart + exifIfdOffset;
    if (exifStart + 2 <= view.byteLength) {
      const ec = get16(exifStart);
      for (let i = 0; i < ec; i++) {
        const e = exifStart + 2 + i * 12;
        if (e + 12 > view.byteLength) break;
        const tag = get16(e);
        // DateTimeOriginal (0x9003) ou DateTimeDigitized (0x9004)
        if (tag === 0x9003 || tag === 0x9004) {
          const valueOffset = get32(e + 8);
          const strStart = tiffStart + valueOffset;
          let s = '';
          for (let k = 0; k < 19 && strStart + k < view.byteLength; k++) {
            const c = view.getUint8(strStart + k);
            if (c === 0) break;
            s += String.fromCharCode(c);
          }
          // format "YYYY:MM:DD HH:MM:SS" → ISO
          const iso = s.replace(/^(\d{4}):(\d{2}):(\d{2})\s/, '$1-$2-$3T').replace(/$/, '');
          if (iso.length >= 19) result.takenAt = `${iso}Z`;
        }
      }
    }
  }

  if (gpsIfdOffset) {
    const gpsStart = tiffStart + gpsIfdOffset;
    if (gpsStart + 2 <= view.byteLength) {
      const gc = get16(gpsStart);
      let latRef = 'N';
      let lngRef = 'E';
      let latVals: number[] | null = null;
      let lngVals: number[] | null = null;
      const readRationals = (offset: number, count: number): number[] => {
        const arr: number[] = [];
        for (let k = 0; k < count; k++) {
          const ro = tiffStart + offset + k * 8;
          if (ro + 8 > view.byteLength) break;
          const num = get32(ro);
          const den = get32(ro + 4) || 1;
          arr.push(num / den);
        }
        return arr;
      };
      for (let i = 0; i < gc; i++) {
        const e = gpsStart + 2 + i * 12;
        if (e + 12 > view.byteLength) break;
        const tag = get16(e);
        if (tag === 0x0001) latRef = String.fromCharCode(view.getUint8(e + 8));
        if (tag === 0x0003) lngRef = String.fromCharCode(view.getUint8(e + 8));
        if (tag === 0x0002) latVals = readRationals(get32(e + 8), 3);
        if (tag === 0x0004) lngVals = readRationals(get32(e + 8), 3);
      }
      if (latVals && lngVals && latVals.length >= 3 && lngVals.length >= 3) {
        const [latD, latM, latS] = latVals as [number, number, number];
        const [lngD, lngM, lngS] = lngVals as [number, number, number];
        const lat = latD + latM / 60 + latS / 3600;
        const lng = lngD + lngM / 60 + lngS / 3600;
        result.lat = latRef === 'S' ? -lat : lat;
        result.lng = lngRef === 'W' ? -lng : lng;
      }
    }
  }

  return result;
}
