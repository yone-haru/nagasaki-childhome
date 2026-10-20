#!/usr/bin/env node
// 検証スクリプト（依存ゼロ・Node 標準のみ）。テスト/Lint の代わりに合否を返す。exit 0 = PASS / exit 1 = FAIL。
//   node tools/check.mjs              cms/seed で dist/ を組み立てて検査し、CMS まわりのテストも回す
//   node tools/check.mjs foo.html     指定した HTML だけ検査する（比較用の下書きなど）
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, dataSource } from './build.mjs';
import { normalize, CmsError } from './cms/normalize.mjs';
import { renderPage } from './cms/render.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const ARGS = process.argv.slice(2).filter((a) => a.endsWith('.html'));

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

function stripRaw(html) {
  // コメント・script/style の中身を空白で置換（位置は保つ）
  const blank = (m) => ' '.repeat(m.length);
  return html
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, blank)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, blank);
}

// HTML 文字列を検査する。base を渡すとローカル参照の存在も確かめる（null なら確かめない）
function checkHtml(html, page, base, { e = err, w = warn } = {}) {
  if (html.trim().length === 0) { e(`${page}: 空ファイル`); return; }

  // --- 基本のメタ情報 ---
  if (!/^\s*<!DOCTYPE html>/i.test(html)) e(`${page}: <!DOCTYPE html> がない`);
  if (!/<html[^>]*\blang="ja"/i.test(html)) e(`${page}: <html lang="ja"> がない`);
  if (!/<meta[^>]*charset="?utf-8"?/i.test(html)) e(`${page}: charset UTF-8 の meta がない`);
  if (!/<meta[^>]*name="viewport"/i.test(html)) e(`${page}: viewport の meta がない`);
  if (!/<title>[^<]{1,}<\/title>/i.test(html)) e(`${page}: <title> が空またはない`);
  const desc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
  if (!desc) e(`${page}: meta description がない`);
  else if (desc[1].trim().length < 20) w(`${page}: meta description が短い（${desc[1].length}文字）`);
  if (/\{\{\w+\}\}/.test(html)) e(`${page}: テンプレートの差し込み口 {{...}} が残っている`);

  const body = stripRaw(html);

  // --- id の重複 ---
  const ids = new Map();
  for (const m of body.matchAll(/\sid="([^"]+)"/g)) {
    const id = m[1];
    if (ids.has(id)) e(`${page}:${lineOf(body, m.index)} id="${id}" が重複（${ids.get(id)} 行目にも）`);
    else ids.set(id, lineOf(body, m.index));
  }

  // --- リンク・アセットの参照先 ---
  for (const m of body.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const raw = m[1].trim();
    const line = lineOf(body, m.index);
    if (raw === '') { w(`${page}:${line} 空の href/src`); continue; }
    if (/^javascript:/i.test(raw)) { e(`${page}:${line} javascript: のリンク`); continue; }
    if (/^(mailto:|tel:|data:)/i.test(raw)) continue;
    if (/^https:\/\//i.test(raw) || raw.startsWith('//')) continue;
    if (/^http:\/\//i.test(raw)) { e(`${page}:${line} http:// の外部参照（https にする）: ${raw}`); continue; }
    if (raw.startsWith('#')) {
      const target = decodeURIComponent(raw.slice(1));
      if (target && !ids.has(target)) e(`${page}:${line} アンカー先が存在しない: ${raw}`);
      continue;
    }
    if (base == null) continue;
    const [path] = raw.split(/[?#]/);
    const rel = decodeURIComponent(path.replace(/^\.\//, '')).replace(/^\//, '');
    if (!existsSync(join(base, rel))) e(`${page}:${line} 参照先が存在しない: ${raw}`);
  }

  // --- 画像の alt ---
  for (const m of body.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="/.test(m[0])) w(`${page}:${lineOf(body, m.index)} <img> に alt がない`);
  }

  // --- タグの対応 ---
  const stack = [];
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g)) {
    const [, closing, rawName, attrs] = m;
    const name = rawName.toLowerCase();
    if (VOID.has(name) || attrs.trimEnd().endsWith('/')) continue;
    const line = lineOf(body, m.index);
    if (!closing) { stack.push({ name, line }); continue; }
    const open = stack.pop();
    if (!open) e(`${page}:${line} </${name}> に対応する開始タグがない`);
    else if (open.name !== name) {
      e(`${page}:${line} </${name}> と <${open.name}>（${open.line} 行目）が対応していない`);
      stack.length = 0; // 一度ずれたら以降は当てにならないので打ち切る
      break;
    }
  }
  for (const open of stack) e(`${page}:${open.line} <${open.name}> が閉じられていない`);
}

function checkFile(page) {
  const file = resolve(ROOT, page);
  if (!existsSync(file)) { err(`${page}: ファイルが存在しない`); return; }
  checkHtml(readFileSync(file, 'utf8'), page, dirname(file));
}

/* ======================================================================
   CMS のスキーマ（cms/schema/*.json）と見本データ（cms/seed/*.json）
   ====================================================================== */
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const KINDS = new Set(['text', 'textArea', 'richEditorV2', 'media', 'mediaList', 'file', 'date', 'number',
  'boolean', 'select', 'relation', 'relationList', 'iframe', 'custom', 'repeater']);
const RESERVED = new Set(['id', 'createdAt', 'updatedAt', 'publishedAt', 'revisedAt', 'fieldId']);
// microCMS が受け付けるプロパティ（知らないものがあると 400 になる）
const COMMON_PROPS = ['fieldId', 'name', 'kind', 'description', 'required'];
const KIND_PROPS = {
  text: ['isUnique', 'patternMatchValidation', 'textSizeLimitValidation', 'initialValue'],
  textArea: ['patternMatchValidation', 'textSizeLimitValidation', 'initialValue'],
  media: ['imageSizeValidation', 'initialValue'],
  date: ['dateFormat', 'initialValue'],
  boolean: ['initialValue'],
  select: ['selectItems', 'multipleSelect', 'initialValue'],
  custom: ['customFieldId', 'listViewFieldId'],
  repeater: ['customFieldIds', 'repeaterCountLimitValidation'],
};

function checkField(f, where, { inCustom }) {
  const at = `${where}.${f.fieldId}`;
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(f.fieldId || '')) err(`${at}: fieldId は英数字・_・- の 2〜20 文字`);
  if (RESERVED.has(f.fieldId)) err(`${at}: fieldId が予約語`);
  if (!f.name || f.name.length > 100) err(`${at}: name は 1〜100 文字`);
  if (!KINDS.has(f.kind)) { err(`${at}: 知らない kind（${f.kind}）`); return; }
  if (f.kind === 'file') err(`${at}: file は Hobby プランで使えない`);
  if (!(f.description === null || (typeof f.description === 'string' && f.description.length > 0))) err(`${at}: description は null か空でない文字列`);
  if (typeof f.required !== 'boolean') err(`${at}: required が boolean でない`);
  const allowed = new Set([...COMMON_PROPS, ...(KIND_PROPS[f.kind] || [])]);
  for (const k of Object.keys(f)) if (!allowed.has(k)) err(`${at}: ${f.kind} に使えないプロパティ ${k}`);
  if (f.kind === 'select') {
    if (typeof f.multipleSelect !== 'boolean') err(`${at}: multipleSelect が必要`);
    if (!Array.isArray(f.selectItems) || !f.selectItems.length) err(`${at}: selectItems が空`);
  }
  if (f.kind === 'custom' && inCustom) err(`${at}: カスタムフィールドの中にカスタムフィールドは置けない`);
  if (f.kind === 'repeater' && (!Array.isArray(f.customFieldIds) || !f.customFieldIds.length)) err(`${at}: customFieldIds が空`);
}

function checkSchema(name, schema) {
  const where = `cms/schema/${name}.json`;
  if (!Array.isArray(schema.apiFields) || !Array.isArray(schema.customFields)) { err(`${where}: apiFields / customFields がない`); return null; }
  if (schema.customFields.length > 99) err(`${where}: カスタムフィールドは 99 個まで`);
  const customs = new Map();
  for (const c of schema.customFields) {
    if (customs.has(c.fieldId)) err(`${where}: カスタムフィールド ${c.fieldId} が重複`);
    customs.set(c.fieldId, c);
    if (!/^[A-Za-z0-9_-]{2,20}$/.test(c.fieldId || '')) err(`${where}.${c.fieldId}: fieldId は英数字・_・- の 2〜20 文字`);
    if (!c.name || c.name.length > 300) err(`${where}.${c.fieldId}: name は 1〜300 文字`);
    const ids = c.fields.map((f) => f.fieldId);
    if (new Set(ids).size !== ids.length) err(`${where}.${c.fieldId}: fieldId が重複`);
    const order = (c.fieldOrderByColumn || []).flat();
    if (!(c.fieldOrderByColumn?.length >= 1 && c.fieldOrderByColumn.length <= 2) || order.length !== ids.length || !ids.every((x) => order.includes(x))) {
      err(`${where}.${c.fieldId}: fieldOrderByColumn に全フィールドが1回ずつ入っていない`);
    }
    for (const f of c.fields) checkField(f, `${where}.${c.fieldId}`, { inCustom: true });
  }
  const apiIds = schema.apiFields.map((f) => f.fieldId);
  if (new Set(apiIds).size !== apiIds.length) err(`${where}: apiFields の fieldId が重複`);
  for (const f of schema.apiFields) checkField(f, where, { inCustom: false });
  // repeater / custom の参照先が存在するか
  const all = [...schema.apiFields, ...schema.customFields.flatMap((c) => c.fields)];
  for (const f of all) {
    for (const id of f.customFieldIds || (f.customFieldId ? [f.customFieldId] : [])) {
      if (!customs.has(id)) err(`${where}.${f.fieldId}: カスタムフィールド ${id} が定義されていない`);
    }
  }
  return customs;
}

// 見本データがスキーマどおりか（知らないキー・選べない値・必須の空）
function checkData(obj, fields, customs, where) {
  const byId = new Map(fields.map((f) => [f.fieldId, f]));
  for (const k of Object.keys(obj)) {
    if (k === 'fieldId') continue;
    if (!byId.has(k)) err(`${where}: スキーマにないキー ${k}`);
  }
  for (const f of fields) {
    const v = obj[f.fieldId];
    const at = `${where}.${f.fieldId}`;
    const empty = v == null || v === '' || (Array.isArray(v) && !v.length);
    // 画像は取り込み時にアップロードするので、見本では null でもよい
    if (f.required && empty && f.kind !== 'media') err(`${at}: 必須なのに空`);
    if (empty) continue;
    if (f.kind === 'select') {
      const ok = f.selectItems.map((x) => x.value);
      for (const x of Array.isArray(v) ? v : [v]) if (!ok.includes(x)) err(`${at}: 選べない値「${x}」`);
    } else if (f.kind === 'boolean' && typeof v !== 'boolean') err(`${at}: boolean でない`);
    else if (f.kind === 'repeater') {
      if (!Array.isArray(v)) { err(`${at}: 配列でない`); continue; }
      v.forEach((item, i) => {
        if (!f.customFieldIds.includes(item.fieldId)) { err(`${at}[${i}]: 使えない種類 ${item.fieldId}`); return; }
        checkData(item, customs.get(item.fieldId).fields, customs, `${at}[${i}]`);
      });
    } else if (f.kind === 'custom') {
      checkData(v, customs.get(f.customFieldId).fields, customs, at);
    } else if ((f.kind === 'text' || f.kind === 'textArea') && typeof v !== 'string') err(`${at}: 文字列でない`);
    else if (f.kind === 'media' && !(typeof v === 'object' && typeof v.url === 'string')) err(`${at}: 画像の形（{url}）でない`);
  }
}

function checkCms() {
  const schema = {}, seed = {};
  for (const n of ['settings', 'top', 'news']) {
    try { schema[n] = readJson(`cms/schema/${n}.json`); } catch (e) { err(`cms/schema/${n}.json: 読めない（${e.message}）`); return; }
    try { seed[n] = readJson(`cms/seed/${n}.json`); } catch (e) { err(`cms/seed/${n}.json: 読めない（${e.message}）`); return; }
  }
  const customs = {};
  for (const n of ['settings', 'top', 'news']) customs[n] = checkSchema(n, schema[n]);
  if (errors.length) return;
  checkData(seed.settings, schema.settings.apiFields, customs.settings, 'seed/settings');
  checkData(seed.top, schema.top.apiFields, customs.top, 'seed/top');
  (seed.news.contents || []).forEach((x, i) => checkData(x, schema.news.apiFields, customs.news, `seed/news[${i}]`));

  // normalize.mjs が知っている選択肢とスキーマの選択肢がそろっているか
  const norm = readFileSync(join(ROOT, 'tools/cms/normalize.mjs'), 'utf8');
  const values = (cf, fid) => customs.top.get(cf).fields.find((f) => f.fieldId === fid).selectItems.map((x) => x.value);
  for (const v of values('iconCard', 'icon')) if (!norm.includes(`'${v}'`)) err(`normalize.mjs: アイコン「${v}」を知らない`);
  for (const v of values('qa', 'linkTo')) if (!norm.includes(`'${v}'`)) err(`normalize.mjs: リンク先「${v}」を知らない`);
  const secIds = schema.top.apiFields.find((f) => f.fieldId === 'sections').customFieldIds;
  for (const id of secIds) if (!norm.includes(`'${id.replace(/^sec_/, '')}'`)) err(`normalize.mjs: セクション ${id} を知らない`);
  return seed;
}

/* ======================================================================
   入力ミスへの強さ（見本データを壊して組み立て、ページが壊れないか）
   ====================================================================== */
function checkRobustness(seed) {
  const template = readFileSync(join(ROOT, 'site/template.html'), 'utf8');
  const clone = () => structuredClone(seed);
  const sec = (raw, type) => raw.top.sections.find((x) => x.fieldId === `sec_${type}`);
  const run = (label, mutate, expect) => {
    const raw = clone();
    mutate(raw);
    let out;
    try {
      const { data, warnings } = normalize(raw);
      out = { html: renderPage(template, data), warnings };
    } catch (e) {
      out = { error: e };
    }
    const fail = (m) => err(`テスト「${label}」: ${m}`);
    if (expect.throws) {
      if (!(out.error instanceof CmsError)) fail(out.error ? `想定外のエラー ${out.error.message}` : 'ビルドが止まらなかった');
      return;
    }
    if (out.error) { fail(`ビルドが落ちた: ${out.error.message}`); return; }
    checkHtml(out.html, `[${label}]`, null, { e: fail, w: () => {} });
    expect.check?.(out, fail);
  };
  const has = (s) => (o, fail) => { if (!o.html.includes(s)) fail(`「${s}」が出ていない`); };
  const hasNot = (s) => (o, fail) => { if (o.html.includes(s)) fail(`「${s}」が出てしまう`); };
  const warned = (o, fail) => { if (!o.warnings.length) fail('警告が出ていない'); };
  const all = (...fs) => (o, fail) => fs.forEach((f) => f(o, fail));

  run('タイトルが空', (r) => { r.settings.siteTitle = ''; }, { throws: true });
  run('LINE の URL が javascript:', (r) => { r.settings.lineUrl = 'javascript:alert(1)'; }, { throws: true });
  run('メールの形が違う', (r) => { r.settings.email = 'chiroom'; }, { throws: true });
  run('ヒーローの写真がない', (r) => { r.top.heroSlides = []; }, { throws: true });
  run('セクションがない', (r) => { r.top.sections = []; }, { throws: true });
  run('Instagram の URL が javascript:', (r) => { r.settings.instagramUrl = 'javascript:alert(1)'; }, { check: all(warned, hasNot('javascript:')) });
  run('質問のリンク先 URL が javascript:', (r) => {
    Object.assign(sec(r, 'faq').studentItems[0], { linkWord: sec(r, 'faq').studentItems[0].answer.slice(0, 2), linkTo: ['URLを入力'], linkUrl: 'javascript:alert(1)' });
  }, { check: all(warned, hasNot('javascript:')) });
  run('見出しに HTML', (r) => { sec(r, 'about').heading = '<script>alert(1)</script>'; }, { check: hasNot('<script>alert(1)') });
  run('活動の写真がない', (r) => { sec(r, 'activities').items[0].image = null; }, {});
  run('ヒーローの2枚目に画像がない', (r) => { r.top.heroSlides[1].image = null; }, { check: warned });
  run('同じセクションが2つ', (r) => { r.top.sections.push(clone().top.sections.find((x) => x.fieldId === 'sec_about')); }, {
    check: all(warned, (o, fail) => { if (o.html.split('id="about"').length !== 2) fail('id="about" が1つでない'); }),
  });
  run('参加するセクションがない', (r) => { r.top.sections = r.top.sections.filter((x) => x.fieldId !== 'sec_join'); }, { check: hasNot('id="join"') });
  run('参加するだけ', (r) => { r.top.sections = r.top.sections.filter((x) => x.fieldId === 'sec_join'); }, {});
  run('知らない種類のセクション', (r) => { r.top.sections.push({ fieldId: 'sec_unknown', heading: 'x' }); }, { check: warned });
  run('ヘッダーのメニューが6つ以上', (r) => { r.top.sections.forEach((x) => { x.headerLabel = x.headerLabel || 'メニュー'; }); }, { check: warned });
  run('自由セクションを2つ足す', (r) => {
    const free = (h) => ({ fieldId: 'sec_free', heading: h, lead: '', menuLabel: h, headerLabel: '', footerLabel: '', tinted: false,
      body: '1段落目\n2段落目 公式LINE', image: null, imageAlt: '', linkWord: '公式LINE', linkTo: ['LINE'], linkUrl: '' });
    r.top.sections.splice(1, 0, free('お知らせ1'), free('お知らせ2'));
  }, { check: all(has('id="free-1"'), has('id="free-2"'), has('class="free-body'), has('<p>1段落目</p>')) });
  run('お知らせが空', (r) => { r.news.contents = []; }, {});
  // 中身が空のセクションは見出しだけ出さずに外す（リンクも残さない）
  const emptied = { activities: (s) => { s.items = []; }, day: (s) => { s.steps = []; }, promise: (s) => { s.items = []; }, flow: (s) => { s.steps = []; },
    gallery: (s) => { s.photos = []; }, faq: (s) => { s.studentItems = []; s.partnerItems = []; }, profile: (s) => { s.rows = []; } };
  for (const [type, empty] of Object.entries(emptied)) {
    run(`${type} の中身が空`, (r) => empty(sec(r, type)), { check: all(warned, hasNot(`id="${type}"`), hasNot(`href="#${type}"`)) });
  }
}

/* ======================================================================
   秘密情報の混入・.env の除外
   ====================================================================== */
const SECRET_SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build']);
const SECRET_SCAN_EXT = /\.(html|json|js|mjs|css|md)$/i;
const SECRET_SIZE_LIMIT = 2 * 1024 * 1024; // 旧版 13MB の HTML 等は除外

function collectScanTargets(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') && name !== '.claude') continue; // .git 等の隠しディレクトリは除外（.claude は対象）
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (SECRET_SKIP_DIRS.has(name)) continue;
      collectScanTargets(full, out);
    } else if (SECRET_SCAN_EXT.test(name) && st.size < SECRET_SIZE_LIMIT) {
      out.push(full);
    }
  }
}

