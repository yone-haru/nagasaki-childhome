# hooks

hooks は「Claude にお願いする」のではなく**ハーネスが機械的に実行する**自動化。
CLAUDE.md は助言、hooks は強制。「編集したら必ず lint」「テストが通るまでターンを終えない」のような
決定的な動作は CLAUDE.md に書くより hooks にする方が確実。

> 参考: https://code.claude.com/docs/en/hooks

## このテンプレートで有効になっているもの

### usage-guard（`usage-guard.js`）— Fable 5.1 の週次 50% 枠を監視

Fable 5.1 はプランの週次上限の **50% まで**しか同梱されない。超えると usage credits の課金対象になるか、
別モデル（Opus 5）へ切り替える必要がある。この判断を Claude の記憶ではなくハーネスで支えるのが usage-guard。

| 場所 | モード | 役割 |
|---|---|---|
| `settings.json` → `statusLine` | `statusline` | 画面下に `[Fable 5.1] \| 文脈 12% \| 5h 23% \| 週 41%/50 (→9/7 14:00)` を表示し、週の使用率を `.claude/usage-cache.json` に書く |
| `settings.json` → `hooks.UserPromptSubmit` | `prompt` | プロンプト送信のたびにキャッシュを読み、Fable 使用中かつ週の使用率が閾値以上なら警告文を stdout に出す。stdout は Claude の文脈に載るので、Claude が返答冒頭で `/model opus` を促す |

- 閾値は env `FABLE_SWITCH_THRESHOLD`（既定 `45`）。`settings.local.json` の `env` で変更できる。
- 使用率は `rate_limits.seven_day.used_percentage`（全モデル合算）。Fable だけ使っていれば Fable 枠と一致し、
  Opus/Sonnet が混ざると過大評価（＝安全側）になる。Fable 単独の消費量は公式には露出していない。
- `rate_limits` は claude.ai サブスク（Pro/Max/Team/Enterprise）でのみ来る。API キー利用時は週の表示が出ないだけで壊れない。
- 依存は Node.js のみ。`jq` は不要。
- 動作確認: `/hooks` に UserPromptSubmit が出ること、`/status` でステータスラインが表示されること。
  ステータスラインが出ない場合は `settings.json` の `command` を絶対パス（`node "C:/.../.claude/hooks/usage-guard.js" statusline`）に変える。
- 手動テスト:
  ```bash
  echo '{"model":{"id":"claude-fable-5-1","display_name":"Fable 5.1"},"context_window":{"used_percentage":12},"rate_limits":{"five_hour":{"used_percentage":23},"seven_day":{"used_percentage":47,"resets_at":1757221200}}}' | node .claude/hooks/usage-guard.js statusline
  echo '{}' | node .claude/hooks/usage-guard.js prompt
  ```

## レシピ集（使うものを `settings.json` の `"hooks"` にコピペ）

### 1. ファイル編集後に自動で検証（PostToolUse）

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/tools/check.mjs\" || true",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### 2. 危険な Bash コマンドをブロック（PreToolUse）

`permissions.deny` で書けない複雑な条件のとき用。終了コード 2 でブロックされ、stderr が Claude へのメッセージになる。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/hooks/block-dangerous.js\""
          }
        ]
      }
    ]
  }
}
```

`block-dangerous.js` の例（stdin に JSON でツール入力が来る）:

```js
let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  const input = JSON.parse(raw);
  const cmd = input.tool_input?.command ?? "";
  if (/git\s+reset\s+--hard|drop\s+table/i.test(cmd)) {
    console.error("破壊的コマンドはブロックされました: " + cmd);
    process.exit(2); // 2 = ブロック
  }
  process.exit(0); // 0 = 許可
});
```

### 3. テストが通るまでターンを終えない（Stop・決定的ゲート）

公式 best-practices の「Claude に自分で確認できる手段を与える」を機械的に強制する。
テストが落ちていると終了コード 2 でターン終了がブロックされ、Claude は続きを直す。
8 回連続でブロックされるとハーネスが強制的にターンを終える（無限ループ防止）。

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node tools/check.mjs > /dev/null 2>&1 || { echo 'node tools/check.mjs が落ちています。直してから終えてください。' >&2; exit 2; }",
            "timeout": 300
          }
        ]
      }
    ]
  }
}
```

セッション単位で同じことをしたいなら、hooks を書かずに `/goal node tools/check.mjs が exit 0` でよい（ターンごとに別の小型モデルが判定する）。

### 4. セッション開始時にコンテキストを注入（SessionStart）

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "git log --oneline -5"
          }
        ]
      }
    ]
  }
}
```

### 5. Claude の応答完了時に通知（Stop）

長時間タスクを放置するとき用（Windows の例）:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell -c \"[console]::beep(800,300)\""
          }
        ]
      }
    ]
  }
}
```

## 注意

- hooks はフルの shell 権限で動く。コマンドの中身は自分で責任を持つこと。
- `timeout`（秒）を付けないと重いコマンドでターンが遅くなる。
- 個人的な hooks は `settings.local.json` に、チーム共有は `settings.json` に書く。
- `${CLAUDE_PROJECT_DIR}` はプロジェクトルートに置換される。Windows でも shell 形式（Git Bash）で動く。
