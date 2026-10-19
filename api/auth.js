import { handler, query, readBody, send, httpError } from './_lib/http.js';
import { isAdmin, checkPassword, loginCookie, logoutCookie, passwordConfigured } from './_lib/auth.js';
import { storageMode } from './_lib/store.js';

const uploadsMode = () => (process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : (process.env.VERCEL ? 'missing' : 'local'));

export default handler(async (req, res) => {
  const action = query(req).get('action') || 'me';
  if (action === 'me') {
    return send(res, 200, {
      admin: isAdmin(req),
      passwordConfigured: passwordConfigured(),
      storage: storageMode,
      uploads: uploadsMode()
    });
  }
  if (req.method !== 'POST') throw httpError(405, 'Método não permitido.');
  if (action === 'login') {
    const { password } = await readBody(req);
    if (!checkPassword(password)) {
      await new Promise((r) => setTimeout(r, 400));
      throw httpError(401, 'Senha incorreta.');
    }
    return send(res, 200, { admin: true }, { 'Set-Cookie': loginCookie(req) });
  }
  if (action === 'logout') {
    return send(res, 200, { admin: false }, { 'Set-Cookie': logoutCookie() });
  }
  throw httpError(404, 'Ação desconhecida.');
});
