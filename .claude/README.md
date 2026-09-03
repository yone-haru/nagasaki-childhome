# .claude/ の使い方（ちるーむサイト）

Claude Code の運用設定一式。元は `../template/dev` の汎用テンプレートで、本プロジェクト向けに埋めてある。
要件: Claude Code **v2.1.255 以上**、Node.js（ステータスライン／フック用）。

| ファイル | 役割 |
|---|---|
| `CLAUDE.md` | 毎セッション読まれる運用ルール（技術スタック・コマンド・ハマりどころ・検証ループ・境界・モデル運用・Issue 運用） |
| `settings.json` | 許可/拒否ルール、サブエージェントの既定モデル（sonnet）、ステータスライン、usage-guard フック |
| `settings.local.json` | 個人設定（gitignore 済み）。`FABLE_SWITCH_THRESHOLD` で切替閾値を変える。例は `settings.local.json.example` |
| `hooks/usage-guard.js` | Fable の週次 50% 枠を監視して警告する（レシピは `hooks/README.md`） |
| `agents/verifier.md` | 実装と分離された検証・レビュー担当（sonnet） |
| `rules/index-html.md` | `index.html` を触るときだけ読み込まれる規約（CSS 変数・`.reveal`・単一ファイル構成） |
| `skills/feature` | `/feature <タスク>` — 計画→実装→verifier 検証→記録→コミットの自律ループ |
| `skills/commit` | `/commit` — 検証してから論理単位でコミット |
| `skills/work-issues` | `/work-issues` — open Issue をまとめて処理 |
| `plan.md` / `loop-result.md` | 複数ファイル変更のプラン置き場 / 自律ループの作業ログ |

## このプロジェクトでの検証

テスト・ビルド・Lint はない（`package.json` を置くと Vercel の静的サイト検出が変わるため入れない方針）。
代わりに依存ゼロの自作スクリプトが合否を返す。

```bash
node tools/check.mjs    # 参照切れ・id 重複・タグの対応・alt・秘密情報・.env の ignore を検査（exit 0 = PASS）
node tools/serve.mjs    # http://localhost:3000 で確認（cleanUrls / trailingSlash を Vercel と同じ挙動で再現）
```

## モデル運用（Fable 5.1 → Opus 5）

Fable 5.1 はプランの週次上限の **50% まで**。このテンプレートは「50% 手前で Opus 5 に切り替える」運用。

- **見る**: ステータスライン `[Fable 5.1] | 文脈 12% | 5h 23% | 週 41%/50 (→9/7 14:00)`。`/usage` でも確認できる。
- **切り替える**: `/model opus` → `Enter`（既定として保存）。週次リセット後に `/model fable` で戻す。
- **Claude 側**: 閾値（既定 45%）到達後の最初の返答で1行だけ切替を促す。作業は止めない。切替は人間の操作。
- **サブエージェントは sonnet**: `settings.json` の `CLAUDE_CODE_SUBAGENT_MODEL`。verifier / Explore は Fable・Opus の枠を消費しない。
- `/commit` と `/work-issues` はスキル側で `model: opus` 固定。`/feature` は `inherit`（いま選んでいるモデル）。

## 動作確認

```
/hooks     → UserPromptSubmit に usage-guard が出る
/status    → ステータスラインが表示される（rate_limits は最初の応答後に出る）
/context   → Memory files に .claude/CLAUDE.md が載っている
```
