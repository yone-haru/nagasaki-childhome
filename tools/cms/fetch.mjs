// microCMS からサイトのデータを取ってくる（Node 22 標準の fetch のみ）。
// API キーは環境変数から読む。ログには出さない。

const TIMEOUT_MS = 15000;
const RETRIES = 2;

async function getJson(url, key) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1000 * attempt));
    try {
      const res = await fetch(url, { headers: { 'X-MICROCMS-API-KEY': key }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok) return await res.json();
      const msg = `${res.status} ${res.statusText}`;
      // 認証・設定の間違いはやり直しても直らない
      if (res.status !== 429 && res.status < 500) {
        const hint = res.status === 401 ? '（API キーが違います）' : res.status === 404 ? '（API のエンドポイント名が違うか、まだ作っていません）' : '';
        throw Object.assign(new Error(`microCMS ${new URL(url).pathname}: ${msg}${hint}`), { fatal: true });
      }
      lastErr = new Error(`microCMS ${new URL(url).pathname}: ${msg}`);
    } catch (e) {
      if (e.fatal) throw e;
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function fetchAll({ serviceDomain, apiKey }) {
  if (!/^[a-z0-9-]+$/i.test(serviceDomain || '')) throw new Error('MICROCMS_SERVICE_DOMAIN が空か、形がおかしいです（例: chiroom）。');
  if (!apiKey) throw new Error('MICROCMS_API_KEY が空です。');
  const base = `https://${serviceDomain}.microcms.io/api/v1`;
  const [settings, top, news] = await Promise.all([
    getJson(`${base}/settings`, apiKey),
    getJson(`${base}/top`, apiKey),
    getJson(`${base}/news?limit=100&orders=-date`, apiKey),
  ]);
  return { settings, top, news };
}
