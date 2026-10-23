import { handler, query, readBody, send, httpError } from './_lib/http.js';
import {
  currentUser, publicUser, masterUser, checkMasterPassword, checkHash, sessionCookie, logoutCookie,
  passwordConfigured, isAdminUser, MASTER_ID
} from './_lib/auth.js';
import { hgetall, hset, storageMode } from './_lib/store.js';
import { uploadsMode } from './upload.js';

const fail = async () => {
  await new Promise((r) => setTimeout(r, 400));
  throw httpError(401, 'Usuário ou senha incorretos.');
};

export default handler(async (req, res) => {
  const action = query(req).get('action') || 'me';
  if (action === 'me') {
    let user = null;
    try { user = await currentUser(req); } catch (e) { user = null; }
    return send(res, 200, {
      user: publicUser(user),
      admin: isAdminUser(user),
      logged: !!user,
      passwordConfigured: passwordConfigured(),
      storage: storageMode,
      uploads: uploadsMode()
    });
  }
  if (req.method !== 'POST') throw httpError(405, 'Método não permitido.');
  if (action === 'login') {
    const body = await readBody(req);
    const login = String(body.username || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!login || !password) throw httpError(400, 'Informe usuário e senha.');
    if (login === MASTER_ID) {
      if (!passwordConfigured()) throw httpError(503, 'Senha principal não configurada. No Vercel, crie a variável ADMIN_PASSWORD.');
      if (!checkMasterPassword(password)) await fail();
      return send(res, 200, { user: publicUser(masterUser()) }, { 'Set-Cookie': sessionCookie(req, masterUser()) });
    }
    const all = Object.values(await hgetall('users'));
    const u = all.find((x) => String(x.username).toLowerCase() === login || (x.email && String(x.email).toLowerCase() === login));
    if (!u || !checkHash(password, u.pwSalt, u.pwHash)) await fail();
    if (u.active === false) throw httpError(403, 'Este usuário está inativo. Fale com um administrador.');
    await hset('users', u.id, Object.assign({}, u, { lastLogin: new Date().toISOString() }));
    return send(res, 200, { user: publicUser(u) }, { 'Set-Cookie': sessionCookie(req, u) });
  }
  if (action === 'logout') {
    return send(res, 200, { user: null }, { 'Set-Cookie': logoutCookie() });
  }
  throw httpError(404, 'Ação desconhecida.');
});
