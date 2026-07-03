// Pruebas del mecanismo de despacho de comandos (Etapa 5 de la
// reestructuración: processCommand pasó de un if/else de ~600 líneas a un
// registro Map<comando, handler>). No cubre la lógica de negocio de cada
// comando (eso no cambió en esta etapa) — verifica que el Map despacha al
// handler correcto y que el orden de resolución (registro → comandosSimples
// → comandos → "no reconocido") se conserva igual que antes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processCommand, config } from '../bot.js';

function fakeSock() {
  const sent = [];
  return { sent, sendMessage: async (jid, content, opts) => sent.push({ jid, content, opts }) };
}

test('/menu: despacha al handler registrado y responde', async () => {
  const sock = fakeSock();
  await processCommand('/menu', '/menu', sock, 'user@s.whatsapp.net', { key: {} });
  assert.equal(sock.sent.length, 1);
  assert.match(sock.sent[0].content.text, /MENÚ DEL BOT/);
});

test('/MENU (mayúsculas): el despacho no distingue mayúsculas/minúsculas', async () => {
  const sock = fakeSock();
  await processCommand('/MENU', '/MENU', sock, 'user@s.whatsapp.net', { key: {} });
  assert.equal(sock.sent.length, 1);
  assert.match(sock.sent[0].content.text, /MENÚ DEL BOT/);
});

test('/ayuda: lista los comandos configurados dinámicamente', async () => {
  config.comandos = { '/promo': 'Info de promociones' };
  config.comandosSimples = { '/horario': '9am-6pm' };
  const sock = fakeSock();
  await processCommand('/ayuda', '/ayuda', sock, 'user@s.whatsapp.net', { key: {} });
  assert.match(sock.sent[0].content.text, /\/promo - Info de promociones/);
  assert.match(sock.sent[0].content.text, /\/horario/);
  delete config.comandos;
  delete config.comandosSimples;
});

test('comando dinámico simple (comandosSimples): responde el texto configurado sin pasar por IA', async () => {
  config.comandosSimples = { '/horario': '🕐 Abrimos 9am-6pm' };
  const sock = fakeSock();
  await processCommand('/horario', '/horario', sock, 'user@s.whatsapp.net', { key: {} });
  assert.equal(sock.sent[0].content.text, '🕐 Abrimos 9am-6pm');
  delete config.comandosSimples;
});

test('comando dinámico con IA (comandos): responde con la descripción configurada', async () => {
  config.comandos = { '/promo': 'Pregúntame por las promos del mes' };
  const sock = fakeSock();
  await processCommand('/promo', '/promo', sock, 'user@s.whatsapp.net', { key: {} });
  assert.equal(sock.sent[0].content.text, 'ℹ️ Pregúntame por las promos del mes');
  delete config.comandos;
});

test('comando no reconocido: cae al mensaje genérico de "no reconocido"', async () => {
  const sock = fakeSock();
  await processCommand('/noexiste123', '/noexiste123', sock, 'user@s.whatsapp.net', { key: {} });
  assert.match(sock.sent[0].content.text, /Comando no reconocido/);
});

test('el registro (comandHandlers) tiene prioridad sobre comandosSimples con el mismo nombre', async () => {
  config.comandosSimples = { '/menu': 'esto no debería verse' };
  const sock = fakeSock();
  await processCommand('/menu', '/menu', sock, 'user@s.whatsapp.net', { key: {} });
  assert.match(sock.sent[0].content.text, /MENÚ DEL BOT/);
  delete config.comandosSimples;
});
