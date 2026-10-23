// Envio de fotos, vídeos e músicas.
// Produção (Vercel Blob), envio direto do navegador para o Blob, em um destes modos:
//   - token de leitura e escrita (BLOB_READ_WRITE_TOKEN)
//   - identidade do deploy (OIDC) + BLOB_STORE_ID, padrão dos Blobs criados recentemente
// Arquivos de um Blob privado são entregues por /api/upload?media=<url>, que redireciona
// para um link assinado temporário.
// Local: o arquivo é enviado para cá e guardado em .data/uploads.
import fs from 'node:fs';
import path from 'node:path';
import { handleUpload, handleUploadPresigned } from '@vercel/blob/client';
import { issueSignedToken, presignUrl } from '@vercel/blob';
import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import { currentUser, requireUser } from './_lib/auth.js';
import { blobToken, blobStoreId, relatedNames } from './_lib/env.js';

const DIR = path.join(process.cwd(), '.data', 'uploads');
const MAX = 100 * 1024 * 1024;
// SVG fica de fora: pode conter scripts
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif', 'video/*', 'audio/*'];

function blobAuth(req) {
  const token = blobToken();
  if (token) return { token };
  const storeId = blobStoreId();
  const oidcToken = req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN || undefined;
  if (!storeId) return null;
  if (!oidcToken) {
    throw httpError(503, 'O Blob está conectado, mas este deploy não recebeu a credencial do Vercel. No Vercel, abra Settings › Security e ative "Secure Backend Access with OIDC Federation" e faça um novo deploy. Outra opção: em Storage › Blob, gere um token de leitura e escrita e salve-o na variável BLOB_READ_WRITE_TOKEN.');
  }
  return { storeId, oidcToken };
}

export function uploadsMode() {
  if (blobToken()) return 'blob';
  if (blobStoreId()) return 'blob-oidc';
  return process.env.VERCEL ? 'missing' : 'local';
}

export default handler(async (req, res) => {
  const q = query(req);
  const mode = uploadsMode();

  // Entrega de arquivo de Blob privado
  if (req.method === 'GET' && q.get('media')) {
    const auth = blobAuth(req);
    if (!auth) throw httpError(404, 'Arquivo não encontrado.');
    let u;
    try { u = new URL(q.get('media')); } catch (e) { throw httpError(400, 'Endereço inválido.'); }
    if (!/\.blob\.vercel-storage\.com$/.test(u.hostname)) throw httpError(400, 'Endereço inválido.');
    const pathname = decodeURIComponent(u.pathname.replace(/^\//, ''));
    // só arquivos enviados pelos convites
    if (!/^convites\//.test(pathname) || pathname.includes('..')) throw httpError(404, 'Arquivo não encontrado.');
    const signed = await issueSignedToken(Object.assign({ pathname, operations: ['get'] }, auth));
    const { presignedUrl } = await presignUrl(signed, { operation: 'get', pathname, access: 'private' });
    res.statusCode = 302;
    res.setHeader('Location', presignedUrl);
    res.setHeader('Cache-Control', 'private, max-age=600');
    return res.end();
  }

  if (mode === 'blob' || mode === 'blob-oidc') {
    if (req.method !== 'POST') throw httpError(405, 'Método não permitido.');
    const body = await readBody(req);
    if (body && body.type === 'blob.generate-presigned-url') {
      const auth = blobAuth(req);
      const result = await handleUploadPresigned({
        body,
        request: req,
        // só seria usado para conferir avisos de "envio concluído", que não usamos
        webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY || 'nao-utilizado',
        getSignedToken: async (pathname) => {
          if (!(await currentUser(req))) throw httpError(401, 'Entre com seu usuário e senha.');
          const token = await issueSignedToken(Object.assign({ pathname, operations: ['put'], allowedContentTypes: TYPES, maximumSizeInBytes: MAX }, auth));
          return { token, urlOptions: { allowedContentTypes: TYPES, maximumSizeInBytes: MAX, addRandomSuffix: true } };
        }
      });
      return send(res, 200, result);
    }
    if (mode !== 'blob') throw httpError(400, 'Modo de envio não suportado por este armazenamento.');
    const result = await handleUpload({
      token: blobToken(),
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        if (!(await currentUser(req))) throw httpError(401, 'Entre com seu usuário e senha.');
        return { allowedContentTypes: TYPES, maximumSizeInBytes: MAX, addRandomSuffix: true };
      }
    });
    return send(res, 200, result);
  }

  if (mode === 'missing') {
    const names = relatedNames();
    throw httpError(503, 'Armazenamento de arquivos não configurado. No Vercel, conecte um Blob (Storage › Blob) ao projeto e faça um novo deploy.' + (names.length ? ' Variáveis encontradas: ' + names.join(', ') + '.' : ' Nenhuma variável de Blob foi encontrada neste deploy.'));
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
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    fs.createReadStream(path.join(DIR, file)).pipe(res);
    return;
  }
  if (req.method !== 'POST') throw httpError(405, 'Método não permitido.');
  await requireUser(req);
  const type = String(req.headers['content-type'] || 'application/octet-stream');
  if (!/^(image|video|audio)\//.test(type) || /svg/i.test(type)) throw httpError(415, 'Envie uma imagem (JPG, PNG, WebP, GIF), um vídeo ou um áudio.');
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
