// Armazenamento: Redis (Upstash, criado pelo painel do Vercel) em produção;
// arquivo JSON local quando não há Redis configurado (desenvolvimento e testes).
import fs from 'node:fs';
import path from 'node:path';
import { Redis } from '@upstash/redis';
import { httpError } from './http.js';

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export const storageMode = redis ? 'redis' : (process.env.VERCEL ? 'missing' : 'local');

const FILE = process.env.LOCAL_DB_FILE || path.join(process.cwd(), '.data', 'db.json');
let mem = null;

function ensureConfigured() {
  if (storageMode === 'missing') {
    throw httpError(503, 'Banco de dados não configurado. No Vercel, crie um banco Upstash Redis em Storage e conecte ao projeto.');
  }
}

function load() {
  if (mem) return mem;
  try { mem = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { mem = {}; }
  return mem;
}

function persist() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(mem));
}

function parse(v) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (e) { return v; }
}

export async function hget(key, field) {
  ensureConfigured();
  if (redis) return parse(await redis.hget(key, field)) ?? null;
  const h = load()[key] || {};
  return field in h ? JSON.parse(h[field]) : null;
}

export async function hset(key, field, value) {
  ensureConfigured();
  const json = JSON.stringify(value);
  if (redis) { await redis.hset(key, { [field]: json }); return; }
  const m = load();
  m[key] = m[key] || {};
  m[key][field] = json;
  persist();
}

export async function hdel(key, field) {
  ensureConfigured();
  if (redis) { await redis.hdel(key, field); return; }
  const m = load();
  if (m[key]) { delete m[key][field]; persist(); }
}

export async function hgetall(key) {
  ensureConfigured();
  if (redis) {
    const all = (await redis.hgetall(key)) || {};
    const out = {};
    for (const k in all) out[k] = parse(all[k]);
    return out;
  }
  const h = load()[key] || {};
  const out = {};
  for (const k in h) out[k] = JSON.parse(h[k]);
  return out;
}

export async function del(key) {
  ensureConfigured();
  if (redis) { await redis.del(key); return; }
  const m = load();
  delete m[key];
  persist();
}
