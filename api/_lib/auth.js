// Acesso: usuários com nome de usuário e senha, em três perfis:
//   Administrador (tudo), Usuário (cria e gerencia os próprios convites e temas) e
//   Cliente (só vê e edita os convites que estão na conta dele e acompanha as respostas;
//   não cria nem exclui convites, nem cria temas). O cliente recebe o acesso por um link.
// - A conta principal "admin" usa a senha da variável ADMIN_PASSWORD (no Vercel) e é sempre Administrador.
//   Ela não fica no banco: serve para o primeiro acesso e para recuperar o acesso se algo der errado.
// - Os demais usuários ficam no hash "users" do banco, com a senha guardada só como hash (scrypt).
// - A sessão é um cookie assinado com o id do usuário e a "versão" da conta: trocar a senha ou
//   inativar o usuário derruba as sessões dele na hora.
import crypto from 'node:crypto';
import { httpError } from './http.js';
import { hget, hset, hdel } from './store.js';

const COOKIE = 'ci_session';
const DAYS = 30;
export const MASTER_ID = 'admin';

export function passwordConfigured() {
  return !!process.env.ADMIN_PASSWORD || !process.env.VERCEL;
}

function masterPassword() {
  // Fora do Vercel (desenvolvimento local), a senha padrão é "convite".
  return process.env.ADMIN_PASSWORD || (process.env.VERCEL ? '' : 'convite');
}

// chave para assinar as sessões: SESSION_SECRET, se existir; senão, derivada da senha principal
function signingKey() {
  const s = process.env.SESSION_SECRET || masterPassword();
  return s ? crypto.createHash('sha256').update('ci-sessao-v2:' + s).digest() : null;
}

function sha(s) { return crypto.createHash('sha256').update(String(s)).digest(); }
function same(a, b) { return crypto.timingSafeEqual(sha(a), sha(b)); }

// ---------- senhas ----------
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return { salt, hash };
}

export function checkHash(pw, salt, hash) {
  if (!salt || !hash) return false;
  const h = crypto.scryptSync(String(pw), salt, 64);
  const ref = Buffer.from(hash, 'hex');
  return ref.length === h.length && crypto.timingSafeEqual(h, ref);
}

// ---------- usuários ----------
export function masterUser() {
  return {
    id: MASTER_ID, username: 'admin', name: 'Administrador principal', email: '', phone: '',
    role: 'admin', active: true, master: true,
    ver: crypto.createHash('sha256').update('mestre:' + masterPassword()).digest('hex').slice(0, 12)
  };
}

// dados que podem sair do servidor (sem hash de senha)
export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, username: u.username, email: u.email || '', phone: u.phone || '',
    role: roleOf(u), active: u.active !== false, master: !!u.master, hasPassword: !!(u.master || u.pwHash),
    accessUntil: u.accessKey && u.accessExp && Date.parse(u.accessExp) > Date.now() ? u.accessExp : null,
    createdAt: u.createdAt || null, updatedAt: u.updatedAt || null, lastLogin: u.lastLogin || null
  };
}

export const roleOf = (u) => (u && (u.role === 'admin' || u.role === 'cliente') ? u.role : 'user');
export const isAdminUser = (u) => !!u && u.role === 'admin';
export const isClientUser = (u) => !!u && u.role === 'cliente';

// ---------- regras de senha ----------
const COMMON = ['12345678', '123456789', '1234567890', 'senha123', 'senha1234', 'password', 'password1', 'qwerty123', '11111111', 'abc12345', 'convite123', 'mudar123', 'admin123', 'brasil123'];
export function checkPasswordRules(pw, username, email) {
  pw = String(pw || '');
  if (pw.length < 8) throw httpError(400, 'A senha precisa ter pelo menos 8 caracteres.');
  if (pw.length > 200) throw httpError(400, 'Senha longa demais.');
  const low = pw.toLowerCase();
  if (/^(.)\1+$/.test(pw) || low === String(username || '').toLowerCase() || (email && low === String(email).toLowerCase()) || COMMON.includes(low)) {
    throw httpError(400, 'Senha fácil demais de adivinhar. Use uma combinação diferente de letras e números.');
  }
}

