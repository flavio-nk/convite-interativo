// Resumo das respostas de cada convite (para os cartões de "Meus convites").
// Guardado no hash "stats" (convite → resumo) e refeito sempre que uma resposta ou
// um convite individual muda: a lista de convites lê um único hash em vez de 1 + N.
import { hgetall, hset, hdel } from './store.js';

export async function computeStats(inviteId) {
  const rsvps = Object.values(await hgetall('rsvps:' + inviteId));
  const guests = Object.values(await hgetall('guests:' + inviteId));
  let yes = 0, no = 0, people = 0;
  const answered = new Set();
  for (const r of rsvps) {
    if (!r) continue;
    if (r.guestId) answered.add(r.guestId);
    if (r.go) {
      yes++;
      people += Array.isArray(r.names) && r.guestId ? r.names.length : 1 + (Number(r.guests) || 0);
    } else no++;
  }
  const out = {
    yes, no, people,
    invited: guests.length,
    pending: guests.length ? guests.filter((g) => !answered.has(g.id)).length : null,
    at: new Date().toISOString()
  };
  await hset('stats', inviteId, out);
  return out;
}

export async function dropStats(inviteId) {
  await hdel('stats', inviteId);
}

// Resumo de vários convites; calcula na hora (e guarda) os que ainda não têm.
export async function statsFor(ids) {
  const all = await hgetall('stats');
  for (const id of ids) {
    if (!all[id]) {
      try { all[id] = await computeStats(id); } catch (e) { all[id] = null; }
    }
  }
  return all;
}
