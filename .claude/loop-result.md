# ループ実行ログ

<!-- 自律タスク中の進捗・知見・試みたこと(失敗含む)を Claude がここへ追記する(CLAUDE.md 参照)。 -->
<!-- 新しいエントリは日付見出しで上に追加する。 -->

## 2026-10-18 クオリティ向上 v4.1（Issue #2）

**やったこと**: v4.0 の方向性（ミント×コーラル×イエロー・ロゴタイプが主役）を保ったまま `index.html` を作り直した（約1250行→約1550行）。
- ヒーロー: 「笑顔の輪」を上から見た丸テーブルの SVG に。ページ表示時に1回だけ席が順に置かれる（`seat-in`）。湯気の無限アニメは撤去。参加のめやす（dl）を追加
- 新セクション: **ある日の活動**（`#day`・タイムライン）、**活動で大切にしていること**（`#promise`・2×2 の罫線リスト）
- 既存セクションの強化: 「こども食堂って？」、参加の流れに持ち物・服装、ギャラリーに写真の方針、FAQ を「学生の方 / 食堂・地域の方」の2グループに、参加するに「こんな人を待っています」、食堂向けの相談の流れ（`#partner`）
- アイコンを `svg.sprite` の `<symbol>` に集約。生の rgba をすべて `:root` のトークンへ。同じ形のカードの羅列をやめ、行リスト・タイムライン・罫線リストに
- ブレークポイントに 1080px を追加（ヘッダーのナビ・ヒーローの比率・活動内容の4列・フッター）

**知見・判断**
- **1080px の上書きが効かなかった。** ヘッダー近くの 1080 ブロックに足したヒーローの上書きが、後ろにある 900 のルール（同じ詳細度）に負けていた。セクションの 900 ブロックの後ろに独立した 1080 ブロックを置いて解決。CLAUDE.md のハマりどころに追記
- 日本語の泣き別れ（「笑顔／の輪」「こども／食堂」、li の末尾に「人」1文字）: 見出し・ボタン・短い注記に `word-break: auto-phrase`、`p`/`li`/`dd` に `text-wrap: pretty`、割れては困る語句に `span.phrase`。長い本文 p に auto-phrase を付けると行末がガタつくので付けない
- フッターのメールアドレスが 900px で列からはみ出した → 3列目を `auto` に
- スクリーンショットは CDP（`Emulation.setDeviceMetricsOverride`）の自作スクリプトで 1280 / 900 / 390 の全ページを撮影。全ページ撮影では固定 CTA がヒーローに重なって写るが、撮影方法による見え方で実機では起きない

**仮定（`<!-- 要確認 -->` 10か所・サークルに聞く）**: 参加費・交通費、当日の流れ、写真と個人情報の扱い、持ち物、写真の公開方針、調理の担当、他大学生の参加、連絡の目安、食堂向けの相談の流れ

**検証**
- `node tools/check.mjs` → エラー 0 / 警告 0 / exit 0
- 1280 / 900 / 390px の全ページを目視。崩れ・横スクロールなし（390: scrollWidth = clientWidth = 390）
- verifier: **PASS**（[must] 0件・[should] 3件・[nit] 4件）
  - [should] ヒーロー説明文が「こども食/堂」「広/げる」で折れる → `.hero-lead` を auto-phrase の対象に足し、「こども食堂」を `span.phrase` で囲んだ（文言は変えていない）。1280 / 900 / 390 で文節の切れ目で折れることを確認
  - [should] 「写真準備中」の文字が淡色地で 3.8〜4.4:1 → `--charcoal` に。[nit]「長崎大学 認定サークル」（4.49:1）も `--charcoal` に
  - [should] 写真がない段階で写真の方針が「掲載しています」と断定 → 「写真を載せるときは…ようにします」に
  - [nit] モバイルメニューを開いたらフォーカスを最初のリンクへ移す（390px で確認）。役割のない div の `aria-labelledby` を削除
  - 未対応（サークルの確認待ち）: ある日の活動・大切にしていること・持ち物・相談の流れ・参加費などは `<!-- 要確認 -->` のまま。公開前にサークルに確認する
