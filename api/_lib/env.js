// Descobre as variáveis do banco e do armazenamento, aceitando os prefixos
// que o Vercel pode adicionar ao conectar (ex.: STORAGE_KV_REST_API_URL).

function find(test) {
  for (const k of Object.keys(process.env)) {
    if (test(k) && process.env[k]) return { name: k, value: process.env[k] };
  }
  return null;
}

export function redisRest() {
  const url = find((k) => k === 'UPSTASH_REDIS_REST_URL' || k === 'KV_REST_API_URL') ||
    find((k) => /(^|_)(UPSTASH_REDIS_REST_URL|KV_REST_API_URL|REDIS_REST_API_URL|REST_API_URL)$/.test(k));
  if (!url) return null;
  const prefix = url.name.replace(/(UPSTASH_REDIS_REST_URL|KV_REST_API_URL|REDIS_REST_API_URL|REST_API_URL)$/, '');
  const token = find((k) => k === prefix + 'KV_REST_API_TOKEN' || k === prefix + 'UPSTASH_REDIS_REST_TOKEN' || k === prefix + 'REDIS_REST_API_TOKEN' || k === prefix + 'REST_API_TOKEN') ||
    find((k) => /(^|_)(UPSTASH_REDIS_REST_TOKEN|KV_REST_API_TOKEN|REDIS_REST_API_TOKEN|REST_API_TOKEN)$/.test(k) && !/READ_ONLY/.test(k));
  return token ? { url: url.value, token: token.value, names: [url.name, token.name] } : null;
}

export function redisUrl() {
  const v = find((k) => k === 'REDIS_URL' || k === 'KV_URL') ||
    find((k) => /(^|_)(REDIS_URL|KV_URL)$/.test(k) && /^rediss?:\/\//.test(process.env[k] || ''));
  return v && /^rediss?:\/\//.test(v.value) ? { url: v.value, names: [v.name] } : null;
}

export function blobToken() {
  const v = find((k) => k === 'BLOB_READ_WRITE_TOKEN') ||
    find((k) => /READ_WRITE_TOKEN$/.test(k) && /^vercel_blob_rw_/.test(process.env[k] || ''));
  return v ? v.value : null;
}

// Só nomes (nunca valores), para ajudar a diagnosticar a configuração.
export function relatedNames() {
  return Object.keys(process.env).filter((k) => /KV|REDIS|UPSTASH|BLOB|STORAGE/.test(k)).sort();
}
