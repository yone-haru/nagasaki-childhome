#!/usr/bin/env node
// 静的サイトの検証スクリプト（依存ゼロ・Node 標準のみ）。
// テスト/Lint の代わりに「合否」を返す。exit 0 = PASS / exit 1 = FAIL。
//   node tools/check.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

// 検証対象の HTML（旧版 `_ ver2.0 _.html` などは対象外）
// 引数でファイルを渡すとそれを検査する（例: node tools/check.mjs v6-a.html）。比較用の下書きの検査に使う。
const ARGS = process.argv.slice(2).filter((a) => a.endsWith('.html'));
const PAGES = ARGS.length ? ARGS : ['index.html'];

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

function checkPage(page) {
  const file = join(ROOT, page);
  if (!existsSync(file)) { err(`${page}: ファイルが存在しない`); return; }
  const html = readFileSync(file, 'utf8');
  if (html.trim().length === 0) { err(`${page}: 空ファイル`); return; }

  // --- 基本のメタ情報 ---
  if (!/^\s*<!DOCTYPE html>/i.test(html)) err(`${page}: <!DOCTYPE html> がない`);
  if (!/<html[^>]*\blang="ja"/i.test(html)) err(`${page}: <html lang="ja"> がない`);
  if (!/<meta[^>]*charset="?utf-8"?/i.test(html)) err(`${page}: charset UTF-8 の meta がない`);
  if (!/<meta[^>]*name="viewport"/i.test(html)) err(`${page}: viewport の meta がない`);
  if (!/<title>[^<]{1,}<\/title>/i.test(html)) err(`${page}: <title> が空またはない`);
  const desc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
  if (!desc) err(`${page}: meta description がない`);
  else if (desc[1].trim().length < 20) warn(`${page}: meta description が短い（${desc[1].length}文字）`);

  const body = stripRaw(html);

  // --- id の重複 ---
  const ids = new Map();
  for (const m of body.matchAll(/\sid="([^"]+)"/g)) {
    const id = m[1];
    if (ids.has(id)) err(`${page}:${lineOf(body, m.index)} id="${id}" が重複（${ids.get(id)} 行目にも）`);
    else ids.set(id, lineOf(body, m.index));
  }

  // --- リンク・アセットの参照先 ---
  for (const m of body.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const raw = m[1].trim();
    const line = lineOf(body, m.index);
    if (raw === '') { warn(`${page}:${line} 空の href/src`); continue; }
    if (/^(mailto:|tel:|data:|javascript:)/i.test(raw)) continue;
    if (/^https:\/\//i.test(raw) || raw.startsWith('//')) continue;
    if (/^http:\/\//i.test(raw)) { err(`${page}:${line} http:// の外部参照（https にする）: ${raw}`); continue; }
    if (raw.startsWith('#')) {
      const target = decodeURIComponent(raw.slice(1));
      if (target && !ids.has(target)) err(`${page}:${line} アンカー先が存在しない: ${raw}`);
      continue;
    }
    // ローカルファイル参照
    const [path] = raw.split(/[?#]/);
    const rel = decodeURIComponent(path.replace(/^\.\//, ''));
    if (rel.startsWith('/')) {
      if (!existsSync(join(ROOT, rel.slice(1)))) err(`${page}:${line} 参照先が存在しない: ${raw}`);
    } else if (!existsSync(join(ROOT, rel))) {
      err(`${page}:${line} 参照先が存在しない: ${raw}`);
    }
  }

  // --- 画像の alt ---
  for (const m of body.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="/.test(m[0])) warn(`${page}:${lineOf(body, m.index)} <img> に alt がない`);
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
    if (!open) err(`${page}:${line} </${name}> に対応する開始タグがない`);
    else if (open.name !== name) {
      err(`${page}:${line} </${name}> と <${open.name}>（${open.line} 行目）が対応していない`);
      stack.length = 0; // 一度ずれたら以降は当てにならないので打ち切る
      break;
    }
  }
  for (const open of stack) err(`${page}:${open.line} <${open.name}> が閉じられていない`);
}

// --- 秘密情報の混入チェック（プロジェクト内のテキストファイルを再帰的に対象） ---
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

// --- .env が git の追跡対象になっていないか ---
function checkEnvIgnored() {
  if (!existsSync(join(ROOT, '.env'))) return;
  try {
    const tracked = execFileSync('git', ['ls-files', '--error-unmatch', '.env'],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (tracked) err('.env が git の追跡対象になっている（必ず追跡から外すこと）');
  } catch { /* 未追跡 = 正常 */ }
  try {
    execFileSync('git', ['check-ignore', '-q', '.env'], { cwd: ROOT, stdio: 'ignore' });
  } catch {
    err('.env が .gitignore で除外されていない');
  }
}

for (const p of PAGES) checkPage(p);
checkSecrets();
checkEnvIgnored();

for (const w of warns) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`\n検証対象: ${PAGES.join(', ')} / エラー ${errors.length} 件・警告 ${warns.length} 件`);
if (errors.length > 0) { console.log('検証結果: FAIL'); process.exit(1); }
console.log('検証結果: PASS');
