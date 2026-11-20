// Usuários da plataforma (só administradores): listar, criar, editar, ativar/inativar,
// dar acesso a um cliente (cria a conta, passa o convite para ela e gera o link de acesso)
// e gerar um novo link de acesso (serve também para o usuário trocar uma senha esquecida).
import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import {
  requireAdmin, publicUser, masterUser, hashPassword, newVersion, MASTER_ID, checkPasswordRules, createAccessToken
} from './_lib/auth.js';
import { hget, hset, hgetall } from './_lib/store.js';
import { validId } from './_lib/guard.js';

const KEY = 'users';
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const ROLES = ['admin', 'user', 'cliente'];

function validate(body, prev, all) {
  const out = {};
  const name = str(body.name !== undefined ? body.name : prev && prev.name, 120);
  if (!name) throw httpError(400, 'Informe o nome.');
  const roleIn = body.role !== undefined ? body.role : prev && prev.role;
  const role = ROLES.includes(roleIn) ? roleIn : 'user';
  const email = str(body.email !== undefined ? body.email : prev && prev.email, 160).toLowerCase();
  // para clientes, o e-mail é opcional (o acesso vai por link, muitas vezes pelo WhatsApp)
  if ((email || role !== 'cliente') && !EMAIL.test(email)) throw httpError(400, 'Informe um e-mail válido.');
  const phone = str(body.phone !== undefined ? body.phone : prev && prev.phone, 30);
  if (phone && phone.replace(/\D/g, '').length < 8) throw httpError(400, 'Telefone incompleto: informe DDD e número.');
  const username = str(body.username !== undefined ? body.username : prev && prev.username, 30).toLowerCase();
  if (!USERNAME.test(username)) throw httpError(400, 'Nome de usuário: de 3 a 30 caracteres, só letras minúsculas sem acento, números, ponto, hífen ou sublinhado.');
  if (username === MASTER_ID) throw httpError(400, 'O nome de usuário "admin" é reservado.');
  const others = all.filter((u) => !prev || u.id !== prev.id);
  if (others.some((u) => String(u.username).toLowerCase() === username)) throw httpError(409, 'Já existe um usuário com esse nome de usuário.');
  if (email && others.some((u) => String(u.email || '').toLowerCase() === email)) throw httpError(409, 'Já existe um usuário com esse e-mail.');
  const active = body.active !== undefined ? body.active !== false : (prev ? prev.active !== false : true);
  Object.assign(out, { name, email, phone, username, role, active });
  if (body.password !== undefined && body.password !== '') {
    const pw = String(body.password);
    checkPasswordRules(pw, username, email);
    const h = hashPassword(pw);
    out.pwSalt = h.salt; out.pwHash = h.hash;
  } else if (!prev && role !== 'cliente') {
    // cliente pode nascer sem senha: ele mesmo cria pelo link de acesso
    throw httpError(400, 'Informe a senha.');
  }
  return out;
}

// nome de usuário a partir do nome ("Ana Paula Souza" → "ana.souza", "ana.souza2"…)
function suggestUsername(name, all) {
  const words = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w && !['de', 'da', 'do', 'das', 'dos', 'e'].includes(w));
  let base = (words.length > 1 ? words[0] + '.' + words[words.length - 1] : words[0] || 'cliente').slice(0, 24);
  if (base.length < 3) base = (base + 'cliente').slice(0, 10);
  if (base === MASTER_ID) base = 'admin.cliente';
  const taken = new Set(all.map((u) => String(u.username).toLowerCase()));
  let u = base, n = 2;
  while (taken.has(u)) u = base + n++;
  return u;
}

// mensagem pronta para enviar ao cliente (WhatsApp ou e-mail)
function accessMessage(user, link, title) {
  const first = String(user.name || '').split(/\s+/)[0] || '';
  return 'Olá' + (first ? ', ' + first : '') + '! ' +
    (title ? 'Seu convite "' + title + '" já está na sua conta. ' : 'Sua conta de convites está pronta. ') +
    'Pelo link abaixo você cria a sua senha e passa a acompanhar as respostas dos convidados e ajustar o convite quando quiser:\n\n' +
    link + '\n\nSeu usuário: ' + user.username + '\nO link vale por 7 dias e pode ser usado uma vez.';
}

function originOf(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = String(req.headers['x-forwarded-proto'] || (process.env.VERCEL ? 'https' : 'http')).split(',')[0];
  return host ? proto + '://' + host : '';
}

