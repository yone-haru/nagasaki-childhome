# プラン: ちるーむ確認用のプレビュー URL（Issue #8）

## 手順
1. `tools/build.mjs`: データの取り先を決める `dataSource({ argv, env })` を足す。`--seed` → 見本。`VERCEL_ENV=preview` で microCMS の環境変数がないとき → 見本（ログに明記）。それ以外 → microCMS（本番で環境変数がなければ今まで通り失敗）
2. `tools/check.mjs`: `dataSource` の振り分けを検査（本番＋環境変数なしで見本に落ちないこと）
3. CLAUDE.md のハマりどころ・コマンドに追記
4. `node tools/check.mjs` exit 0 → verifier → コミット
5. `preview/chiroom-review` ブランチを作って push（master は push しない）→ Vercel のプレビュー URL を確認

## 完了条件
- check exit 0、verifier PASS
- 本番（production）では見本データに切り替わらない
- プレビュー URL が見本データで表示される
