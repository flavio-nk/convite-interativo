import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import { currentUser, requireUser, canManage } from './_lib/auth.js';
import { hget, hset, hdel, hgetall } from './_lib/store.js';
import { maxPeople } from './guests.js';

const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// O bloco de confirmação do convite (o primeiro, se houver mais de um): prazo e limite de acompanhantes.
function rsvpBlock(inv) {
  for (const p of inv.pages || []) for (const b of (p && p.blocks) || []) if (b && b.type === 'rsvp') return b;
  return null;
}

export default handler(async (req, res) => {
  const q = query(req);
  const inviteId = q.get('invite');
  if (!inviteId) throw httpError(400, 'Informe o convite.');
  const key = 'rsvps:' + inviteId;

  // dono do convite ou administrador
  const manage = async () => {
    const user = await requireUser(req);
    const inv = await hget('invites', inviteId);
    if (!inv || !canManage(user, inv)) throw httpError(404, 'Convite não encontrado.');
  };

  if (req.method === 'GET') {
    await manage();
    const all = await hgetall(key);
    const list = Object.values(all).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return send(res, 200, list);
  }

  if (req.method === 'POST') {
    const inv = await hget('invites', inviteId);
    // quem gerencia o convite (dono ou administrador) pode responder por um convidado
    const admin = canManage(await currentUser(req), inv);
    if (!inv || (!admin && inv.status !== 'publicado')) throw httpError(404, 'Convite não encontrado ou ainda não publicado.');
    const body = await readBody(req);
    const now = new Date().toISOString();
    const personal = inv.personal && inv.personal.enabled;
    // respostas registradas pelo organizador no painel (só com login)
    const via = admin && body.via === 'painel' ? 'painel' : 'convite';
    const block = rsvpBlock(inv) || {};
    if (!admin && block.deadline && new Date(block.deadline).getTime() < Date.now()) {
      throw httpError(403, 'O prazo para confirmar presença terminou.');
    }

    // Resposta por um convite individual: nomes de quem vai, até o limite daquele convite.
    const guestId = str(body.guestId, 40);
    if (guestId) {
      const guest = await hget('guests:' + inviteId, guestId);
      if (!guest) throw httpError(404, 'Este convite individual não existe mais.');
      const max = maxPeople(guest);
      let names, absent = [], attend = null, extra = [], go;
      if (Array.isArray(body.attend)) {
        // resposta pessoa a pessoa: cada convidado vai ou não; acompanhantes pelo nome
        const slots = Math.max(1, (guest.people || []).length);
        if (body.attend.length > slots) throw httpError(400, 'Este convite tem ' + slots + (slots === 1 ? ' convidado.' : ' convidados.'));
        attend = body.attend.map((a, i) => {
          if (!a || typeof a.go !== 'boolean') throw httpError(400, 'Responda se cada pessoa vai ou não.');
          const fixed = (guest.people || [])[i];
          const nm = fixed || str(a.name, 120);
          if (a.go && !nm) throw httpError(400, 'Escreva o nome de quem vai.');
          return { name: nm, go: a.go };
        });
        if (attend.length < slots) throw httpError(400, 'Responda se cada pessoa vai ou não.');
        const going = attend.filter((a) => a.go);
        extra = (Array.isArray(body.extra) ? body.extra : []).map((n) => str(n, 120)).filter(Boolean);
        if (extra.length && !going.length) throw httpError(400, 'Os acompanhantes precisam ir com pelo menos um convidado.');
        const comp = Number(guest.companions) || 0;
        if (extra.length > comp) throw httpError(400, 'Este convite permite no máximo ' + comp + (comp === 1 ? ' acompanhante.' : ' acompanhantes.'));
        names = going.map((a) => a.name).concat(extra);
        absent = attend.filter((a) => !a.go && a.name).map((a) => a.name);
        go = names.length > 0;
      } else {
        if (typeof body.go !== 'boolean') throw httpError(400, 'Escolha se vocês vão ou não.');
        go = body.go;
        names = go ? (Array.isArray(body.names) ? body.names : []).map((n) => str(n, 120)).filter(Boolean) : [];
        if (go && !names.length) throw httpError(400, 'Escreva o nome de quem vai.');
      }
      if (names.length > max) throw httpError(400, 'Este convite permite no máximo ' + max + (max === 1 ? ' pessoa.' : ' pessoas.'));
      const rid = 'g-' + guestId;
      const prev = await hget(key, rid);
      const entry = {
        id: rid, guestId, name: guest.name, names, absent, attend, extra, go, via,
        guests: go ? Math.max(0, names.length - 1) : 0,
        diet: go ? str(body.diet, 200) : '',
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
    const cap = admin ? 20 : (block.askGuests === false ? 0 : Math.max(0, Math.min(20, block.maxGuests == null ? 2 : Number(block.maxGuests) || 0)));
    const guests = body.go ? Math.max(0, Math.min(cap, parseInt(body.guests, 10) || 0)) : 0;
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
      via,
      createdAt: (prev && prev.createdAt) || now,
      updatedAt: now
    };
    await hset(key, rid, entry);
    return send(res, 200, { rsvpId: rid, entry });
  }

  if (req.method === 'DELETE') {
    await manage();
    const id = q.get('id');
    if (!id) throw httpError(400, 'Informe a resposta.');
    await hdel(key, id);
    return send(res, 200, { deleted: id });
  }

  throw httpError(405, 'Método não permitido.');
});
