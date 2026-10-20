// Convites individuais (personalização por convidado).
// Cada convite individual tem um código próprio, que vai no link do convidado
// (#/c/<convite>/<código>), um nome (ex.: "Família Silva"), os nomes das pessoas
// convidadas e quantos acompanhantes extras podem ser incluídos.
// Guardados no hash "guests:<convite>"; a resposta fica em "rsvps:<convite>" com id "g-<código>".
import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import { requireAdmin } from './_lib/auth.js';
import { hget, hset, hdel, hgetall } from './_lib/store.js';

const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
export const MAX_COMPANIONS = 20;
export const MAX_PEOPLE = 30;

export function cleanGuest(input, prev) {
  const people = (Array.isArray(input.people) ? input.people : String(input.people || '').split(/\n|;/))
    .map((p) => str(p, 120)).filter(Boolean).slice(0, MAX_PEOPLE);
  let name = str(input.name, 120);
  if (!name) name = people.length ? (people.length > 1 ? people.slice(0, -1).join(', ') + ' e ' + people[people.length - 1] : people[0]) : '';
  if (!name) throw httpError(400, 'Informe o nome do convite ou de pelo menos um convidado.');
  const companions = Math.max(0, Math.min(MAX_COMPANIONS, parseInt(input.companions, 10) || 0));
  const now = new Date().toISOString();
  return {
    id: (prev && prev.id) || '',
    name, people, companions,
    phone: str(input.phone, 30),
    createdAt: (prev && prev.createdAt) || now,
    updatedAt: now
  };
}

// Quantas pessoas, no máximo, podem ir com este convite.
export const maxPeople = (g) => Math.max(1, (g.people || []).length) + (Number(g.companions) || 0);

export default handler(async (req, res) => {
  const q = query(req);
  const inviteId = q.get('invite');
  if (!inviteId) throw httpError(400, 'Informe o convite.');
  requireAdmin(req);
  const key = 'guests:' + inviteId;
  const id = q.get('id');

  if (req.method === 'GET') {
    const all = await hgetall(key);
    const rsvps = await hgetall('rsvps:' + inviteId);
    const list = Object.values(all)
      .map((g) => Object.assign({}, g, { max: maxPeople(g), rsvp: rsvps['g-' + g.id] || null }))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    return send(res, 200, list);
  }

  if (req.method === 'POST') {
    const inv = await hget('invites', inviteId);
    if (!inv) throw httpError(404, 'Convite não encontrado.');
    const body = await readBody(req);
    const items = Array.isArray(body.items) ? body.items : [body];
    if (!items.length) throw httpError(400, 'Nada para adicionar.');
    if (items.length > 500) throw httpError(400, 'Adicione no máximo 500 convites de uma vez.');
    const created = [];
    for (const it of items) {
      const g = cleanGuest(it || {}, null);
      g.id = newId(8);
      await hset(key, g.id, g);
      created.push(Object.assign({}, g, { max: maxPeople(g), rsvp: null }));
    }
    return send(res, 201, created);
  }

  if (req.method === 'PUT') {
    if (!id) throw httpError(400, 'Informe o convite individual.');
    const prev = await hget(key, id);
    if (!prev) throw httpError(404, 'Convite individual não encontrado.');
    const g = cleanGuest(await readBody(req), prev);
    await hset(key, id, g);
    const rsvp = await hget('rsvps:' + inviteId, 'g-' + id);
    return send(res, 200, Object.assign({}, g, { max: maxPeople(g), rsvp: rsvp || null }));
  }

  if (req.method === 'DELETE') {
    if (!id) throw httpError(400, 'Informe o convite individual.');
    await hdel(key, id);
    await hdel('rsvps:' + inviteId, 'g-' + id);
    return send(res, 200, { deleted: id });
  }

  throw httpError(405, 'Método não permitido.');
});
