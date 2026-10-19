---
paths:
  - "site/template.html"
  - "tools/cms/render.mjs"
---

# サイト HTML の規約（v5.0 ＋ microCMS）

出来上がるサイトは `dist/index.html` 1枚（CSS と JS を内包）。元は2つに分かれている:
- `site/template.html`: v5.0 の `index.html` から作ったテンプレート。`<head>`・CSS・JS・アイコン・ヘッダー/フッターの枠を持ち、中身は `{{名前}}` の差し込み口。
- `tools/cms/render.mjs`: 差し込む中身（ヒーロー・お知らせ・各セクション・ナビ）の HTML を作る。マークアップを変えるときはここ。
`dist/` は生成物なので手で直さない。以下の規約は両方に当てはまる。

## 構成の順序
`<head>`（meta / OGP / favicon / Google Fonts / JSON-LD / `<style>`）→ `<body>`:
`a.skip-link` → `svg.sprite`（アイコン定義）→ `header.site-header`（固定ヘッダー・PC ナビ・LINE ボタン・ハンバーガー）→ `nav.mobile-menu` → `<main id="main">` 内のセクション群 → `footer.site-footer` → `div.sticky-cta`（モバイル固定 CTA）→ 末尾の `<script>` 1本。

セクションは `hero(#top) → news(#news) → about(#about) → activities(#activities) → day(#day) → promise(#promise) → flow(#flow) → gallery(#gallery) → faq(#faq) → join(#join, 内部に #partner) → profile(#profile, 団体概要) → connect(#connect)` の順。（これは見本データ `cms/seed/top.json` の並び。本番の並びは microCMS の「セクション」の順で決まる。id はセクションの種類ごとに固定、自由セクションは `free-1`, `free-2`…）ナビはヘッダー（主要5項目）・モバイルメニュー・フッターの3か所にあり、**3か所とも render.mjs がセクションの並びと各セクションの表示名から作る**。手で書かない（`node tools/check.mjs` がアンカー切れを検出する）。PC のヘッダーナビは 1080px で6項目目が入らないので、食堂・地域の方向けの `#partner` へはヒーローの CTA 下にある `.hero-partner` のリンクで案内している。

## CSS
- 色・影・書体・角丸は `:root` の変数を使う。**生の色コードを直書きしない。** 新色が要るときは `:root` に変数を足してから使う。インライン SVG の `fill` / `stroke` も `var(--coral)` のように変数で書く。
  - ブランド色: `--brand-sky` `--mint` `--mint-soft` `--mint-deep` `--teal` `--coral` `--coral-soft` `--coral-deep` `--yellow` `--yellow-soft`
  - 文字・地: `--ink` `--charcoal` `--charcoal-soft` `--charcoal-faint`（装飾専用）`--line` `--paper`
  - **文字・リンクの緑は `--teal-text`**（`--teal` は白地で 2.8:1 しかないので装飾専用）。`--coral-deep` も大きな文字・装飾だけに使う
  - SNS の公式色: `--line-green` `--facebook-blue` `--linkedin-blue`
  - 半透明・影: `--ink-06/10/14` `--glass` `--glass-strong` `--shadow-sm` `--shadow-md` `--shadow-float`
  - その他: `--font-body` `--font-head` `--radius-lg/md/sm` `--header-h` `--ease-out`
- 幅は `.container`（`min(100% - 40px, 1120px)`）に載せる。独自の max-width を作らない。
- セクション見出しは `.sec-head`（`.stripe-mark` ＋ `h2` ＋ `.sec-lead`）の組で書く。英字の eyebrow・全大文字ラベルは使わない。
- セクションの外枠は `section.block`（余白）と `.is-tinted`（ミント地）で切り替える。
- ボタンは `.btn` ＋ `.btn-primary` / `.btn-outline` / `.btn-soft`（`.btn-sm` で小型）。ボタン・リンクの文言に「→」を付けない。
- 同じ形のカードを並べない。並ぶものは行リスト・罫線で区切った1枚のパネル・タイムラインなど、中身に合った形にする。番号は本当に順序があるもの（参加の流れ・ある日の活動・相談の流れ）だけ。
- レスポンシブは **min-width 640px / 900px / 1080px** の3段階（1080 はヘッダーのナビ・ヒーロー・わたしたちのこと・活動内容・ある日の活動・ギャラリー・フッターの間隔）。**グリッド直下に画像を置くときは親に `min-width: 0` か `minmax(0, 1fr)` を付ける**（画像の固有幅で横にはみ出す）。
- **1080px の上書きは、そのセクションの 900px ブロックより後ろに、独立した `@media (min-width: 1080px)` で書く。** ファイル前方のヘッダー用 1080 ブロックに混ぜると、後ろにある 900 のルールに負けて効かない。
- 新しい CSS は、その要素が属するセクションの既存スタイルの近くに書く。ファイル末尾にまとめて足さない。

