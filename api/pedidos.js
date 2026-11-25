// Pedidos de convite feitos pelos clientes (formulário público em /pedido).
// - POST ?action=start  (público): libera o envio de fotos daquele pedido (código válido por 12 horas)
// - POST ?action=send   (público): grava o pedido e monta sozinho uma versão do convite para cada tema escolhido
// - GET                 (administradores): lista os pedidos com as versões montadas
// - GET ?action=count   (administradores): quantos pedidos novos há
// - PUT ?id=            (administradores): muda a situação ou a anotação do pedido
// - POST ?action=choose&id= (administradores): marca a versão escolhida e, se pedido, exclui as outras
import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import { requireAdmin, MASTER_ID } from './_lib/auth.js';
import { hget, hset, hdel, hgetall, hlen } from './_lib/store.js';
import { validId, rateLimit, clientIp } from './_lib/guard.js';
import { createUploadKey } from './_lib/pedidos.js';
import { themeById, themePayload } from '../src/catalogo.js';
import { KINDS, fromOrder, eventDateOf, placeLink } from '../src/montagem.js';

const KEY = 'pedidos';
const MAX_ORDERS = 3000;
const STATUS = ['novo', 'producao', 'entregue', 'arquivado'];
const HEX = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MUSIC = ['', 'valsa', 'caixinha', 'festa'];
const str = (v, max) => String(v == null ? '' : v).replace(/\r\n/g, '\n').trim().slice(0, max);

// só arquivos enviados para a própria plataforma
const OWN_MEDIA = /^(\/api\/upload\?(file=[A-Za-z0-9_-]{8,40}|media=https%3A%2F%2F[a-z0-9]+\.(private|public)\.blob\.vercel-storage\.com%2Fconvites%2F[A-Za-z0-9._%-]+)|https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/convites\/[A-Za-z0-9._-]+)$/i;
function media(p) {
  if (!p || typeof p !== 'object') return null;
  const url = String(p.url || '');
  if (!OWN_MEDIA.test(url) || url.length > 400) throw httpError(400, 'Foto inválida. Envie as fotos pelo formulário.');
  return { url, name: str(p.name, 120) };
}

function link(v) {
  let u = str(v, 300);
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u) && /^[\w-]+(\.[\w-]+)+/.test(u)) u = 'https://' + u;
  if (!/^https?:\/\/[^\s]+$/i.test(u)) throw httpError(400, 'O link da lista de presentes precisa começar com https://');
  return u;
}

function placeUrlOf(v) {
  const raw = str(v, 300);
  if (!raw) return '';
  const u = placeLink(raw);
  if (!u) throw httpError(400, 'Confira o Instagram ou site do local (ex.: @perfil ou https://site.com.br).');
  return u;
}

function validate(body) {
  const kind = KINDS[body.kind] ? body.kind : '';
  if (!kind) throw httpError(400, 'Escolha o tipo de evento.');
  const names = str(body.names, 80);
  if (!names) throw httpError(400, 'Informe ' + KINDS[kind].names.toLowerCase() + '.');
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(body.day || '')) ? body.day : '';
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(body.time || '')) ? body.time : '';
  if (day && !eventDateOf(day, time)) throw httpError(400, 'Data inválida.');
  const ids = Array.isArray(body.themes) ? body.themes.map(String).filter((id, i, a) => a.indexOf(id) === i) : [];
  const themes = ids.filter((id) => themeById(id)).slice(0, 3);
  if (!themes.length) throw httpError(400, 'Escolha pelo menos um visual.');
  let palette = null;
  if (body.palette && typeof body.palette === 'object') {
    palette = {};
    for (const k of ['bg', 'fg', 'accent', 'btnFg', 'paper', 'ph']) {
      if (!HEX.test(String(body.palette[k] || ''))) throw httpError(400, 'Cores inválidas.');
      palette[k] = body.palette[k];
    }
  }
  const ph = body.photos || {};
  const gallery = (Array.isArray(ph.gallery) ? ph.gallery : []).slice(0, 12).map(media).filter(Boolean);
  const c = body.contact || {};
  const contact = { name: str(c.name, 120), phone: str(c.phone, 30), email: str(c.email, 160).toLowerCase(), message: str(c.message, 1000) };
  if (!contact.name) throw httpError(400, 'Informe o seu nome.');
  const digits = contact.phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) throw httpError(400, 'Informe o seu WhatsApp com DDD.');
  if (contact.email && !EMAIL.test(contact.email)) throw httpError(400, 'E-mail inválido.');
  return {
    kind, names, day, time,
    place: str(body.place, 120), address: str(body.address, 200), placeUrl: placeUrlOf(body.placeUrl), rsvp: body.rsvp !== false,
    themes, palette,
    photos: { main: media(ph.main), venue: media(ph.venue), gallery },
    phrase: str(body.phrase, 200), dress: str(body.dress, 80), notes: str(body.notes, 600), program: str(body.program, 800),
    gifts: link(body.gifts), music: MUSIC.includes(body.music) ? body.music : '',
    contact
  };
}

