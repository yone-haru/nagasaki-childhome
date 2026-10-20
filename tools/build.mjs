// サイトを組み立てる: site/template.html + データ → dist/index.html（＋使う画像をコピー）
//   node tools/build.mjs           microCMS から取る（環境変数 MICROCMS_SERVICE_DOMAIN / MICROCMS_API_KEY が必要）
//   node tools/build.mjs --seed    cms/seed/*.json を使う（CMS なしで手元確認・検証用）
//   --out <dir>                    出力先（既定 dist）
// Vercel ではこれが buildCommand。失敗すると本番は直前の版のまま残る。
// Vercel のプレビュー（master 以外のブランチ）は、環境変数がなければ見本データで作る（dataSource 参照）。
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize, CmsError } from './cms/normalize.mjs';
import { renderPage } from './cms/render.mjs';
import { fetchAll } from './cms/fetch.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// ページから参照されなくても置いておくもの（favicon・OGP など head 以外からも参照される）
const FIXED = ['chiroom-logo.png', 'nagasaki-u.png', 'ogp.png', 'favicon-32.png', 'favicon-512.png', 'apple-touch-icon.png'];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export async function build({ seed = false, out = 'dist', quiet = false } = {}) {
  const log = quiet ? () => {} : (m) => console.log(m);
  let raw;
  if (seed) {
    const dir = join(ROOT, 'cms', 'seed');
    const read = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
    raw = { settings: read('settings.json'), top: read('top.json'), news: read('news.json') };
    log('データ: cms/seed/*.json');
  } else {
    const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN;
    const apiKey = process.env.MICROCMS_API_KEY;
    if (!serviceDomain || !apiKey) {
      throw new CmsError('環境変数 MICROCMS_SERVICE_DOMAIN と MICROCMS_API_KEY が必要です。手元で CMS なしに確認するなら `node tools/build.mjs --seed`。');
    }
    raw = await fetchAll({ serviceDomain, apiKey });
    log(`データ: microCMS（${serviceDomain}）`);
  }

  const { data, warnings } = normalize(raw);
  for (const w of warnings) console.warn('⚠ ' + w);

  const template = readFileSync(join(ROOT, 'site', 'template.html'), 'utf8');
  // テンプレートの {{token}} がすべて埋まるか（本文の中の {{ }} は対象外）
  const html = renderPage(template, data);
  const unknown = [...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((k, i, a) => a.indexOf(k) === i)
    .filter((k) => html.includes(`{{${k}}}`) && !JSON.stringify(data).includes(`{{${k}}}`));
  if (unknown.length) throw new Error(`テンプレートの差し込み口が埋まりませんでした: ${unknown.join(', ')}`);

  const outDir = resolve(ROOT, out);
  if (!outDir.startsWith(ROOT + sep)) throw new Error(`出力先はプロジェクトの中にしてください: ${out}`);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);

  // ページが参照している相対パスのファイルをコピー
  const refs = new Set(FIXED);
  for (const m of html.matchAll(/\s(?:src|href)="([^"#:?]+)"/g)) {
    const p = decodeURIComponent(m[1]);
    // 画像だけをコピーする（CMS の入力から .env などが公開されないように）
    if (!p.startsWith('/') && /\.(png|jpe?g|webp|gif|svg|avif|ico)$/i.test(p)) refs.add(p);
  }
  const missing = [];
  for (const p of refs) {
    const from = resolve(ROOT, p);
    if (!from.startsWith(ROOT + sep) || relative(ROOT, from).split(sep)[0] === out) continue;
    if (!existsSync(from)) { missing.push(p); continue; }
    const to = join(outDir, relative(ROOT, from));
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
  if (missing.length) throw new Error(`ページが参照しているファイルがありません: ${missing.join(', ')}`);

  log(`出力: ${relative(ROOT, join(outDir, 'index.html'))}（セクション ${data.top.sections.length}・お知らせ ${data.news.length}・ファイル ${refs.size}）`);
  return { html, warnings, outDir };
}

// データの取り先: 'seed'（cms/seed）か 'cms'（microCMS）。
// Vercel のプレビュー（master 以外のブランチ）で microCMS の環境変数がないときだけ見本データにする。
// 本番（VERCEL_ENV=production）は見本に落とさない。環境変数がなければ build() が失敗して前の版が残る。
export function dataSource({ argv = [], env = {} } = {}) {
  if (argv.includes('--seed')) return 'seed';
  const hasCms = Boolean(env.MICROCMS_SERVICE_DOMAIN && env.MICROCMS_API_KEY);
  if (env.VERCEL_ENV === 'preview' && !hasCms) return 'seed';
  return 'cms';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = dataSource({ argv: process.argv, env: process.env });
  if (source === 'seed' && !process.argv.includes('--seed')) {
    console.log('プレビュー: microCMS の環境変数がないので見本データ（cms/seed）で作ります');
  }
  build({ seed: source === 'seed', out: arg('--out') || 'dist' }).catch((e) => {
    console.error('✗ ビルド失敗: ' + e.message);
    process.exit(1);
  });
}
