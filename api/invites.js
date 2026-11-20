import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import { currentUser, requireUser, canManage, ownerOf, isAdminUser, isClientUser, roleOf, MASTER_ID } from './_lib/auth.js';
import { hget, hset, hdel, hgetall, del } from './_lib/store.js';
import { maxPeople } from './guests.js';
import { validId, rateLimit, clientIp } from './_lib/guard.js';
import { statsFor, computeStats, dropStats } from './_lib/stats.js';

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

function summarize(inv, owners, stats) {
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
    ownerName: owners && owners[ownerOf(inv)] ? owners[ownerOf(inv)].name : '',
    ownerRole: owners && owners[ownerOf(inv)] ? owners[ownerOf(inv)].role : '',
    transferredAt: inv.transferredAt || null,
    updatedAt: inv.updatedAt,
    createdAt: inv.createdAt,
    slug: inv.slug || '',
    place: placeOf(inv),
    ready: readiness(inv),
    stats: stats || null
  };
}

// Textos de exemplo que o convite traz ao nascer e que ainda não foram trocados
const PLACEHOLDER = [/\[[^\]]*\]/, /\{prazo\}/i, /^NOME & NOME$/i, /DD \. MM \. AAAA/, /^Escreva aqui/, /^Título do evento$/, /^Nome do local$/, /^Data e horário do evento$/, /^Outras orientações$/m];
export function placeholderIn(text, hasDeadline) {
  let t = String(text || '');
  if (hasDeadline) t = t.replace(/\[data limite\]|\{prazo\}/gi, '');
  return PLACEHOLDER.some((re) => re.test(t));
}

function placeOf(inv) {
  for (const p of inv.pages || []) for (const b of (p && p.blocks) || []) {
    if (b && b.type === 'mapa' && b.text && !placeholderIn(b.text)) return String(b.text).slice(0, 80);
  }
  return '';
}

// O que falta para o convite ficar pronto (mesma regra do editor)
function readiness(inv) {
  const blocks = [];
  for (const p of inv.pages || []) for (const b of (p && p.blocks) || []) if (b) blocks.push(b);
  const rsvp = blocks.find((b) => b.type === 'rsvp');
  const maps = blocks.filter((b) => b.type === 'mapa');
  const steps = [
    { key: 'textos', label: 'Textos do convite', ok: !blocks.some((b) => placeholderIn(b.text, rsvp && rsvp.deadline) || placeholderIn(b.address)) },
    { key: 'data', label: 'Data e horário', ok: !!inv.eventDate }
  ];
  if (maps.length) steps.push({ key: 'local', label: 'Local do evento', ok: maps.every((b) => String(b.address || '').trim()) });
  if (rsvp) steps.push({ key: 'prazo', label: 'Prazo para responder', ok: !!rsvp.deadline });
  steps.push({ key: 'publicado', label: 'Publicar e compartilhar', ok: inv.status === 'publicado' });
  return { done: steps.filter((x) => x.ok).length, total: steps.length, steps, deadline: rsvp && rsvp.deadline ? rsvp.deadline : null };
}

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;
export function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/g, '');
}
// convite pelo id ou pelo link curto
async function findInvite(idOrSlug) {
  const inv = await hget(KEY, idOrSlug);
  if (inv) return inv;
  const real = await hget('slugs', String(idOrSlug).toLowerCase());
  return real ? hget(KEY, real) : null;
}