## 日本語の改行
- 見出し・ボタン・短い注記（h1〜h4・summary・dt・dd・li・figcaption・`.btn`・`.sec-lead` など）には `word-break: auto-phrase` が効いている。新しい短い注記クラスを作ったらこの一覧に足す。
- 長い本文の `p` には auto-phrase を付けない（行末がガタつくため）。`p`・`li`・`dd` は `text-wrap: pretty` で行末の1文字残りを防いでいる。
- 途中で折りたくない語句は `<span class="phrase">こども食堂</span>` のように囲む。

## アイコン
- アイコンは `body` 直後の `svg.sprite` に `<symbol id="i-...">` で定義し、`<svg class="ico" aria-hidden="true" focusable="false"><use href="#i-line"/></svg>` で使う。外部アイコンライブラリは入れない。
- 線画アイコンは `stroke="currentColor"` で書き、色は親の `color` で決める。

## アニメーション
- スクロール表示は `.reveal` クラスだけで動く（末尾の IntersectionObserver が `.visible` を付ける）。遅延クラスはない。`prefers-reduced-motion` では全停止する。
- 自動再生はヒーローの全画面スライドショー（`.hero-slide` 5枚・6秒ごと）だけ。他に自動再生のモーションを増やさない。
  - 一時停止ボタン `.hero-toggle` と点 `.hero-dot` は必須（WCAG 2.2.2）。ヒーローが画面外・タブが裏のときは止まる。`prefers-reduced-motion` の人には止まった状態で始める。
  - 写真を増減するときは `.hero-slide` と `.hero-dot` の数を揃える。
- 「ある日の活動」はスクロール連動（IntersectionObserver `rootMargin: -45% 0px -45% 0px`）。画面の真ん中の手順に `is-active`、前の手順に `is-done` が付き、PC では右の写真・番号・見出しが切り替わる。
- 新しいライブラリ（GSAP・AOS 等）を入れない。JS は末尾の 1 ブロックに閉じる。

## リンクとアセット
- 内部リンクは `href="#about"` のようにセクション id を指す。外部リンクは `target="_blank" rel="noopener"`。
- 画像は必ず `alt` を書く（装飾画像は `alt=""`）。ロゴは `chiroom-logo.png`（透過・トリミング済み）、大学ロゴは `nagasaki-u.png`、OGP は `ogp.png`、favicon は `favicon-32.png` / `favicon-512.png` / `apple-touch-icon.png`。
- 写真は `photos/` にある（`hero-1〜5` `about-1〜2` `act-1〜4` `day-1〜6` `gallery-1〜8` `join`）。**今は仮の画像。** 本物の写真に替えるときは同じファイル名・同じ縦横比で上書きし、`alt` を写真の中身に合わせて直す。推奨サイズと場面は各セクションの HTML コメントに書いてある。
  - 顔や名前が分かる写真は、こども食堂と保護者の許可を得たものだけ使う。
  - **仮の画像が残っているうちは本番に公開しない。**
- 本番ドメインは `https://childhome-nagasaki.vercel.app/`。canonical / og:url / og:image / JSON-LD の `url` に絶対 URL で書いてある。独自ドメインに変えたら4か所すべて直す。
- 外部リソースは https のみ。ライブラリ CDN は追加しない（フォント以外の外部依存を増やさない方針）。

## 文言
- 「わたしたちのこと」の3段落、キャッチコピー「ごはんで繋がる、笑顔の輪」、ヒーロー説明文、「こどもとのふれあい」の説明文は `改善点まとめ.pdf` で指定された文言。勝手に変えない。
- 文言の実体は microCMS（初期値は `cms/seed/*.json`）。本番の文言を直すのは依頼主で、コードでは直さない。v5.0 で `<!-- 要確認 -->` だった箇所（参加費・持ち物・当日の流れ・写真の方針・相談の流れ・FAQ の一部・写真の場面・団体概要の活動頻度と連携先）は仮定。サークルに確認して直す。

## 編集の作法
- 行番号はすぐズレる。**文字列一致で編集する。**
- 変更したら `node tools/check.mjs`、見た目に関わるなら `node tools/serve.mjs` で実際に開いて確認する（1280 / 900 / 390px）。
