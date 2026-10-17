# ちるーむ 公式サイト

> 長崎大学のこども食堂サポートサークル「ちるーむ」の公式サイト。`index.html` 1枚で完結する静的サイトを Vercel で公開している。読者は入会を検討する学生と、連携先のこども食堂・地域の人。

## 技術スタック
- HTML + CSS + 素の JavaScript のみ。**ビルドツールも npm 依存もない**（CSS と JS は `index.html` に内包）
- 外部依存は Google Fonts のみ（見出し: Zen Maru Gothic 700/900、本文: Zen Kaku Gothic New 400/500/700。v4.0 で Hachi Maru Pop / Fraunces は廃止）。ライブラリは足さない
- 検証: 自作の `tools/check.mjs`（依存ゼロ・Node 標準のみ）
- デプロイ: Vercel。`vercel.json` は `cleanUrls: true` / `trailingSlash: false`。**master への push が即本番公開**

## コマンド
```bash
node tools/serve.mjs        # 開発サーバ http://localhost:3000（Ctrl+C で停止。ポート変更は引数）
node tools/check.mjs        # 検証（テスト/Lint 相当。exit 0 = 合格）
git push origin master      # 本番公開（= デプロイ。下の「やってはいけないこと」を読むこと）
```
ビルド工程はない。`node tools/check.mjs` が exit 0 であることが合否の基準。

## プロジェクト構成
```
index.html            # サイト本体（CSS/JS/アイコン SVG 内包・約1550行）。編集対象はほぼここだけ。構成と規約は .claude/rules/index-html.md
vercel.json           # Vercel 設定（cleanUrls / trailingSlash）
tools/                # 検証・開発用スクリプト（依存ゼロ。ここ以外にスクリプトを増やさない）
.claude/              # 運用ルール・スキル・フック（このファイルを含む）
chiroom-logo.png      # ロゴタイプ（透過・内容領域でトリミング済み・39KB）。ヘッダー/ヒーロー/フッターで使用
nagasaki-u.png        # 長崎大学ロゴ
ogp.png               # OGP 画像 1200×630
favicon-32.png / favicon-512.png / apple-touch-icon.png   # favicon（ロゴの「ち」1文字）
チルーム　アイコン.jpg  # 元ロゴ（背景付き・ファイル名に全角スペースあり）。v4.0 からは未使用だが残す
チルーム_アイコン_透過 .png / .svg   # 元ロゴ（透過）。未追跡・未使用。chiroom-logo.png の生成元
_ ver2.0 _.html       # 旧版(13MB)。参照も編集もしない
改善点まとめ.pdf       # 改善要望の元資料（v3.0 で反映済み・v4.0 でも指定文言を維持）
```
本番 URL: `https://childhome-nagasaki.vercel.app/`（canonical / OGP / JSON-LD に絶対 URL で記載）

