// Armazenamento: Redis no Vercel (Upstash por REST ou qualquer Redis por REDIS_URL);
// arquivo JSON local quando nada está configurado (desenvolvimento e testes).
import fs from 'node:fs';
import path from 'node:path';
import { Redis } from '@upstash/redis';
import { httpError } from './http.js';
import { redisRest, redisUrl, relatedNames } from './env.js';

const rest = redisRest();
const tcp = rest ? null : redisUrl();
const upstash = rest ? new Redis({ url: rest.url, token: rest.token }) : null;

export const storageMode = upstash ? 'redis' : (tcp ? 'redis-url' : (process.env.VERCEL ? 'missing' : 'local'));

// ---------- Redis por URL (cliente TCP, reaproveitado entre execuções) ----------
let tcpClient = null;
async function client() {
  if (tcpClient && tcpClient.isReady) return tcpClient;
  if (!tcpClient) {
    const { createClient } = await import('redis');
    tcpClient = createClient({ url: tcp.url, socket: { connectTimeout: 8000, reconnectStrategy: (n) => (n > 3 ? false : 300) } });
    tcpClient.on('error', () => {});
  }
  if (!tcpClient.isOpen) await tcpClient.connect();
  return tcpClient;
}

// ---------- local ----------
const FILE = process.env.LOCAL_DB_FILE || path.join(process.cwd(), '.data', 'db.json');
let mem = null;
function load() {
  if (mem) return mem;
  try { mem = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { mem = {}; }
  return mem;
}
function persist() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(mem));
}

function ensureConfigured() {
  if (storageMode === 'missing') {
    const names = relatedNames();
    throw httpError(503, 'Banco de dados não configurado. No Vercel, conecte um banco Redis (Storage › Upstash Redis) ao projeto e faça um novo deploy.' +
      (names.length ? ' Variáveis encontradas: ' + names.join(', ') + '.' : ' Nenhuma variável de banco foi encontrada neste deploy.'));
  }
}

function parse(v) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (e) { return v; }
}

function wrap(e) {
  if (e && e.status) return e;
  console.error(e);
  return httpError(503, 'Não foi possível acessar o banco de dados. Confira se ele está ativo e conectado ao projeto no Vercel.');
}

export async function hget(key, field) {
  ensureConfigured();
  try {
    if (upstash) return parse(await upstash.hget(key, field)) ?? null;
    if (tcp) { const v = await (await client()).hGet(key, field); return v == null ? null : parse(v); }
  } catch (e) { throw wrap(e); }
  const h = load()[key] || {};
  return field in h ? JSON.parse(h[field]) : null;
}

export async function hset(key, field, value) {
  ensureConfigured();
  const json = JSON.stringify(value);
  try {
    if (upstash) { await upstash.hset(key, { [field]: json }); return; }
    if (tcp) { await (await client()).hSet(key, field, json); return; }
  } catch (e) { throw wrap(e); }
  const m = load();
  m[key] = m[key] || {};
  m[key][field] = json;
  persist();
}

export async function hdel(key, field) {
  ensureConfigured();
  try {
    if (upstash) { await upstash.hdel(key, field); return; }
    if (tcp) { await (await client()).hDel(key, field); return; }
  } catch (e) { throw wrap(e); }
  const m = load();
  if (m[key]) { delete m[key][field]; persist(); }
}

export async function hgetall(key) {
  ensureConfigured();
  let all = null;
  try {
    if (upstash) all = (await upstash.hgetall(key)) || {};
    else if (tcp) all = (await (await client()).hGetAll(key)) || {};
  } catch (e) { throw wrap(e); }
  if (all) {
    const out = {};
    for (const k in all) out[k] = parse(all[k]);
    return out;
  }
  const h = load()[key] || {};
  const out = {};
  for (const k in h) out[k] = JSON.parse(h[k]);
  return out;
}

// quantos campos o hash tem (1 comando, sem ler o conteúdo)
export async function hlen(key) {
  ensureConfigured();
  try {
    if (upstash) return Number(await upstash.hlen(key)) || 0;
    if (tcp) return Number(await (await client()).hLen(key)) || 0;
  } catch (e) { throw wrap(e); }
  return Object.keys(load()[key] || {}).length;
}

export async function del(key) {
  ensureConfigured();
  try {
    if (upstash) { await upstash.del(key); return; }
    if (tcp) { await (await client()).del(key); return; }
  } catch (e) { throw wrap(e); }
  const m = load();
  delete m[key];
  persist();
}
