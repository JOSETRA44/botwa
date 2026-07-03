// Pruebas de media/latex.js y media/stickers.js — extraídos de bot.js en
// la Etapa 4 de la reestructuración (consolidaba la conversión
// imagen↔sticker, antes duplicada entre processAIResponseWithFormulas y
// commands/media.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLatexFormulas, renderLatexToImage } from '../media/latex.js';
import { imageToSticker, stickerToImage } from '../media/stickers.js';
import sharp from 'sharp';

// PNG rojo de 10x10 válido, generado en memoria — no depende de archivos externos.
async function samplePng() {
  return sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } })
    .png()
    .toBuffer();
}

test('detectLatexFormulas: detecta fórmulas en bloque ($$...$$)', () => {
  const formulas = detectLatexFormulas('Texto antes $$x^2 + y^2 = z^2$$ texto después');
  assert.equal(formulas.length, 1);
  assert.equal(formulas[0].type, 'block');
  assert.equal(formulas[0].latex, 'x^2 + y^2 = z^2');
});

test('detectLatexFormulas: detecta fórmulas inline ($...$)', () => {
  const formulas = detectLatexFormulas('La fórmula $E=mc^2$ es famosa');
  assert.equal(formulas.length, 1);
  assert.equal(formulas[0].type, 'inline');
  assert.equal(formulas[0].latex, 'E=mc^2');
});

test('detectLatexFormulas: no confunde un bloque con dos inline', () => {
  const formulas = detectLatexFormulas('$$a + b$$');
  assert.equal(formulas.length, 1, 'debe detectar un solo bloque, no fragmentos inline dentro de él');
});

test('detectLatexFormulas: sin fórmulas devuelve arreglo vacío', () => {
  assert.deepEqual(detectLatexFormulas('texto normal sin nada especial'), []);
});

test('renderLatexToImage: descarga y devuelve el buffer si la API responde ok', async () => {
  const fetchImpl = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
  const buffer = await renderLatexToImage('x^2', { fetchImpl });
  assert.ok(Buffer.isBuffer(buffer));
  assert.deepEqual([...buffer], [1, 2, 3]);
});

test('renderLatexToImage: si la API falla, devuelve null en vez de lanzar', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500 });
  const buffer = await renderLatexToImage('x^2', { fetchImpl });
  assert.equal(buffer, null);
});

test('imageToSticker: devuelve un buffer webp de 512x512', async () => {
  const input = await samplePng();
  const stickerBuffer = await imageToSticker(input);
  const metadata = await sharp(stickerBuffer).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
});

test('stickerToImage: devuelve un buffer png', async () => {
  const input = await samplePng();
  const imageBuffer = await stickerToImage(input);
  const metadata = await sharp(imageBuffer).metadata();
  assert.equal(metadata.format, 'png');
});
