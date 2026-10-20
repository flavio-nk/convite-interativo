import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import { isAdmin, requireAdmin } from './_lib/auth.js';
import { hget, hset, hdel, hgetall } from './_lib/store.js';
import { maxPeople } from './guests.js';

const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

export default handler(async (req, res) => {
  const q = query(req);
  const inviteId = q.get('invite');
  if (!inviteId) throw httpError(400, 'Informe o convite.');
  const key = 'rsvps:' + inviteId;

  if (req.method === 'GET') {
    requireAdmin(req);
    const all = await hgetall(key);
    const list = Object.values(all).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return send(res, 200, list);
  }

  if (req.method === 'POST') {
    const inv = await hget('invites', inviteId);
    const admin = isAdmin(req);
    if (!inv || (!admin && inv.status !== 'publicado')) throw httpError(404, 'Convite não encontrado ou ainda não publicado.');
    const body = await readBody(req);
    const now = new Date().toISOString();
    const personal = inv.personal && inv.personal.enabled;

    // Resposta por um convite individual: nomes de quem vai, até o limite daquele convite.
    const guestId = str(body.guestId, 40);
    if (guestId) {
      const guest = await hget('guests:' + inviteId, guestId);
      if (!guest) throw httpError(404, 'Este convite individual não existe mais.');
      if (typeof body.go !== 'boolean') throw httpError(400, 'Escolha se vocês vão ou não.');
      const max = maxPeople(guest);
      const names = body.go ? (Array.isArray(body.names) ? body.names : []).map((n) => str(n, 120)).filter(Boolean) : [];
      if (body.go && !names.length) throw httpError(400, 'Escreva o nome de quem vai.');
      if (names.length > max) throw httpError(400, 'Este convite permite no máximo ' + max + (max === 1 ? ' pessoa.' : ' pessoas.'));
      const rid = 'g-' + guestId;
      const prev = await hget(key, rid);
      const entry = {
        id: rid, guestId, name: guest.name, names, go: body.go,
        guests: body.go ? Math.max(0, names.length - 1) : 0,
        diet: body.go ? str(body.diet, 200) : '',
        msg: str(body.msg, 1000),
        createdAt: (prev && prev.createdAt) || now,
        updatedAt: now
      };
      await hset(key, rid, entry);
      return send(res, 200, { rsvpId: rid, entry });
    }
    if (personal && inv.personal.generic === false && !admin) {
      throw httpError(403, 'Para confirmar presença, use o link individual que você recebeu.');
    }

    const name = str(body.name, 120);
    if (!name) throw httpError(400, 'Informe seu nome completo.');
    if (typeof body.go !== 'boolean') throw httpError(400, 'Escolha se você vai ou não.');
    const guests = body.go ? Math.max(0, Math.min(20, parseInt(body.guests, 10) || 0)) : 0;
    let rid = str(body.rsvpId, 40);
    const prev = rid ? await hget(key, rid) : null;
    if (!prev || prev.guestId) rid = newId(12);
    const entry = {
      id: rid,
      name,
      go: body.go,
      guests,
      diet: body.go ? str(body.diet, 200) : '',
      msg: str(body.msg, 1000),
      createdAt: (prev && prev.createdAt) || now,
      updatedAt: now
    };
    await hset(key, rid, entry);
    return send(res, 200, { rsvpId: rid, entry });
  }

  if (req.method === 'DELETE') {
    requireAdmin(req);
    const id = q.get('id');
    if (!id) throw httpError(400, 'Informe a resposta.');
    await hdel(key, id);
    return send(res, 200, { deleted: id });
  }

  throw httpError(405, 'Método não permitido.');
});
