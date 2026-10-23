import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import { currentUser, requireUser, canManage, ownerOf, isAdminUser, MASTER_ID } from './_lib/auth.js';
import { hget, hset, hdel, hgetall, del } from './_lib/store.js';
import { maxPeople } from './guests.js';
import { validId, rateLimit, clientIp } from './_lib/guard.js';

const MAX_INVITES_PER_USER = 300;
const UNDO_DAYS = 7;

const KEY = 'invites';

function clean(input, existing) {
  const now = new Date().toISOString();
  const s = JSON.stringify(input || {});
  if (s.length > 900_000) throw httpError(413, 'Convite grande demais para salvar.');
  const inv = JSON.parse(s);
  const out = Object.assign({}, existing || {}, inv);
  out.title = String(out.title || 'Novo convite').slice(0, 200);
  out.status = ['rascunho', 'publicado'].includes(out.status) ? out.status : 'rascunho';
  out.createdAt = (existing && existing.createdAt) || out.createdAt || now;
  out.updatedAt = now;
  return out;
}

function summarize(inv, rsvps, owners) {
  const list = Object.values(rsvps || {});
  const yes = list.filter((r) => r.go);
  return {
    id: inv.id,
    title: inv.title,
    status: inv.status,
    eventDate: inv.eventDate || null,
    kicker: inv.kicker || '',
    coverTitle: inv.coverTitle || inv.title,
    theme: inv.theme ? { bg: inv.theme.bg, fg: inv.theme.fg, accent: inv.theme.accent, font: inv.theme.fontKey } : null,
    themeName: inv.themeBase ? inv.themeBase.baseName : (inv.theme && inv.theme.baseName) || '',
    personal: !!(inv.personal && inv.personal.enabled),
    ownerId: ownerOf(inv),
    ownerName: owners ? owners[ownerOf(inv)] || '' : '',
    updatedAt: inv.updatedAt,
    createdAt: inv.createdAt,
    rsvp: { total: list.length, yes: yes.length, no: list.length - yes.length, people: yes.reduce((s, r) => s + 1 + (Number(r.guests) || 0), 0) }
  };
}

export default handler(async (req, res) => {
  const id = validId(query(req).get('id'), 'Convite');

  if (req.method === 'GET' && id) {
    const inv = await hget(KEY, id);
    // rascunhos só abrem para o dono do convite ou um administrador
    const manager = inv ? canManage(await currentUser(req), inv) : false;
    if (!inv || (!manager && inv.status !== 'publicado')) throw httpError(404, 'Convite não encontrado ou ainda não publicado.');
    // link de um convite individual: devolve só os dados daquele convidado e a resposta dele
    const g = validId(query(req).get('g'), 'Convite individual');
    // quem não gerencia o convite não precisa saber quem é o dono
    const pub = manager ? inv : Object.assign({}, inv, { ownerId: undefined });
    if (g) {
      const guest = await hget('guests:' + id, g);
      // tentativas de adivinhar códigos de convites individuais: limite por IP
      if (!guest) await rateLimit('gcode:' + clientIp(req), 40, 10 * 60, 'Muitos links inválidos.');
      if (!guest) throw httpError(404, 'Este convite individual não existe mais. Peça um novo link a quem enviou o convite.');
      const rsvp = await hget('rsvps:' + id, 'g-' + g);
      return send(res, 200, Object.assign({}, pub, {
        guest: { id: guest.id, name: guest.name, people: guest.people || [], companions: guest.companions || 0, max: maxPeople(guest), rsvp: rsvp || null }
      }));
    }
    return send(res, 200, pub);
  }

  const user = await requireUser(req);
  const admin = isAdminUser(user);

  if (req.method === 'GET') {
    const all = await hgetall(KEY);
    // Usuário vê só os próprios convites; administrador vê todos (com o nome do dono)
    const mine = Object.values(all).filter((inv) => admin || ownerOf(inv) === user.id);
    let owners = null;
    if (admin) {
      owners = { [MASTER_ID]: 'Administrador principal' };
      for (const u of Object.values(await hgetall('users'))) owners[u.id] = u.name;
    }
    const items = await Promise.all(mine.map(async (inv) => summarize(inv, await hgetall('rsvps:' + inv.id), owners)));
    items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return send(res, 200, items);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    if (!admin) {
      const count = Object.values(await hgetall(KEY)).filter((x) => ownerOf(x) === user.id).length;
      if (count >= MAX_INVITES_PER_USER) throw httpError(403, 'Limite de ' + MAX_INVITES_PER_USER + ' convites por usuário atingido. Exclua convites antigos para criar novos.');
    }
    const inv = clean(body, null);
    inv.id = newId();
    inv.ownerId = user.id;
    await hset(KEY, inv.id, inv);
    return send(res, 201, inv);
  }

  if (req.method === 'PUT') {
    if (!id) throw httpError(400, 'Informe o convite.');
    const body = await readBody(req);
    const restoring = '__rsvps' in body || '__guests' in body;
    const restore = body.__rsvps;
    const restoreGuests = body.__guests;
    delete body.__rsvps; delete body.__guests; delete body.guest;
    const existing = await hget(KEY, id);
    // só o "Desfazer" (que manda as respostas apagadas junto) pode recriar um convite excluído
    if (!existing && !restoring) throw httpError(404, 'Este convite foi excluído.');
    if (existing && !canManage(user, existing)) throw httpError(404, 'Convite não encontrado.');
    // "Desfazer": só recria um convite que foi excluído há pouco, e só para o dono dele (ou um administrador)
    let tomb = null;
    if (!existing) {
      tomb = await hget('deleted', id);
      const fresh = tomb && Date.now() - new Date(tomb.at).getTime() < UNDO_DAYS * 86400000;
      if (!fresh || (!admin && tomb.ownerId !== user.id)) throw httpError(404, 'Este convite foi excluído.');
    }
    const inv = clean(body, existing);
    inv.id = id;
    // o dono não muda ao salvar (no "Desfazer", volta o dono original)
    inv.ownerId = existing ? ownerOf(existing) : tomb.ownerId;
    await hset(KEY, id, inv);
    if (tomb) await hdel('deleted', id);
    if (restoreGuests && typeof restoreGuests === 'object') {
      for (const gid of Object.keys(restoreGuests).slice(0, 5000)) await hset('guests:' + id, gid, restoreGuests[gid]);
    }
    if (restore && typeof restore === 'object') {
      for (const rid of Object.keys(restore).slice(0, 5000)) await hset('rsvps:' + id, rid, restore[rid]);
    }
    return send(res, 200, inv);
  }

  if (req.method === 'DELETE') {
    if (!id) throw httpError(400, 'Informe o convite.');
    const existing = await hget(KEY, id);
    if (!existing || !canManage(user, existing)) throw httpError(404, 'Convite não encontrado.');
    const rsvps = await hgetall('rsvps:' + id);
    const guests = await hgetall('guests:' + id);
    await hdel(KEY, id);
    await del('rsvps:' + id);
    await del('guests:' + id);
    await hset('deleted', id, { ownerId: ownerOf(existing), at: new Date().toISOString() });
    // devolve o que foi apagado para permitir "Desfazer"
    return send(res, 200, { deleted: id, invite: existing, rsvps, guests });
  }

  throw httpError(405, 'Método não permitido.');
});
