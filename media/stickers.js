// Conversión imagen↔sticker. Extraído en la Etapa 4 de la reestructuración
// — antes vivía duplicado en processAIResponseWithFormulas (fórmulas LaTeX
// como sticker) y en commands/media.js (/s), cada uno con su propia
// llamada a sharp con los mismos parámetros de resize/formato.
import sharp from 'sharp';

// 512x512 webp es el formato que espera WhatsApp para stickers. El fondo
// es el único parámetro que varía entre usos: transparente para fotos
// normales (/s), blanco para fórmulas renderizadas (que ya vienen sobre
// fondo blanco desde CodeCogs y se verían mal recortadas en transparente).
export async function imageToSticker(buffer, { background = { r: 0, g: 0, b: 0, alpha: 0 } } = {}) {
  return sharp(buffer)
    .resize(512, 512, { fit: 'contain', background })
    .webp()
    .toBuffer();
}

export async function stickerToImage(buffer) {
  return sharp(buffer).png({ quality: 100 }).toBuffer();
}