// ---------- links de acesso (cliente cria a própria senha) ----------
// O link leva um código aleatório; no banco fica só o hash dele (hash "access"), com validade de 7 dias.
// Vale uma vez: ao criar a senha, o código é apagado. Gerar um link novo invalida o anterior.
const ACCESS_DAYS = 7;
const tokenKey = (t) => crypto.createHash('sha256').update('ci-acesso:' + String(t)).digest('hex');

export async function createAccessToken(user, by) {
  const token = crypto.randomBytes(24).toString('base64url');
  const key = tokenKey(token);
  if (user.accessKey) await hdel('access', user.accessKey).catch(() => {});
  const exp = new Date(Date.now() + ACCESS_DAYS * 86400000).toISOString();
  await hset('access', key, { userId: user.id, exp, by: by || null, createdAt: new Date().toISOString() });
  await hset('users', user.id, Object.assign({}, user, { accessKey: key, accessExp: exp }));
  return { token, exp };
}

// usuário dono do código (ou null se o código não existe, venceu ou o usuário foi inativado)
export async function readAccessToken(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 80) return null;
  const key = tokenKey(token);
  const rec = await hget('access', key);
  if (!rec) return null;
  if (Date.parse(rec.exp) < Date.now()) { await hdel('access', key).catch(() => {}); return null; }
  const u = await hget('users', rec.userId);
  if (!u || u.active === false || u.accessKey !== key) return null;
  return { user: u, key };
}

export async function dropAccessToken(key) {
  await hdel('access', key).catch(() => {});
}

// ---------- sessão ----------
function sign(payload) {
  const key = signingKey();
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', key).update(body).digest('base64url');
  return body + '.' + mac;
}

function verify(token) {
  const key = signingKey();
  if (!key || !token || token.indexOf('.') < 0) return null;
  const [body, mac] = token.split('.');
  const good = crypto.createHmac('sha256', key).update(body).digest('base64url');
  if (!same(mac, good)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Usuário da sessão (ou null). Guarda o resultado na própria requisição.
export async function currentUser(req) {
  if (req.__user !== undefined) return req.__user;
  let user = null;
  const p = verify(cookies(req)[COOKIE]);
  // sessão vale 30 dias a partir do login (conferido aqui, não só pelo navegador)
  if (p && p.t && Date.now() - p.t > DAYS * 86400000) return (req.__user = null);
  if (p && p.u) {
    if (p.u === MASTER_ID) {
      const m = masterUser();
      if (masterPassword() && p.v === m.ver) user = m;
    } else {
      const u = await hget('users', p.u);
      if (u && u.active !== false && p.v === u.ver) user = u;
    }
  }
  req.__user = user;
  return user;
}

export async function requireUser(req) {
  const u = await currentUser(req);
  if (!u) throw httpError(401, 'Entre com seu usuário e senha.');
  return u;
}

export async function requireAdmin(req) {
  const u = await requireUser(req);
  if (!isAdminUser(u)) throw httpError(403, 'Só administradores podem fazer isso.');
  return u;
}

// convite (ou tema) pertence ao usuário? Itens antigos, sem dono, são da conta principal.
export const ownerOf = (item) => (item && item.ownerId) || MASTER_ID;
export const canManage = (user, item) => !!user && !!item && (isAdminUser(user) || ownerOf(item) === user.id);

export function sessionCookie(req, user) {
  const https = String(req.headers['x-forwarded-proto'] || '').includes('https') || !!process.env.VERCEL;
  const token = sign({ u: user.id, v: user.ver, t: Date.now() });
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${https ? '; Secure' : ''}`;
}

export function logoutCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function checkMasterPassword(pw) {
  const s = masterPassword();
  return !!s && typeof pw === 'string' && same(pw, s);
}

export function newVersion() {
  return crypto.randomBytes(6).toString('hex');
}
