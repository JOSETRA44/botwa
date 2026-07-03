// Helpers de envío a WhatsApp. Extraído de bot.js en la Etapa 3 de la
// reestructuración — comportamiento idéntico, `readFile` inyectable para
// poder probarlo sin tocar el sistema de archivos real.
import fs from 'fs/promises';

// Envía las imágenes de catálogo que coincidieron con la consulta (máx. 2)
export async function sendRagImages(sock, remoteJid, images, quotedMsg, { readFile = fs.readFile } = {}) {
  for (const img of images.slice(0, 2)) {
    try {
      const buffer = await readFile(img.imagePath);
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: `📦 ${img.title}`
      }, quotedMsg ? { quoted: quotedMsg } : {});
    } catch (error) {
      console.error('⚠️ No se pudo enviar imagen de catálogo:', error.message);
    }
  }
}
