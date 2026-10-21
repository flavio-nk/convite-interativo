import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import { isAdmin, requireAdmin } from './_lib/auth.js';
import { hget, hset, hdel, hgetall, del } from './_lib/store.js';
import { maxPeople } from './guests.js';

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

function summarize(inv, rsvps) {
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
    updatedAt: inv.updatedAt,
    createdAt: inv.createdAt,
    rsvp: { total: list.length, yes: yes.length, no: list.length - yes.length, people: yes.reduce((s, r) => s + 1 + (Number(r.guests) || 0), 0) }
  };
}

export default handler(async (req, res) => {
  const id = query(req).get('id');

  if (req.method === 'GET' && id) {
    const inv = await hget(KEY, id);
    const admin = isAdmin(req);
    if (!inv || (!admin && inv.status !== 'publicado')) throw httpError(404, 'Convite não encontrado ou ainda não publicado.');
    // link de um convite individual: devolve só os dados daquele convidado e a resposta dele
    const g = query(req).get('g');
    if (g) {
      const guest = await hget('guests:' + id, g);
      if (!guest) throw httpError(404, 'Este convite individual não existe mais. Peça um novo link a quem enviou o convite.');
      const rsvp = await hget('rsvps:' + id, 'g-' + g);
      return send(res, 200, Object.assign({}, inv, {
        guest: { id: guest.id, name: guest.name, people: guest.people || [], companions: guest.companions || 0, max: maxPeople(guest), rsvp: rsvp || null }
      }));
    }
    return send(res, 200, inv);
  }

  requireAdmin(req);

  if (req.method === 'GET') {
    const all = await hgetall(KEY);
    const items = await Promise.all(Object.values(all).map(async (inv) => summarize(inv, await hgetall('rsvps:' + inv.id))));
    items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return send(res, 200, items);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const inv = clean(body, null);
    inv.id = newId();
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
    const inv = clean(body, existing);
    inv.id = id;
    await hset(KEY, id, inv);
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
    const rsvps = await hgetall('rsvps:' + id);
    const guests = await hgetall('guests:' + id);
    await hdel(KEY, id);
    await del('rsvps:' + id);
    await del('guests:' + id);
    // devolve o que foi apagado para permitir "Desfazer"
    return send(res, 200, { deleted: id, invite: existing, rsvps, guests });
  }

  throw httpError(405, 'Método não permitido.');
});