- Codex テスト: （未実施）

## 2026-09-04 サイト全面リニューアル v4.0（Issue #1）

**やったこと**: `index.html` を全面書き換え（880行→約1250行）。固定ヘッダー＋モバイルメニュー、実物ロゴタイプを主役にしたヒーロー（自作 SVG イラスト付き）、お知らせ / わたしたちのこと（団体概要・課題→答え）/ 活動内容 / 参加までの流れ / 活動の様子 / よくある質問 / 参加する（学生向け・こども食堂向けを分離）/ SNS / フッター / モバイル固定 CTA。SEO（canonical・OGP・JSON-LD・favicon）とアクセシビリティ（スキップリンク・focus-visible・aria・reduced-motion）を整備。書体を Zen Maru Gothic + Zen Kaku Gothic New に統一（Hachi Maru Pop / Fraunces 廃止）。

**アセット**: `チルーム_アイコン_透過 .png` から Pillow で `chiroom-logo.png`（トリミング＋96色量子化で 281KB→39KB）、`favicon-*.png` / `apple-touch-icon.png`（「ち」1文字）、`ogp.png`（1200×630）を生成。

**知見・判断**
- 本番ドメインは `vercel` CLI では取れなかった（Not authorized）。`curl` で候補を当てて `childhome-nagasaki.vercel.app` が現行サイトを返すことを確認し、絶対 URL に採用。
- Chrome 拡張のスクリーンショットはタブ非表示で真っ白になる → headless Chrome に切替。headless は最小幅 ≈500px で 390px 指定が効かず「はみ出し」に見えた（誤検知）。iframe ラッパーで 390/768px を撮り直して崩れなしを確認。CDP（Node 22 標準 WebSocket）でも実 viewport の挙動を検証。
- グリッド直下の `img`（`width: min(100%, 560px)`）は `min-width: auto` のままだと固有幅ではみ出しうるので、`.hero .container > *` 等に `min-width: 0` を付けた。
- `.btn` の `white-space: nowrap` は狭い枠（flow-aside）でボタンがはみ出す原因になったので、折り返し可にして `.btn-sm` だけ nowrap。
- ギャラリー仮画像は最初ぼかしグラデにしたが「壊れて見える」ため、ストライプ＋破線枠の「枠が用意されている」見た目に変更。小さい枠は文字を隠しアイコンのみ。

**仮定（要確認・サークルに聞く）**: FAQ の「参加費無料」「他大学生も歓迎」「通年募集」、参加までの流れ（LINE→見学・体験→活動）、団体概要の「活動地域: 長崎県内」。HTML コメント `<!-- 要確認 -->` を付けてある。

**検証**
- `node tools/check.mjs` → エラー 0 / 警告 0 / exit 0
- headless Chrome 1280px 全体・iframe 390px / 768px 全体を目視。崩れなし
- JS 挙動: モバイルメニュー開閉（click / Escape / リンク押下）、FAQ 開閉、著作権年、横スクロールなし（scrollWidth ≤ innerWidth）を確認
- CDP（390px 実 viewport）: ヘッダーのスクロール状態・固定 CTA の表示/非表示（join 表示中は隠れる）・メニュー展開・1280px でナビ表示/固定 CTA 非表示を確認
- verifier: **PASS**（[should] 2件・[nit] 3件）
  - [should] `--teal` を文字色に使うと白地で 2.84:1 → 文字・リンク用に `--teal-text`(#2A7469, 5.5:1) を追加して置換。装飾アイコンの teal / charcoal-faint も濃色に変更（nit 対応）
  - [should] CLAUDE.md の書体記述が旧構成のまま → 更新
  - [nit] `rgba(...)` の直書き 8か所（box-shadow・半透明地）は変数にアルファ付き値がないため許容。plan.md の favicon 名称ずれ → 修正

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
