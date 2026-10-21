import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import { requireAdmin } from './_lib/auth.js';
import { hget, hset, hdel, hgetall } from './_lib/store.js';

const KEY = 'themes';

export default handler(async (req, res) => {
  requireAdmin(req);
  const id = query(req).get('id');

  if (req.method === 'GET') {
    if (id) {
      const t = await hget(KEY, id);
      if (!t) throw httpError(404, 'Tema não encontrado.');
      return send(res, 200, t);
    }
    const list = Object.values(await hgetall(KEY));
    list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return send(res, 200, list);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    if (JSON.stringify(body).length > 50_000) throw httpError(413, 'Tema grande demais.');
    if (!body.bg || !body.fg || !body.accent) throw httpError(400, 'Tema incompleto: faltam as cores.');
    const tid = body.id && (await hget(KEY, body.id)) ? body.id : newId();
    const now = new Date().toISOString();
    const prev = await hget(KEY, tid);
    const theme = Object.assign({}, body, {
      id: tid,
      name: String(body.name || 'Meu tema').slice(0, 80),
      createdAt: (prev && prev.createdAt) || now,
      updatedAt: now
    });
    await hset(KEY, tid, theme);
    return send(res, 200, theme);
  }

  if (req.method === 'DELETE') {
    if (!id) throw httpError(400, 'Informe o tema.');
    await hdel(KEY, id);
    return send(res, 200, { deleted: id });
  }

  throw httpError(405, 'Método não permitido.');
});
