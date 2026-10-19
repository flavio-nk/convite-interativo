// Acesso do organizador: uma senha (variável ADMIN_PASSWORD no Vercel) e um cookie assinado.
import crypto from 'node:crypto';
import { httpError } from './http.js';

const COOKIE = 'ci_admin';
const DAYS = 30;

export function passwordConfigured() {
  return !!process.env.ADMIN_PASSWORD || !process.env.VERCEL;
}

function secret() {
  // Fora do Vercel (desenvolvimento local), a senha padrão é "convite".
  return process.env.ADMIN_PASSWORD || (process.env.VERCEL ? '' : 'convite');
}

function tokenFor(pw) {
  return crypto.createHmac('sha256', pw).update('organizador-v1').digest('hex');
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function same(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

export function isAdmin(req) {
  const s = secret();
  if (!s) return false;
  const c = cookies(req)[COOKIE];
  return !!c && same(c, tokenFor(s));
}

export function requireAdmin(req) {
  if (!isAdmin(req)) throw httpError(401, 'Entre com a senha do organizador.');
}

export function checkPassword(pw) {
  const s = secret();
  if (!s) throw httpError(503, 'Senha do organizador não configurada. No Vercel, crie a variável ADMIN_PASSWORD.');
  return typeof pw === 'string' && same(pw, s);
}

export function loginCookie(req) {
  const https = String(req.headers['x-forwarded-proto'] || '').includes('https') || !!process.env.VERCEL;
  return `${COOKIE}=${tokenFor(secret())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${https ? '; Secure' : ''}`;
}

export function logoutCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
