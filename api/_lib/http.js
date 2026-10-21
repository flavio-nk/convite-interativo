// Utilitários HTTP independentes do ambiente (Vercel ou servidor local).

export function query(req) {
  return new URL(req.url, 'http://localhost').searchParams;
}

// Sempre devolve um objeto simples: corpo vazio vira {}; lista, número, texto ou null são recusados.
function asObject(v) {
  if (v === undefined || v === null || v === '') return {};
  if (typeof v !== 'object' || Array.isArray(v)) throw httpError(400, 'Conteúdo inválido.');
  return v;
}

export async function readBody(req) {
  return asObject(await readRaw(req));
}

async function readRaw(req) {
  // No Vercel, req.body já vem interpretado; localmente lemos o fluxo.
  if (req.body !== undefined && req.body !== null && !Buffer.isBuffer(req.body)) {
    if (typeof req.body === 'string') {
      if (!req.body) return {};
      try { return JSON.parse(req.body); } catch (e) { throw httpError(400, 'JSON inválido.'); }
    }
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 2_000_000) throw httpError(413, 'Conteúdo grande demais.');
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { throw httpError(400, 'JSON inválido.'); }
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const k in headers) res.setHeader(k, headers[k]);
  res.end(JSON.stringify(data));
}

export function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      const isBlob = e && /^Blob/.test((e.constructor && e.constructor.name) || '');
      const status = e.status || (isBlob ? 502 : 500);
      if (status >= 500) console.error(e);
      const msg = e.status ? e.message : (isBlob ? 'Falha no armazenamento de arquivos: ' + e.message : 'Erro interno no servidor.');
      if (!res.headersSent) send(res, status, { error: msg });
    }
  };
}

export function newId(len = 10) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  for (const b of bytes) s += chars[b % chars.length];
  return s;
}
