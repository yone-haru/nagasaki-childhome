# ループ実行ログ

<!-- 自律タスク中の進捗・知見・試みたこと(失敗含む)を Claude がここへ追記する(CLAUDE.md 参照)。 -->
<!-- 新しいエントリは日付見出しで上に追加する。 -->

## 2026-09-03 dev/ テンプレートの統合

**やったこと**: `dev/`（Claude Code 開発テンプレート）の【】をこのプロジェクトの実態で埋め、`.claude/` として稼働させた。`dev/` は削除（原本は `../template/dev`、diff で一致を確認済み）。

**知見・判断**
- このプロジェクトにはテスト・ビルド・Lint がなく、テンプレートが前提とする「合否を返すコマンド」が存在しなかった。依存ゼロの `tools/check.mjs`（参照切れ・id 重複・タグ対応・alt・秘密情報・.env の ignore）と `tools/serve.mjs`（cleanUrls / trailingSlash を Vercel と同じ挙動で再現）を用意して検証ループを閉じられるようにした。
- 仮定: `package.json` は置かない。Vercel の静的サイト検出が変わり意図しないビルドが走るため。検証は `node <script>` の直接実行に統一した。
- `tools/check.mjs` が初回実行で `.env` が `.gitignore` に入っていないことを検出。`.gitignore` にテンプレートの ignore をマージして修正済み（`.env` は未追跡のままだった）。
- master への push が即本番公開になるため、`/commit`・`/work-issues`・CLAUDE.md の該当箇所にその注意を明記した。
- `_ ver2.0 _.html`（13MB の旧版）は `settings.json` の deny で Read/Edit を禁止した（読むと文脈を潰すため）。

**検証**
- `node tools/check.mjs` → エラー 0 / 警告 0 / exit 0
- `node tools/serve.mjs 3517` → `/` 200・`/nagasaki-u.png` 200・`/nope` 404
- `usage-guard.js` statusline / prompt → 想定どおり出力（テストで作られた `usage-cache.json` は削除済み）
- `.claude/` 配下に `【】` の残りなし（`plan.md` の作業記述を除く）
- `verifier` サブエージェントによる検証: **PASS**（[must] 1件・[should] 1件・[nit] 2件を指摘）
  - [must] `.claude/rules/index-html.md` に実在しない `<header>` タグの記述 → 修正済み（`<body>` 直後は `id` なしの `<section class="hero">`）
  - [should] `tools/check.mjs` の秘密情報チェックが `.claude/` 配下を素通りしていた → 再帰スキャンに変更して修正済み（`.git`/`node_modules`/`dist`/`build` は除外、13MB超のファイルも除外）
  - [nit] `.reveal-delay-1`/`-2` しか書いていなかったが実際は `-4` まである → 記述を修正済み
  - [nit] タグ対応チェックの正規表現が属性値内の `>` で誤爆しうる。現状は該当箇所なしで実害なし。将来 `title="5 > 3"` 等を書くときは要注意（`tools/check.mjs` の既知の制約として残す・対応は見送り）