// resumo das versões (convites) de um pedido
async function variants(order) {
  const out = [];
  for (const id of order.invites || []) {
    const inv = await hget('invites', id);
    if (!inv) continue;
    const t = inv.theme || {};
    out.push({
      id, title: inv.title, status: inv.status, ownerId: inv.ownerId || MASTER_ID, chosen: order.chosen === id,
      themeName: (inv.themeBase && inv.themeBase.baseName) || t.baseName || '', updatedAt: inv.updatedAt,
      theme: { bg: t.bg, fg: t.fg, accent: t.accent, ph: t.ph, btnFg: t.btnFg, fontKey: t.fontKey, layout: t.layout, italic: !!t.italic, radiusKey: t.radiusKey, titleScale: t.titleScale || 1, bodyKey: t.bodyKey || 'jakarta' },
      coverTitle: inv.coverTitle || '', kicker: inv.kicker || ''
    });
  }
  return out;
}

export default handler(async (req, res) => {
  const q = query(req);
  const action = q.get('action') || '';
  const id = validId(q.get('id'), 'Pedido');

  if (req.method === 'POST' && action === 'start') {
    await rateLimit('pedido:start:' + clientIp(req), 30, 3600, 'Muitos pedidos começados.');
    return send(res, 200, await createUploadKey());
  }

  if (req.method === 'POST' && action === 'send') {
    const body = await readBody(req);
    // campo escondido: só robôs preenchem
    if (body.site) throw httpError(400, 'Não foi possível enviar.');
    const order = validate(body);
    await rateLimit('pedido:send:' + clientIp(req), 8, 3600, 'Muitos pedidos enviados.');
    if ((await hlen(KEY)) >= MAX_ORDERS) throw httpError(503, 'Não foi possível receber pedidos agora. Tente mais tarde ou fale pelo WhatsApp.');
    const now = new Date().toISOString();
    const pid = newId(10);
    const invites = [];
    for (const tid of order.themes) {
      const inv = fromOrder(order, themePayload(themeById(tid)));
      inv.id = newId();
      inv.ownerId = MASTER_ID;
      inv.pedidoId = pid;
      inv.createdAt = now; inv.updatedAt = now;
      await hset('invites', inv.id, inv);
      invites.push(inv.id);
    }
    const rec = Object.assign({ id: pid, status: 'novo', createdAt: now, updatedAt: now, invites, chosen: null, note: '' }, order);
    await hset(KEY, pid, rec);
    return send(res, 201, { id: pid, versions: invites.length });
  }

  await requireAdmin(req);

  if (req.method === 'GET' && action === 'count') {
    const all = Object.values(await hgetall(KEY));
    return send(res, 200, { novos: all.filter((o) => o.status === 'novo').length, total: all.length });
  }

  if (req.method === 'GET') {
    const all = Object.values(await hgetall(KEY)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const out = [];
    for (const o of all) out.push(Object.assign({}, o, { versions: await variants(o) }));
    return send(res, 200, out);
  }

  if (!id) throw httpError(400, 'Informe o pedido.');
  const order = await hget(KEY, id);
  if (!order) throw httpError(404, 'Pedido não encontrado.');

  if (req.method === 'PUT') {
    const body = await readBody(req);
    const next = Object.assign({}, order, { updatedAt: new Date().toISOString() });
    if (body.status !== undefined) {
      if (!STATUS.includes(body.status)) throw httpError(400, 'Situação inválida.');
      next.status = body.status;
    }
    if (body.note !== undefined) next.note = str(body.note, 2000);
    await hset(KEY, id, next);
    return send(res, 200, Object.assign({}, next, { versions: await variants(next) }));
  }

  if (req.method === 'POST' && action === 'choose') {
    const body = await readBody(req);
    const chosen = String(body.inviteId || '');
    if (!(order.invites || []).includes(chosen)) throw httpError(400, 'Esta versão não é deste pedido.');
    let invites = order.invites;
    if (body.dropOthers) {
      // as outras versões são rascunhos montados automaticamente: saem do pedido e da lista de convites
      for (const other of order.invites.filter((x) => x !== chosen)) {
        const inv = await hget('invites', other);
        if (inv && inv.pedidoId === id && inv.status !== 'publicado') await hdel('invites', other);
      }
      invites = [chosen];
    }
    const next = Object.assign({}, order, { chosen, invites, status: order.status === 'novo' ? 'producao' : order.status, updatedAt: new Date().toISOString() });
    await hset(KEY, id, next);
    return send(res, 200, Object.assign({}, next, { versions: await variants(next) }));
  }

  throw httpError(405, 'Método não permitido.');
});
