import { handler, query, readBody, send, httpError, newId } from './_lib/http.js';
import { requireUser, canManage, ownerOf, isAdminUser } from './_lib/auth.js';
import { validId } from './_lib/guard.js';

const MAX_THEMES_PER_USER = 100;
const HEX = /^#[0-9a-fA-F]{6}$/;
const COLORS = ['bg', 'fg', 'accent', 'btnFg', 'paper', 'ph'];
import { hget, hset, hdel, hgetall } from './_lib/store.js';

const KEY = 'themes';

export default handler(async (req, res) => {
  // todos os usuários veem todos os temas; editar e excluir só o dono do tema ou um administrador
  const user = await requireUser(req);
  const id = validId(query(req).get('id'), 'Tema');

  if (req.method === 'GET') {
    if (id) {
      const t = await hget(KEY, id);
      if (!t) throw httpError(404, 'Tema não encontrado.');
      return send(res, 200, Object.assign({}, t, { canEdit: canManage(user, t), mine: ownerOf(t) === user.id }));
    }
    const list = Object.values(await hgetall(KEY)).map((t) => Object.assign({}, t, { canEdit: canManage(user, t), mine: ownerOf(t) === user.id }));
    list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return send(res, 200, list);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    if (JSON.stringify(body).length > 50_000) throw httpError(413, 'Tema grande demais.');
    if (!body.bg || !body.fg || !body.accent) throw httpError(400, 'Tema incompleto: faltam as cores.');
    // cores só em #RRGGBB (o tema vai para dentro de estilos dos convites de todos)
    for (const c of COLORS) if (body[c] != null && !HEX.test(String(body[c]))) throw httpError(400, 'Cor inválida no tema.');
    const found = body.id ? await hget(KEY, validId(String(body.id), 'Tema')) : null;
    if (found && !canManage(user, found)) throw httpError(403, 'Este tema é de outro usuário. Salve uma cópia com outro nome.');
    if (!found && !isAdminUser(user)) {
      const mine = Object.values(await hgetall(KEY)).filter((t) => ownerOf(t) === user.id).length;
      if (mine >= MAX_THEMES_PER_USER) throw httpError(403, 'Limite de ' + MAX_THEMES_PER_USER + ' temas por usuário atingido.');
    }
    const tid = found ? body.id : newId();
    const now = new Date().toISOString();
    const prev = found;
    delete body.canEdit; delete body.mine;
    const theme = Object.assign({}, body, {
      id: tid,
      ownerId: prev ? prev.ownerId : user.id,
      name: String(body.name || 'Meu tema').slice(0, 80),
      createdAt: (prev && prev.createdAt) || now,
      updatedAt: now
    });
    await hset(KEY, tid, theme);
    return send(res, 200, theme);
  }

  if (req.method === 'DELETE') {
    if (!id) throw httpError(400, 'Informe o tema.');
    const t = await hget(KEY, id);
    if (t && !canManage(user, t)) throw httpError(403, 'Este tema é de outro usuário.');
    await hdel(KEY, id);
    return send(res, 200, { deleted: id });
  }

  throw httpError(405, 'Método não permitido.');
});
