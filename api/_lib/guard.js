// Proteções comuns da API: origem das requisições, limite de tentativas e validação de ids.
import { httpError } from './http.js';
export { checkOrigin } from './http.js';
import { hget, hset, hdel, hgetall } from './store.js';

// IP de quem chamou (no Vercel vem em x-forwarded-for / x-real-ip, definidos pela própria plataforma)
export function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || String(req.headers['x-real-ip'] || '') || (req.socket && req.socket.remoteAddress) || 'desconhecido';
}

// Identificadores aceitos nos endereços da API (evita valores estranhos virando chaves do banco)
export function validId(v, label) {
  if (v == null || v === '') return v;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(v))) throw httpError(400, (label || 'Identificador') + ' inválido.');
  return v;
}

const RL = 'ratelimit';

// Conta tentativas por chave dentro de uma janela de tempo. Passou do limite: 429.
export async function rateLimit(key, limit, windowSec, message) {
  const now = Date.now();
  const cur = await hget(RL, key);
  let entry = cur && cur.reset > now ? cur : { n: 0, reset: now + windowSec * 1000 };
  if (entry.n >= limit) {
    const min = Math.max(1, Math.ceil((entry.reset - now) / 60000));
    throw httpError(429, (message || 'Muitas tentativas.') + ' Tente de novo em ' + min + (min === 1 ? ' minuto.' : ' minutos.'));
  }
  entry = { n: entry.n + 1, reset: entry.reset };
  await hset(RL, key, entry);
  // limpeza ocasional das entradas vencidas
  if (Math.random() < 0.02) {
    try {
      const all = await hgetall(RL);
      for (const k of Object.keys(all)) if (!all[k] || all[k].reset < now) await hdel(RL, k);
    } catch (e) { /* sem problema */ }
  }
  return entry;
}

// Só consulta, sem contar (para bloquear login antes de testar a senha)
export async function isLimited(key, limit) {
  const cur = await hget(RL, key);
  return !!(cur && cur.reset > Date.now() && cur.n >= limit);
}

export async function clearLimit(key) {
  await hdel(RL, key);
}
