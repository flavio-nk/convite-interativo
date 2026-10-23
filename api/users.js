// Usuários da plataforma (só administradores): listar, criar, editar, ativar/inativar.
import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import { requireAdmin, publicUser, masterUser, hashPassword, newVersion, MASTER_ID } from './_lib/auth.js';
import { hget, hset, hgetall } from './_lib/store.js';

const KEY = 'users';
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;

function validate(body, prev, all) {
  const out = {};
  const name = str(body.name !== undefined ? body.name : prev && prev.name, 120);
  if (!name) throw httpError(400, 'Informe o nome.');
  const email = str(body.email !== undefined ? body.email : prev && prev.email, 160).toLowerCase();
  if (!EMAIL.test(email)) throw httpError(400, 'Informe um e-mail válido.');
  const phone = str(body.phone !== undefined ? body.phone : prev && prev.phone, 30);
  if (phone && phone.replace(/\D/g, '').length < 8) throw httpError(400, 'Telefone incompleto: informe DDD e número.');
  const username = str(body.username !== undefined ? body.username : prev && prev.username, 30).toLowerCase();
  if (!USERNAME.test(username)) throw httpError(400, 'Nome de usuário: de 3 a 30 caracteres, só letras minúsculas sem acento, números, ponto, hífen ou sublinhado.');
  if (username === MASTER_ID) throw httpError(400, 'O nome de usuário "admin" é reservado.');
  const others = all.filter((u) => !prev || u.id !== prev.id);
  if (others.some((u) => String(u.username).toLowerCase() === username)) throw httpError(409, 'Já existe um usuário com esse nome de usuário.');
  if (others.some((u) => String(u.email).toLowerCase() === email)) throw httpError(409, 'Já existe um usuário com esse e-mail.');
  const role = (body.role !== undefined ? body.role : prev && prev.role) === 'admin' ? 'admin' : 'user';
  const active = body.active !== undefined ? body.active !== false : (prev ? prev.active !== false : true);
  Object.assign(out, { name, email, phone, username, role, active });
  if (body.password !== undefined && body.password !== '') {
    const pw = String(body.password);
    if (pw.length < 8) throw httpError(400, 'A senha precisa ter pelo menos 8 caracteres.');
    if (pw.length > 200) throw httpError(400, 'Senha longa demais.');
    const h = hashPassword(pw);
    out.pwSalt = h.salt; out.pwHash = h.hash;
  } else if (!prev) {
    throw httpError(400, 'Informe a senha.');
  }
  return out;
}

export default handler(async (req, res) => {
  const me = await requireAdmin(req);
  const id = query(req).get('id');

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
