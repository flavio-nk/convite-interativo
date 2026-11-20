// Envio de fotos pelo formulário público de pedido: quem ainda não tem conta recebe um código
// que libera poucas fotos (só imagens) por algumas horas. No banco fica só o hash do código.
import crypto from 'node:crypto';
import { hget, hset, hdel, hgetall } from './store.js';

const KEY = 'pedido-up';
const HOURS = 12;
export const MAX_ORDER_FILES = 25;
const hash = (k) => crypto.createHash('sha256').update('ci-pedido:' + String(k)).digest('hex');

export async function createUploadKey() {
  const key = crypto.randomBytes(18).toString('base64url');
  const exp = Date.now() + HOURS * 3600000;
  await hset(KEY, hash(key), { exp, count: 0 });
  // de vez em quando, apaga códigos vencidos
  if (Math.random() < 0.05) {
    const all = await hgetall(KEY);
    for (const [k, v] of Object.entries(all)) if (!v || v.exp < Date.now()) await hdel(KEY, k);
  }
  return { key, exp };
}

// confere o código e conta mais um arquivo; devolve false se não vale (ou acabou a cota)
export async function useUploadKey(key) {
  if (typeof key !== 'string' || key.length < 16 || key.length > 64) return false;
  const h = hash(key);
  const rec = await hget(KEY, h);
  if (!rec || rec.exp < Date.now() || rec.count >= MAX_ORDER_FILES) return false;
  await hset(KEY, h, { exp: rec.exp, count: rec.count + 1 });
  return true;
}