## ハマりどころ・既知の問題（随時追記・消さない）
- **`package.json` を置かない。** Vercel の「静的サイト」検出が変わり、意図しないビルドが走る。検証は `node tools/check.mjs` のように直接実行する。
- **`_ ver2.0 _.html` は 13MB の旧版。** 開くと文脈を潰す。`.claude/settings.json` で Read/Edit を deny 済み。grep するときも対象から外す。
- 画像ファイル名が日本語＋全角スペース（`チルーム　アイコン.jpg`）。リネームすると `index.html` の `src` が壊れる。触るなら同時に直し、`node tools/check.mjs` で参照を確認する。
- `index.html` は単一ファイルで行番号がすぐズレる。編集は行番号ではなく**文字列一致**で行う。
- 色・余白は `:root` の CSS 変数（`--mint` `--coral` `--charcoal` など）で定義済み。生の色コードを直書きしない。
- アニメーションは `.reveal` クラス + 末尾の IntersectionObserver 1本だけ。新しい要素にも `.reveal` を付ければ動く。
- `.env` が `.gitignore` に入っていなかった（2026-09-03 に修正）。`tools/check.mjs` が毎回この状態を検査する。
- **1080px の上書きが効かない罠。** CSS 前方（ヘッダーの近く）にある `@media (min-width: 1080px)` ブロックにヒーロー等の上書きを足すと、その後ろにあるセクションの `@media (min-width: 900px)` が同じ詳細度で勝ち、1080 で何も変わらない（v4.1 で実際に起きた）。**1080 の上書きは、そのセクションの 900 ブロックの後ろに独立した 1080 ブロックで書く。**
- 日本語の改行: 見出し・ボタン・短い注記は `word-break: auto-phrase` で文節単位に折る（「笑顔／の輪」「こども／食堂」のような泣き別れを防ぐ）。狭い幅で語句が割れたら `<span class="phrase">` で囲む。長い本文の `p` に auto-phrase を付けると行末がガタつくので付けない。
- `tools/check.mjs` のタグ対応チェックは属性値内に `>` があると誤爆する（例: `title="5 > 3"`）。今のところ該当箇所はないが、そういう属性値を書くときは注意する。
- **Chrome 拡張（claude-in-chrome）のスクリーンショットは、そのタブが非表示（`document.hidden === true`）だと真っ白になる。** ユーザーが別ウィンドウを見ていると起きる。代替は headless Chrome: `"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --screenshot=... --window-size=1280,9000 URL`。ただし **headless でも `--window-size` の幅は約 500px 未満にならない**（390px を指定しても viewport は 500px 前後のまま画像だけ 390px に切られ、「はみ出している」ように見える）。狭い幅を正確に見るには、`<iframe width="390">` を並べたラッパー HTML を撮るか、CDP の `Emulation.setDeviceMetricsOverride` を使う（Node 22 標準の `WebSocket` で依存ゼロで書ける）。また `--virtual-time-budget` が短いと `.reveal` の遷移途中（薄い状態）で撮れて「要素が消えている」ように見える。**25000 以上**にする。
- 画像アセットの生成には Python 3.10 + Pillow 12 が使える（`python -c "import PIL"`）。ImageMagick はない。
- **`cd "パス" && grep/cat/head ... 相対パス` は `--dangerously-skip-permissions` 下でも許可プロンプトで止まることがある。** 原因は `.claude/settings.json` の `permissions.deny` に `Read()` ルール（`.env`・`_ ver2.0 _.html` 等）があるため。`cd` の後に相対パスで読むコマンドは、実際にどのファイルを読むか静的に確定できず、deny ルールに触れないか保証できないため確認を求められる（deny は skip-permissions でも上書きされない）。**回避策**: `cd ... &&` でつながず、絶対パスを直接渡す。例: `grep -n "パターン" "C:/Users/晴輝/Documents/pr/ちるーむ/index.html"`。この deny ルールは `.env`・秘密情報保護のために必要なので外さない。

## 検証ループ（最重要・消さない）
- **IMPORTANT: `index.html` を変更したら必ず `node tools/check.mjs` を実行し、exit 0 になるまでコミットしない。**
- 見た目に関わる変更は `node tools/serve.mjs` で実際に開いて確認する。スクリーンショットや curl の結果を証拠として残す。
- エラーは握りつぶさず根本原因を直す。成功を主張する前に証拠を示す（実行したコマンドと出力の要点）。
- 実装と検証は分離する。実装後は `verifier` サブエージェントに検証を依頼し、PASS になるまで直す。
- コミットは論理的な区切りで分ける。

