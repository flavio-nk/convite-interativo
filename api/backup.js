// Cópias de segurança do banco de dados.
// - Todo dia (agendamento do Vercel em vercel.json) e quando um administrador pedir, o conteúdo do banco
//   (usuários, convites, convidados, respostas, temas) vira um arquivo JSON guardado no Vercel Blob
//   (privado, pasta backups/). Ficam os últimos 30. Localmente, em .data/backups.
// - Administradores listam, baixam e restauram as cópias. Antes de restaurar, o estado atual é salvo.
import fs from 'node:fs';
import path from 'node:path';
import { put, list, del as blobDel, get as blobGet } from '@vercel/blob';
import { handler, query, readBody, send, httpError } from './_lib/http.js';
import { requireAdmin } from './_lib/auth.js';
import { hget, hset, hgetall, del, storageMode } from './_lib/store.js';
import { uploadsMode, blobAuth } from './upload.js';

const KEEP = 30;
const PREFIX = 'backups/';
const DIR = path.join(process.cwd(), '.data', 'backups');
const FIXED = ['users', 'invites', 'themes', 'deleted', 'slugs', 'pedidos'];
const NAME = /^convite-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z(-[a-z-]+)?\.json$/;

const blobMode = () => uploadsMode() === 'blob' || uploadsMode() === 'blob-oidc';
const credentials = (req) => {
  const a = blobAuth(req);
  if (!a) throw httpError(503, 'Armazenamento de arquivos não configurado para guardar as cópias.');
  return a;
};

// ---------- conteúdo do banco ----------
async function snapshot() {
  const data = {};
  for (const k of FIXED) data[k] = await hgetall(k);
  for (const id of Object.keys(data.invites || {})) {
    for (const k of ['rsvps:' + id, 'guests:' + id]) {
      const h = await hgetall(k);
      if (Object.keys(h).length) data[k] = h;
    }
  }
  const count = (k) => Object.keys(data[k] || {}).length;
  return {
    app: 'convite-interativo', version: 1, createdAt: new Date().toISOString(),
    summary: {
      users: count('users'), invites: count('invites'), themes: count('themes'), pedidos: count('pedidos'),
      guests: Object.keys(data).filter((k) => k.startsWith('guests:')).reduce((s, k) => s + count(k), 0),
      rsvps: Object.keys(data).filter((k) => k.startsWith('rsvps:')).reduce((s, k) => s + count(k), 0)
    },
    data
  };
}

function validBackup(b) {
  if (!b || b.app !== 'convite-interativo' || !b.data || typeof b.data !== 'object') throw httpError(400, 'Este arquivo não é uma cópia de segurança dos convites.');
  for (const k of Object.keys(b.data)) {
    if (!FIXED.includes(k) && !/^(rsvps|guests):[A-Za-z0-9_-]{1,64}$/.test(k)) throw httpError(400, 'Cópia de segurança com conteúdo inesperado.');
    if (!b.data[k] || typeof b.data[k] !== 'object' || Array.isArray(b.data[k])) throw httpError(400, 'Cópia de segurança corrompida.');
  }
  return b;
}

async function restore(b) {
  // apaga o que existe hoje e grava o conteúdo da cópia
  const cur = await hgetall('invites');
  const keys = new Set(FIXED);
  for (const id of Object.keys(cur)) { keys.add('rsvps:' + id); keys.add('guests:' + id); }
  for (const k of keys) await del(k);
  await del('stats'); // resumos de respostas são refeitos sob demanda
  for (const [k, h] of Object.entries(b.data)) {
    for (const [f, v] of Object.entries(h)) await hset(k, f, v);
  }
}

// ---------- arquivos ----------
const stamp = (suffix) => 'convite-backup-' + new Date().toISOString().replace(/\.\d+Z$/, 'Z').replace(/:/g, '-') + (suffix ? '-' + suffix : '') + '.json';

