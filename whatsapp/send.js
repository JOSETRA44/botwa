// Envío de archivos adjuntos del catálogo (imágenes y PDFs) a WhatsApp.
// Generalizado en la Etapa 10 de la reestructuración — antes solo mandaba
// hasta 2 imágenes con el título como caption fijo (`sendRagImages`);
// ahora manda cualquier mezcla de imágenes/PDFs con su descripción real,
// con un presupuesto GLOBAL por respuesta (no por entrada del catálogo) y
// un pequeño delay entre envíos.
//
// El presupuesto es global a propósito: antes de esto, "enviar todos los
// archivos de las 3 mejores coincidencias" podía llegar a ~15 mensajes de
// media en ráfaga a un mismo contacto — justo el tipo de comportamiento no
// estándar que ya causó problemas de estabilidad de sesión esta sesión
// (ver BOTWA-docs/Fixes/Diagnostico de Entrega de Mensajes.md).
import fs from 'fs/promises';

export const MAX_ATTACHMENTS_PER_RESPONSE = 6;
const SEND_DELAY_MS = 600;
// WhatsApp trunca captions muy largos (~1024 caracteres) de forma poco
// predecible — se corta antes, con un margen de seguridad.
const MAX_CAPTION_LENGTH = 1000;

function truncateCaption(text) {
  if (!text) return text;
  return text.length > MAX_CAPTION_LENGTH ? `${text.slice(0, MAX_CAPTION_LENGTH - 1)}…` : text;
}

// `attachments`: [{ filePath, mime, kind: 'image'|'pdf', title, description }]
// — mismo shape que devuelve rag/search.js:buildContext().attachments.
export async function sendEntryFiles(sock, remoteJid, attachments, quotedMsg, {
  readFile = fs.readFile,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) {
  const toSend = attachments.slice(0, MAX_ATTACHMENTS_PER_RESPONSE);

  for (let i = 0; i < toSend.length; i++) {
    const att = toSend[i];
    const caption = truncateCaption(att.description || att.title);

    try {
      const buffer = await readFile(att.filePath);
      if (att.kind === 'pdf') {
        await sock.sendMessage(remoteJid, {
          document: buffer,
          mimetype: att.mime || 'application/pdf',
          fileName: `${att.title || 'documento'}.pdf`,
          caption
        }, quotedMsg ? { quoted: quotedMsg } : {});
      } else {
        await sock.sendMessage(remoteJid, {
          image: buffer,
          caption
        }, quotedMsg ? { quoted: quotedMsg } : {});
      }
    } catch (error) {
      console.error('⚠️ No se pudo enviar archivo de catálogo:', error.message);
    }

    if (i < toSend.length - 1) await sleep(SEND_DELAY_MS);
  }
}
