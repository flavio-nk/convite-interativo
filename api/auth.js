import { handler, query, readBody, send, httpError } from './_lib/http.js';
import {
  currentUser, publicUser, masterUser, checkMasterPassword, checkHash, sessionCookie, logoutCookie,
  passwordConfigured, isAdminUser, isClientUser, MASTER_ID,
  readAccessToken, dropAccessToken, checkPasswordRules, hashPassword, newVersion
} from './_lib/auth.js';
import { hgetall, hset, storageMode } from './_lib/store.js';
import { clientIp, rateLimit, isLimited, clearLimit } from './_lib/guard.js';
import crypto from 'node:crypto';
import { uploadsMode } from './upload.js';

// Limites contra tentativa e erro de senhas: por usuário (8 erros em 15 min) e por IP (30 erros em 15 min)
const USER_MAX = 8, IP_MAX = 30, WINDOW = 15 * 60;
const LOCKED = 'Muitas tentativas de entrar.';
async function fail(login, ip) {
  await new Promise((r) => setTimeout(r, 400));
  await rateLimit('login:u:' + login, USER_MAX, WINDOW, LOCKED).catch(() => {});
  await rateLimit('login:ip:' + ip, IP_MAX, WINDOW, LOCKED).catch(() => {});
  throw httpError(401, 'Usuário ou senha incorretos.');
}

export default handler(async (req, res) => {
  const action = query(req).get('action') || 'me';
  if (action === 'me') {
    let user = null;
    try { user = await currentUser(req); } catch (e) { user = null; }
    return send(res, 200, {
      user: publicUser(user),
      admin: isAdminUser(user),
      client: isClientUser(user),
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
    if (login.length > 160 || password.length > 200) throw httpError(400, 'Usuário ou senha inválidos.');
    const ip = clientIp(req);
    if ((await isLimited('login:u:' + login, USER_MAX)) || (await isLimited('login:ip:' + ip, IP_MAX))) {
      throw httpError(429, LOCKED + ' Aguarde 15 minutos e tente de novo.');
    }
    if (login === MASTER_ID) {
      if (!passwordConfigured()) throw httpError(503, 'Senha principal não configurada. No Vercel, crie a variável ADMIN_PASSWORD.');
      if (!checkMasterPassword(password)) await fail(login, ip);
      await clearLimit('login:u:' + login);
      return send(res, 200, { user: publicUser(masterUser()) }, { 'Set-Cookie': sessionCookie(req, masterUser()) });
    }
    const all = Object.values(await hgetall('users'));
    const u = all.find((x) => String(x.username).toLowerCase() === login || (x.email && String(x.email).toLowerCase() === login));
    // sem usuário, calcula um hash mesmo assim: o tempo de resposta não revela quais usuários existem
    if (!u) { crypto.scryptSync(password, 'x'.repeat(32), 64); await fail(login, ip); }
    if (!checkHash(password, u.pwSalt, u.pwHash)) await fail(login, ip);
    await clearLimit('login:u:' + login);
    if (u.active === false) throw httpError(403, 'Este usuário está inativo. Fale com um administrador.');
    await hset('users', u.id, Object.assign({}, u, { lastLogin: new Date().toISOString() }));
    return send(res, 200, { user: publicUser(u) }, { 'Set-Cookie': sessionCookie(req, u) });
  }
  // Link de acesso: confere o código e devolve o nome de quem vai criar a senha
  if (action === 'access' || action === 'setpw') {
    const body = await readBody(req);
    const ip = clientIp(req);
    if (await isLimited('access:ip:' + ip, 20)) throw httpError(429, 'Muitas tentativas. Aguarde 15 minutos e tente de novo.');
    const found = await readAccessToken(body.token);
    if (!found) {
      await rateLimit('access:ip:' + ip, 20, WINDOW, 'Muitas tentativas.').catch(() => {});
      throw httpError(404, 'Este link de acesso não vale mais (ele vale por 7 dias e só pode ser usado uma vez). Peça um novo link a quem fez o seu convite.');
    }
    const u = found.user;
    if (action === 'access') {
      return send(res, 200, { name: u.name, username: u.username, role: publicUser(u).role, hasPassword: !!u.pwHash });
    }
    const password = typeof body.password === 'string' ? body.password : '';
    checkPasswordRules(password, u.username, u.email);
    const h = hashPassword(password);
    const now = new Date().toISOString();
    // senha nova: encerra outras sessões abertas e o link deixa de valer
    const next = Object.assign({}, u, { pwSalt: h.salt, pwHash: h.hash, ver: newVersion(), updatedAt: now, lastLogin: now });
    delete next.accessKey; delete next.accessExp;
    await hset('users', u.id, next);
    await dropAccessToken(found.key);
    await clearLimit('login:u:' + String(u.username).toLowerCase());
    return send(res, 200, { user: publicUser(next) }, { 'Set-Cookie': sessionCookie(req, next) });
  }
  if (action === 'logout') {
    return send(res, 200, { user: null }, { 'Set-Cookie': logoutCookie() });
  }
  throw httpError(404, 'Ação desconhecida.');
});