## やってはいけないこと（境界・消さない）
- **YOU MUST NOT: `.env` や認証情報・APIキーをコミットしない。**
- **master への push は即本番公開。** `node tools/check.mjs` が PASS し、表示崩れがないことを確認してから push する。ユーザーが公開を望んでいない変更は push しない（コミットまでで止める）。
- `vercel --prod` を自分から実行しない。デプロイは git push 経由に統一する。
- 単一ファイル構成を壊さない。フレームワーク導入・ファイル分割・npm 依存の追加はスコープ外（必要だと思ったら `gh issue create` に留める）。
- `_ ver2.0 _.html`・`改善点まとめ.pdf`・画像バイナリを手で編集しない。
- スコープ外の大規模リファクタはしない。ただし根本原因の修正に必要な隣接コードは触ってよい。

## エージェントの動き方（ループエンジニアリング・消さない）
- **止まらない。途中で確認を求めない。** 仮定が必要なら合理的なベストを選び、何を仮定したか1行残して進む。
- ゴール未達・エラー発生いずれも止まらない。次の手を自分で決めて続行する（別アプローチ・追加調査など）。
- 数字・日付・仕様はファイルに根拠がない限り使わない。根拠がなければ「仮定:」と明記して進む。
- 複数ファイルにまたがる変更は、プランを先に `.claude/plan.md` へ書いてから実行する。
- ループ中に得た知見・進捗・試みたことは `.claude/loop-result.md` に随時記録する。
- **ループ中にプロジェクト固有の罠を発見したら、即座に「ハマりどころ」セクションに追記する。** 次のループが同じミスを繰り返さない。
- 調査で大量のファイルを読む必要があるときはサブエージェント（Explore）に任せ、本体の文脈を汚さない。

### 停止条件（これ以外は止めない）
1. **完了**: `node tools/check.mjs` が exit 0 で、verifier が PASS を返した
2. **試行上限**: 10 ターン超えても前進なし → 原因と試みたことを `.claude/loop-result.md` に書いて停止

## モデル運用（Fable 5.1 主・Opus 5 予備・消さない）
- 主モデルは **Fable 5.1**。Fable への依頼は「手順」ではなく「到達すべき結果と検証方法」で書かれる前提で動く。
- **Opus で足りる作業は Opus で行う。** `/commit` と `/work-issues` はスキル側で `model: opus` に固定。Fable は設計判断や長時間の自律ループ（`/feature` など）に使う。
- **Fable はプランの週次上限の 50% までしか含まれない。** ステータスラインの `週 xx%` が閾値（既定 45%）に達すると `usage-guard` フックが文脈に警告を注入する。
- **警告を受け取ったら**: 作業は止めずに続けるが、その返答の冒頭で1行だけ「`/model opus` への切替」を促す。モデル切替はユーザーの操作であり、Claude は自分では切り替えられない。同じ警告で何度も促さない（1セッションにつき節目ごとに1回）。
- サブエージェント（verifier / Explore / 汎用）は **sonnet** で動く（`settings.json` の `CLAUDE_CODE_SUBAGENT_MODEL`）。設計判断を伴うレビューが必要なときだけ、呼び出し時に `model: opus` を明示する。
- 週次上限そのものに到達した場合は Claude Code が自動でリセットを待って再開する（`autoContinueAtUsageLimit`、既定 on）。

## GitHub Issue運用（消さない）
- リポジトリ: `yone-haru/nagasaki-childhome`（remote 設定済み・`gh` 利用可）。
- **コード変更を伴う依頼を受けたら**: まず `gh issue create` で記録してから実装する。質問・説明だけの依頼は Issue 化しない。完了したら `gh issue comment` で内容と検証結果を報告し `gh issue close` で閉じる。
- **作業中にスコープ外の問題を見つけたら**: 直さず `gh issue create` で記録するだけにして、今のタスクを続ける。
- **溜まった Issue をまとめて処理するとき**: `/work-issues`。

## コンパクト時の指示
- 圧縮するときは必ず残す: 変更したファイルの一覧 / `node tools/check.mjs` の結果 / verifier の未解決の指摘 / `.claude/plan.md` の完了条件 / 現在のモデルと直近の週次使用率。
