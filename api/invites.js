import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import { isAdmin, requireAdmin } from './_lib/auth.js';
import { hget, hset, hdel, hgetall, del } from './_lib/store.js';

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
    const restore = body && body.__rsvps;
    if (body) delete body.__rsvps;
    const existing = await hget(KEY, id);
    const inv = clean(body, existing);
    inv.id = id;
    await hset(KEY, id, inv);
    if (restore && typeof restore === 'object') {
      for (const rid of Object.keys(restore).slice(0, 5000)) await hset('rsvps:' + id, rid, restore[rid]);
    }
    return send(res, 200, inv);
  }

  if (req.method === 'DELETE') {
    if (!id) throw httpError(400, 'Informe o convite.');
    const existing = await hget(KEY, id);
    const rsvps = await hgetall('rsvps:' + id);
    await hdel(KEY, id);
    await del('rsvps:' + id);
    // devolve o que foi apagado para permitir "Desfazer"
    return send(res, 200, { deleted: id, invite: existing, rsvps });
  }

  throw httpError(405, 'Método não permitido.');
});
