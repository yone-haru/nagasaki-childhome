#!/usr/bin/env node
// 見本データ（cms/seed/*.json）を microCMS に流し込む。最初の1回だけ使う。
//   node --env-file=.env tools/cms/import-seed.mjs --dry-run       何をするかだけ表示（通信しない）
//   node --env-file=.env tools/cms/import-seed.mjs                 写真をアップロードして、サイト設定・トップページ・お知らせを書き込む
//   node --env-file=.env tools/cms/import-seed.mjs --create-apis   その前に API（settings / top / news）もスキーマから作る
//
// 必要な API キーの権限（終わったら GET だけに戻すこと）:
//   - settings / top: PATCH、news: GET と POST
//   - マネジメントAPI: 「メディアのアップロード」（--create-apis なら「APIの作成」も）
// API キーは環境変数 MICROCMS_API_KEY から読む。ログには出さない。
import { readFileSync } from 'node:fs';
import { join, dirname, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DRY = process.argv.includes('--dry-run');
const CREATE = process.argv.includes('--create-apis');
const WAIT_MS = 250; // 書き込みは 1 秒 5 回まで
const APIS = [
  { endpoint: 'settings', name: 'サイト設定', type: 'object' },
  { endpoint: 'top', name: 'トップページ', type: 'object' },
  { endpoint: 'news', name: 'お知らせ', type: 'list' },
];
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const domain = process.env.MICROCMS_SERVICE_DOMAIN || '';
const key = process.env.MICROCMS_API_KEY || '';

if (!DRY) {
  if (!/^[a-z0-9-]+$/i.test(domain)) fail('MICROCMS_SERVICE_DOMAIN が空か、形がおかしいです（例: chiroom）。');
  if (!key) fail('MICROCMS_API_KEY が空です。');
}

function fail(m) { console.error('✗ ' + m); process.exit(1); }

async function call(method, url, body, { form = false } = {}) {
  const headers = { 'X-MICROCMS-API-KEY': key };
  if (body && !form) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { method, headers, body: form ? body : body && JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const text = await res.text();
  return { status: res.status, ok: res.ok, json: (() => { try { return JSON.parse(text); } catch { return null; } })(), text };
}
const why = (r) => `${r.status} ${r.json?.message || r.text.slice(0, 200)}`;

/* ---------- 画像を探して、アップロード後の URL に置き換える ---------- */
function collectImages(v, out) {
  if (Array.isArray(v)) v.forEach((x) => collectImages(x, out));
  else if (v && typeof v === 'object') {
    if (typeof v.url === 'string' && !/^https?:/.test(v.url)) out.add(v.url);
    else Object.values(v).forEach((x) => collectImages(x, out));
  }
}
// 書き込み API の形にする: 画像 → URL 文字列、null と空の日付は送らない
function toWrite(v, urls) {
  if (Array.isArray(v)) return v.map((x) => toWrite(x, urls));
  if (v && typeof v === 'object') {
    if (typeof v.url === 'string') return urls.get(v.url) || v.url;
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (x === null || (k === 'date' && x === '')) continue;
      o[k] = toWrite(x, urls);
    }
    return o;
  }
  return v;
}

const seed = { settings: readJson('cms/seed/settings.json'), top: readJson('cms/seed/top.json'), news: readJson('cms/seed/news.json').contents || [] };
const images = new Set();
collectImages(seed, images);

if (DRY) {
  console.log(`API を作る: ${CREATE ? APIS.map((a) => a.endpoint).join(', ') : 'しない（--create-apis で作る）'}`);
  console.log(`アップロードする写真: ${images.size} 枚`);
  console.log(`書き込み: settings（PATCH）・top（PATCH・セクション ${seed.top.sections.length}）・news（POST ${seed.news.length} 件）`);
  process.exit(0);
}

const api = `https://${domain}.microcms.io/api/v1`;
const mgmt = `https://${domain}.microcms-management.io/api/v1`;

/* ---------- 1. API を作る（任意） ---------- */
if (CREATE) {
  for (const a of APIS) {
    const schema = readJson(`cms/schema/${a.endpoint}.json`);
    const r = await call('POST', `${mgmt}/apis`, { name: a.name, endpoint: a.endpoint, type: a.type, ...schema });
    if (r.status === 409) console.log(`・API ${a.endpoint}: もうあるので作りません`);
    else if (r.ok) console.log(`✓ API ${a.endpoint} を作りました`);
    else fail(`API ${a.endpoint} を作れませんでした: ${why(r)}\n  管理画面の「スキーマをインポート」で cms/schema/${a.endpoint}.json を読み込んでから、--create-apis なしでやり直してください。`);
    await sleep(WAIT_MS);
  }
}

/* ---------- 2. 写真をアップロード ---------- */
const urls = new Map();
let n = 0;
for (const p of images) {
  const file = resolve(ROOT, p);
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(file)], { type: MIME[extname(file).toLowerCase()] || 'application/octet-stream' }), basename(file));
  const r = await call('POST', `${mgmt}/media`, fd, { form: true });
  if (!r.ok || !r.json?.url) fail(`写真 ${p} をアップロードできませんでした: ${why(r)}（API キーの「メディアのアップロード」権限を確認）`);
  urls.set(p, r.json.url);
  console.log(`✓ 写真 ${++n}/${images.size} ${p}`);
  await sleep(WAIT_MS);
}

/* ---------- 3. 書き込み ---------- */
for (const ep of ['settings', 'top']) {
  const r = await call('PATCH', `${api}/${ep}`, toWrite(seed[ep], urls));
  if (!r.ok) fail(`${ep} を書き込めませんでした: ${why(r)}（API キーの PATCH 権限・API の作成を確認）`);
  console.log(`✓ ${ep} を書き込みました`);
  await sleep(WAIT_MS);
}

const existing = await call('GET', `${api}/news?limit=0`);
if (!existing.ok) fail(`お知らせを読めませんでした: ${why(existing)}`);
if (existing.json.totalCount > 0) {
  console.log(`・お知らせはもう ${existing.json.totalCount} 件あるので、足しません（二重にならないように）`);
} else {
  for (const item of seed.news) {
    const r = await call('POST', `${api}/news`, toWrite(item, urls));
    if (!r.ok) fail(`お知らせを書き込めませんでした: ${why(r)}（API キーの POST 権限を確認）`);
    await sleep(WAIT_MS);
  }
  console.log(`✓ お知らせを ${seed.news.length} 件書き込みました`);
}

console.log('\n完了。API キーの権限を GET だけに戻してください。確認: node --env-file=.env tools/serve.mjs --cms');
