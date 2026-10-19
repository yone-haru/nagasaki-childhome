# プラン: v5.0 に microCMS を入れる（Issue #6）

設計書: `docs/superpowers/specs/2026-10-18-cms-design.md`（2026-10-19 改訂）

## 手順
1. `git mv index.html site/template.html`。本文（ヒーロー〜SNS）・ナビ・フッター・head の可変部分を `{{token}}` に置き換える。JS の `join` に null ガード。自由セクション用の CSS を少し足す
2. `tools/cms/render.mjs`（セクション HTML）・`normalize.mjs`・`fetch.mjs`・`tools/build.mjs`
3. `cms/seed/{settings,top,news}.json`（v5.0 の文言そのまま）
4. 差分確認: `git show a1663a5:index.html`（null ガードを当てたもの）と `dist/index.html` をコメント除去・空白正規化して比較 → 一致させる
5. `tools/check.mjs`（引数なしで seed ビルド → dist 検査）・`tools/serve.mjs`（dist 配信）・`vercel.json`・`cms/env.example`（`.env.example` は deny ルールで書けないため）
6. `cms/schema/*.json`・`tools/cms/import-seed.mjs`・`docs/cms-manual.md`
7. CLAUDE.md・`.claude/rules/index-html.md` を更新
8. 1440 / 390 のスクリーンショットを v5.0 と比較
9. verifier → PASS まで直す → コミット（push しない）→ Issue #6 にコメントして閉じる

## 完了条件
- `node tools/check.mjs` exit 0
- 生成 HTML が v5.0 とマークアップ一致（null ガード・自由セクション CSS を除く）
- 1440 / 390 で見た目が同等
- スキーマ・投入スクリプト・マニュアルがそろう
- verifier PASS、コミットのみ