async function save(req, b, suffix) {
  const name = stamp(suffix);
  const body = JSON.stringify(b);
  if (blobMode()) {
    await put(PREFIX + name, body, Object.assign({ access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true }, credentials(req)));
  } else {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(path.join(DIR, name), body);
  }
  await prune(req);
  await hset('meta', 'lastBackup', { name, at: b.createdAt, summary: b.summary });
  return { name, size: Buffer.byteLength(body), createdAt: b.createdAt, summary: b.summary };
}

async function listFiles(req) {
  if (blobMode()) {
    const r = await list(Object.assign({ prefix: PREFIX, limit: 1000 }, credentials(req)));
    return r.blobs.map((x) => ({ name: x.pathname.slice(PREFIX.length), size: x.size, createdAt: new Date(x.uploadedAt).toISOString(), url: x.url }))
      .filter((x) => NAME.test(x.name)).sort((a, b) => b.name.localeCompare(a.name));
  }
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((n) => NAME.test(n)).map((n) => {
    const st = fs.statSync(path.join(DIR, n));
    return { name: n, size: st.size, createdAt: st.mtime.toISOString() };
  }).sort((a, b) => b.name.localeCompare(a.name));
}

async function prune(req) {
  const files = await listFiles(req);
  const old = files.slice(KEEP);
  for (const f of old) {
    if (blobMode()) await blobDel(f.url, credentials(req));
    else fs.unlinkSync(path.join(DIR, f.name));
  }
}

async function readFile(req, name) {
  if (!NAME.test(name || '')) throw httpError(400, 'Cópia de segurança inválida.');
  if (blobMode()) {
    const r = await blobGet(PREFIX + name, Object.assign({ access: 'private', useCache: false }, credentials(req)));
    if (!r || !r.stream) throw httpError(404, 'Cópia de segurança não encontrada.');
    const chunks = [];
    for await (const c of r.stream) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks).toString('utf8');
  }
  const p = path.join(DIR, name);
  if (!fs.existsSync(p)) throw httpError(404, 'Cópia de segurança não encontrada.');
  return fs.readFileSync(p, 'utf8');
}

export default handler(async (req, res) => {
  const q = query(req);
  const action = q.get('action') || '';

  // Agendamento diário do Vercel. Com CRON_SECRET definido, exige o segredo; sem ele, no máximo uma cópia a cada 20 h.
  if (action === 'cron') {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== 'Bearer ' + secret) throw httpError(401, 'Não autorizado.');
    const last = await hget('meta', 'lastBackup');
    if (!secret && last && Date.now() - new Date(last.at).getTime() < 20 * 3600 * 1000) return send(res, 200, { skipped: true, last: last.name });
    const r = await save(req, await snapshot(), 'auto');
    return send(res, 200, { ok: true, name: r.name, summary: r.summary });
  }

  await requireAdmin(req);

  if (req.method === 'GET' && action === 'download') {
    const name = q.get('name');
    const body = await readFile(req, name);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + name + '"');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(body);
  }

  if (req.method === 'GET') {
    const files = await listFiles(req);
    const last = await hget('meta', 'lastBackup');
    return send(res, 200, { files: files.map(({ url, ...f }) => f), last, storage: storageMode, keep: KEEP });
  }

  if (req.method === 'POST' && action === 'run') {
    const r = await save(req, await snapshot(), 'manual');
    return send(res, 201, r);
  }

  if (req.method === 'POST' && action === 'restore') {
    const body = await readBody(req);
    let b;
    if (body.name) b = validBackup(JSON.parse(await readFile(req, String(body.name))));
    else b = validBackup(body.backup);
    // guarda o estado atual antes de substituir
    const safety = await save(req, await snapshot(), 'antes-de-restaurar');
    await restore(b);
    return send(res, 200, { ok: true, restored: b.summary, from: b.createdAt, safety: safety.name });
  }

  throw httpError(405, 'Método não permitido.');
});
