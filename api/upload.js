// Envio de fotos, vídeos e músicas.
// Produção: Vercel Blob com envio direto do navegador (aceita arquivos grandes).
// Local: o arquivo é enviado para cá e guardado em .data/uploads.
import fs from 'node:fs';
import path from 'node:path';
import { handleUpload } from '@vercel/blob/client';
import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import { isAdmin, requireAdmin } from './_lib/auth.js';
import { blobToken, relatedNames } from './_lib/env.js';

const DIR = path.join(process.cwd(), '.data', 'uploads');
const MAX = 100 * 1024 * 1024;
const TYPES = ['image/*', 'video/*', 'audio/*'];

export default handler(async (req, res) => {
  const q = query(req);

  const token = blobToken();
  if (token) {
    if (req.method !== 'POST') throw httpError(405, 'Método não permitido.');
    const body = await readBody(req);
    const result = await handleUpload({
      token,
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        if (!isAdmin(req)) throw httpError(401, 'Entre com a senha do organizador.');
        return { allowedContentTypes: TYPES, maximumSizeInBytes: MAX, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {}
    });
    return send(res, 200, result);
  }

  if (process.env.VERCEL) {
    const names = relatedNames();
    throw httpError(503, 'Armazenamento de arquivos não configurado. No Vercel, conecte um Blob (Storage › Blob) ao projeto e faça um novo deploy.' + (names.length ? ' Variáveis encontradas: ' + names.join(', ') + '.' : ''));
  }

  // modo local
  if (req.method === 'GET') {
    const file = path.basename(q.get('file') || '');
    const meta = path.join(DIR, file + '.json');
    if (!file || !fs.existsSync(meta)) throw httpError(404, 'Arquivo não encontrado.');
    const info = JSON.parse(fs.readFileSync(meta, 'utf8'));
    res.statusCode = 200;
    res.setHeader('Content-Type', info.type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    fs.createReadStream(path.join(DIR, file)).pipe(res);
    return;
  }
  if (req.method !== 'POST') throw httpError(405, 'Método não permitido.');
  requireAdmin(req);
  const type = String(req.headers['content-type'] || 'application/octet-stream');
  if (!/^(image|video|audio)\//.test(type)) throw httpError(415, 'Envie uma imagem, um vídeo ou um áudio.');
  fs.mkdirSync(DIR, { recursive: true });
  const id = newId(16);
  const out = fs.createWriteStream(path.join(DIR, id));
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX) { out.destroy(); throw httpError(413, 'Arquivo maior que 100 MB.'); }
    out.write(chunk);
  }
  await new Promise((r) => out.end(r));
  fs.writeFileSync(path.join(DIR, id + '.json'), JSON.stringify({ type, name: q.get('name') || '', size }));
  return send(res, 200, { url: '/api/upload?file=' + id });
});