export default handler(async (req, res) => {
  const id = validId(query(req).get('id'), 'Convite');

  if (req.method === 'GET' && id) {
    const inv = await findInvite(id);
    // rascunhos só abrem para o dono do convite ou um administrador
    const manager = inv ? canManage(await currentUser(req), inv) : false;
    if (!inv || (!manager && inv.status !== 'publicado')) throw httpError(404, 'Convite não encontrado ou ainda não publicado.');
    // link de um convite individual: devolve só os dados daquele convidado e a resposta dele
    const g = validId(query(req).get('g'), 'Convite individual');
    // quem não gerencia o convite não precisa saber quem é o dono
    const pub = manager ? inv : Object.assign({}, inv, { ownerId: undefined });
    if (g) {
      const guest = await hget('guests:' + inv.id, g);
      // tentativas de adivinhar códigos de convites individuais: limite por IP
      if (!guest) await rateLimit('gcode:' + clientIp(req), 40, 10 * 60, 'Muitos links inválidos.');
      if (!guest) throw httpError(404, 'Este convite individual não existe mais. Peça um novo link a quem enviou o convite.');
      const rsvp = await hget('rsvps:' + inv.id, 'g-' + g);
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
      owners = { [MASTER_ID]: { name: 'Administrador principal', role: 'admin' } };
      for (const u of Object.values(await hgetall('users'))) owners[u.id] = { name: u.name, role: roleOf(u) };
    }
    // as contagens de respostas vêm do hash "stats" (refeito a cada resposta): 2 leituras em vez de 1 + N
    const stats = await statsFor(mine.map((inv) => inv.id));
    const items = mine.map((inv) => summarize(inv, owners, stats[inv.id]));
    items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return send(res, 200, items);
  }

  // conta de cliente: só edita os convites que já estão nela
  if ((req.method === 'POST' || req.method === 'DELETE') && isClientUser(user)) {
    throw httpError(403, req.method === 'POST' ? 'Contas de cliente não criam convites. Fale com quem fez o seu convite.' : 'Contas de cliente não excluem convites. Fale com quem fez o seu convite.');
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    if (!admin) {
      const count = Object.values(await hgetall(KEY)).filter((x) => ownerOf(x) === user.id).length;
      if (count >= MAX_INVITES_PER_USER) throw httpError(403, 'Limite de ' + MAX_INVITES_PER_USER + ' convites por usuário atingido. Exclua convites antigos para criar novos.');
    }
    delete body.slug;
    const inv = clean(body, null);
    inv.id = newId();
    inv.ownerId = user.id;
    await hset(KEY, inv.id, inv);
    return send(res, 201, inv);
  }

  if (req.method === 'PUT' && query(req).get('action') === 'slug') {
    // link curto: /c/<nome-do-link>
    if (!id) throw httpError(400, 'Informe o convite.');
    const existing = await hget(KEY, id);
    if (!existing || !canManage(user, existing)) throw httpError(404, 'Convite não encontrado.');
    const body = await readBody(req);
    const slug = slugify(body.slug);
    if (!SLUG.test(slug)) throw httpError(400, 'Use de 3 a 48 letras, números ou hífens.');
    if (/^(api|c|assets|admin|convite|convites)$/.test(slug)) throw httpError(400, 'Esse nome é reservado. Escolha outro.');
    const owner = await hget('slugs', slug);
    if (owner && owner !== id) throw httpError(409, 'Esse link já está em uso. Tente outro, por exemplo com o ano: ' + slug + '-' + new Date().getFullYear() + '.');
    if (existing.slug && existing.slug !== slug) await hdel('slugs', existing.slug);
    await hset('slugs', slug, id);
    const inv = Object.assign({}, existing, { slug, updatedAt: new Date().toISOString() });
    await hset(KEY, id, inv);
    return send(res, 200, { slug });
  }

  if (req.method === 'PUT' && query(req).get('action') === 'transfer') {
    // passar o convite (com respostas e convidados) para a conta de outro usuário: só administradores
    if (!admin) throw httpError(403, 'Só administradores podem transferir convites.');
    if (!id) throw httpError(400, 'Informe o convite.');
    const existing = await hget(KEY, id);
    if (!existing) throw httpError(404, 'Convite não encontrado.');
    const body = await readBody(req);
    const to = String(body.ownerId || '');
    let target = to === MASTER_ID ? { id: MASTER_ID, name: 'Administrador principal', role: 'admin' } : await hget('users', validId(to, 'Usuário') || '-');
    if (!target) throw httpError(404, 'Usuário não encontrado.');
    if (target.active === false) throw httpError(400, 'Este usuário está inativo.');
    const inv = Object.assign({}, existing, { ownerId: target.id, transferredAt: new Date().toISOString(), transferredBy: user.id });
    await hset(KEY, id, inv);
    return send(res, 200, { id, ownerId: target.id, ownerName: target.name, ownerRole: roleOf(target) });
  }

  if (req.method === 'PUT') {
    if (!id) throw httpError(400, 'Informe o convite.');
    const body = await readBody(req);
    delete body.slug;
    const restoring = '__rsvps' in body || '__guests' in body;
    const restore = body.__rsvps;
    const restoreGuests = body.__guests;
    delete body.__rsvps; delete body.__guests; delete body.guest;
    delete body.transferredAt; delete body.transferredBy;
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
    if (tomb) await computeStats(id);
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
    if (existing.slug && (await hget('slugs', existing.slug)) === id) await hdel('slugs', existing.slug);
    await dropStats(id);
    // devolve o que foi apagado para permitir "Desfazer"
    return send(res, 200, { deleted: id, invite: existing, rsvps, guests });
  }

  throw httpError(405, 'Método não permitido.');
});