function checkSecrets() {
  const patterns = [
    [/\bsk-[A-Za-z0-9]{16,}/, 'API キーらしき文字列 (sk-...)'],
    [/\bAKIA[0-9A-Z]{16}\b/, 'AWS アクセスキー'],
    [/\bghp_[A-Za-z0-9]{20,}/, 'GitHub トークン'],
    [/(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{12,}["']/i, '認証情報らしき代入'],
  ];
  const targets = [];
  collectScanTargets(ROOT, targets);
  for (const full of targets) {
    const rel = full.slice(ROOT.length + 1).replace(/\\/g, '/');
    const text = readFileSync(full, 'utf8');
    for (const [re, label] of patterns) {
      const m = text.match(re);
      if (m) err(`${rel}:${lineOf(text, m.index)} ${label} が含まれている可能性`);
    }
  }
}

function checkEnvIgnored() {
  for (const f of ['.env', '.env.local']) {
    if (!existsSync(join(ROOT, f))) continue;
    try {
      const tracked = execFileSync('git', ['ls-files', '--error-unmatch', f],
        { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (tracked) err(`${f} が git の追跡対象になっている（必ず追跡から外すこと）`);
    } catch { /* 未追跡 = 正常 */ }
    try {
      execFileSync('git', ['check-ignore', '-q', f], { cwd: ROOT, stdio: 'ignore' });
    } catch {
      err(`${f} が .gitignore で除外されていない`);
    }
  }
}

// Vercel のビルドでデータの取り先が正しく振り分けられるか（本番が見本データに落ちないこと）
function checkDataSource() {
  const cms = { MICROCMS_SERVICE_DOMAIN: 'x', MICROCMS_API_KEY: 'y' };
  const cases = [
    [{ argv: ['--seed'], env: {} }, 'seed', '--seed'],
    [{ env: { VERCEL_ENV: 'preview' } }, 'seed', 'プレビュー・環境変数なし'],
    [{ env: { VERCEL_ENV: 'preview', ...cms } }, 'cms', 'プレビュー・環境変数あり'],
    [{ env: { VERCEL_ENV: 'production' } }, 'cms', '本番・環境変数なし'],
    [{ env: { VERCEL_ENV: 'production', MICROCMS_SERVICE_DOMAIN: 'x' } }, 'cms', '本番・環境変数が片方だけ'],
    [{ env: { VERCEL_ENV: 'production', ...cms } }, 'cms', '本番・環境変数あり'],
    [{ env: {} }, 'cms', '手元・引数なし'],
  ];
  for (const [input, want, label] of cases) {
    const got = dataSource({ argv: [], ...input });
    if (got !== want) err(`データの取り先（${label}）が ${got}。${want} であるべき`);
  }
}

/* ====================================================================== */
let targets;
if (ARGS.length) {
  targets = ARGS;
  for (const p of ARGS) checkFile(p);
} else {
  targets = ['dist/index.html（cms/seed から組み立て）', 'cms/schema', 'cms/seed'];
  try {
    const { warnings } = await build({ seed: true, quiet: true });
    for (const w of warnings) warn(`見本データ: ${w}`);
    checkFile('dist/index.html');
  } catch (e) {
    err(`見本データでのビルドに失敗: ${e.message}`);
  }
  const seed = checkCms();
  if (seed) checkRobustness(seed);
  checkDataSource();
}
checkSecrets();
checkEnvIgnored();

for (const w of warns) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`\n検証対象: ${targets.join(', ')} / エラー ${errors.length} 件・警告 ${warns.length} 件`);
if (errors.length > 0) { console.log('検証結果: FAIL'); process.exit(1); }
console.log('検証結果: PASS');
