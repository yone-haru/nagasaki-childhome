# 実行プラン

<!-- 複数ファイルにまたがる変更の前に、Claude がここへプランを書く(CLAUDE.md 参照)。 -->
<!-- 形式: ゴール / 変更するファイル / 手順 / 完了条件 / 仮定 -->

## 2026-09-03 dev/ テンプレートの本プロジェクトへの統合 — **完了**（結果は loop-result.md）

### ゴール
`dev/`（Claude Code 開発テンプレート）の【】を本プロジェクトの実態で埋め、`.claude/` として稼働させる。
テンプレートが前提とする「検証コマンド（test/lint/build）」が本プロジェクトには存在しないため、
依存ゼロの検証スクリプトを用意して検証ループを実際に閉じられる状態にする。

### 変更するファイル
- `.claude/CLAUDE.md`（新規・テンプレートを実プロジェクト値で埋める）
- `.claude/settings.json`（新規・allow を実コマンドに置換／旧版HTMLを deny）
- `.claude/settings.local.json`（既存に env 追記。既存の allow は保持）
- `.claude/hooks/usage-guard.js` `.claude/hooks/README.md`（そのままコピー）
- `.claude/agents/verifier.md`（検証コマンドのみ実コマンド化）
- `.claude/skills/{feature,commit,work-issues}/SKILL.md`（【test】【lint】を実コマンド化）
- `.claude/rules/index-html.md`（example-rule を本プロジェクトの規約に置換）
- `.claude/plan.md` `.claude/loop-result.md` `.claude/README.md`
- `tools/check.mjs`（検証: リンク/アセット/id重複/秘密情報）
- `tools/serve.mjs`（開発サーバ: cleanUrls 相当）
- `.gitignore`（テンプレートの ignore をマージ。**`.env` が未 ignore だったのを修正**）
- `dev/`（統合後に削除。原本は `../template/dev` に残る）

### 手順
1. `.claude/` 一式を配置し【】を実値で埋める
2. `tools/*.mjs` を作成し、`node tools/check.mjs` が現状の index.html で PASS することを確認
3. `.gitignore` をマージ（`.env` を確実に除外）
4. `dev/` を削除（`../template/dev` と一致することを diff で確認済み）
5. verifier サブエージェントで検証

### 完了条件
- `node tools/check.mjs` が exit 0
- `node tools/serve.mjs` が起動し `/` が 200 を返す
- `.claude/` 配下に `【】` が 1 つも残っていない
- `git status` に `.env` が現れない
- verifier が PASS

### 仮定
- 仮定: 本サイトにテスト/ビルド/Lint は今後も導入しない（依存を増やさない方針）。よって「テスト」は自作の静的検証スクリプトで代替する。
- 仮定: package.json は置かない（Vercel の静的サイト検出を変えないため）。検証は `node <script>` の直接実行とする。