async function linkFor(req, user, me, title) {
  const { token, exp } = await createAccessToken(user, me.id);
  const link = originOf(req) + '/#/Acesso/' + token;
  return { link, exp, message: accessMessage(user, link, title) };
}

export default handler(async (req, res) => {
  const me = await requireAdmin(req);
  const id = validId(query(req).get('id'), 'Usuário');
  const action = query(req).get('action') || '';

  // Dar acesso ao cliente: cria a conta Cliente (ou usa uma existente), passa o convite para ela e gera o link
  if (req.method === 'POST' && action === 'client') {
    const body = await readBody(req);
    const all = Object.values(await hgetall(KEY));
    const inviteId = validId(body.inviteId, 'Convite');
    const inv = inviteId ? await hget('invites', inviteId) : null;
    if (inviteId && !inv) throw httpError(404, 'Convite não encontrado.');
    let u;
    if (body.userId) {
      u = await hget(KEY, validId(body.userId, 'Usuário'));
      if (!u) throw httpError(404, 'Usuário não encontrado.');
      if (u.active === false) throw httpError(400, 'Este usuário está inativo. Ative-o em Usuários antes de dar acesso.');
    } else {
      const data = validate({
        name: body.name, email: body.email || '', phone: body.phone || '', role: 'cliente',
        username: body.username || suggestUsername(body.name, all)
      }, null, all);
      const now = new Date().toISOString();
      u = Object.assign({ id: newId(10), ver: newVersion(), createdAt: now, updatedAt: now, createdBy: me.id }, data);
      await hset(KEY, u.id, u);
    }
    if (inv && inv.ownerId !== u.id) {
      await hset('invites', inv.id, Object.assign({}, inv, { ownerId: u.id, transferredAt: new Date().toISOString(), transferredBy: me.id }));
    }
    const out = await linkFor(req, u, me, inv && inv.title);
    return send(res, 201, Object.assign({ user: publicUser(await hget(KEY, u.id)) }, out));
  }

  // novo link de acesso para um usuário (o anterior deixa de valer)
  if (req.method === 'POST' && action === 'link') {
    if (!id) throw httpError(400, 'Informe o usuário.');
    if (id === MASTER_ID) throw httpError(400, 'A conta principal usa a senha da variável ADMIN_PASSWORD.');
    const u = await hget(KEY, id);
    if (!u) throw httpError(404, 'Usuário não encontrado.');
    if (u.active === false) throw httpError(400, 'Este usuário está inativo. Ative-o antes de gerar o link.');
    const out = await linkFor(req, u, me, '');
    return send(res, 200, Object.assign({ user: publicUser(await hget(KEY, id)) }, out));
  }

  if (req.method === 'GET') {
    const all = Object.values(await hgetall(KEY)).map(publicUser)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    return send(res, 200, [publicUser(masterUser())].concat(all));
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const all = Object.values(await hgetall(KEY));
    const data = validate(body, null, all);
    const now = new Date().toISOString();
    const u = Object.assign({ id: newId(10), ver: newVersion(), createdAt: now, updatedAt: now, createdBy: me.id }, data);
    await hset(KEY, u.id, u);
    return send(res, 201, publicUser(u));
  }

  if (req.method === 'PUT') {
    if (!id) throw httpError(400, 'Informe o usuário.');
    if (id === MASTER_ID) throw httpError(400, 'A conta principal não pode ser alterada aqui. A senha dela é a variável ADMIN_PASSWORD no Vercel.');
    const prev = await hget(KEY, id);
    if (!prev) throw httpError(404, 'Usuário não encontrado.');
    const body = await readBody(req);
    const all = Object.values(await hgetall(KEY));
    const data = validate(body, prev, all);
    if (id === me.id && data.active === false) throw httpError(400, 'Você não pode inativar a sua própria conta.');
    if (id === me.id && data.role !== 'admin') throw httpError(400, 'Você não pode tirar o seu próprio acesso de administrador.');
    const u = Object.assign({}, prev, data, { updatedAt: new Date().toISOString() });
    // nova senha ou inativação: encerra as sessões abertas desse usuário
    if (data.pwHash || (prev.active !== false && data.active === false) || prev.role !== data.role) u.ver = newVersion();
    await hset(KEY, id, u);
    return send(res, 200, publicUser(u));
  }

  throw httpError(405, 'Método não permitido.');
});
