---
paths:
  - "index.html"
---

# index.html の規約（単一ファイル構成・v4.0）

このサイトは `index.html` 1枚に CSS と JS を内包している。以下を守れば構成が崩れない。

## 構成の順序
`<head>`（meta / OGP / favicon / Google Fonts / JSON-LD / `<style>`）→ `<body>`:
`a.skip-link` → `header.site-header`（固定ヘッダー・PC ナビ・LINE ボタン・ハンバーガー）→ `div.mobile-menu` → `<main id="main">` 内のセクション群 → `footer.site-footer` → `div.sticky-cta`（モバイル固定 CTA）→ 末尾の `<script>` 1本。

セクションは `hero(#top) → news(#news) → about(#about) → activities(#activities) → flow(#flow) → gallery(#gallery) → faq(#faq) → join(#join, 内部に #partner) → connect(#connect)` の順。ヘッダー・モバイルメニュー・フッターの3か所にナビがあるので、**セクションを足す／id を変えるときは3か所とも直す**（`node tools/check.mjs` がアンカー切れを検出する）。

## CSS
- 色・書体・角丸は `:root` の変数を使う（`--brand-sky` `--mint` `--mint-soft` `--mint-deep` `--teal` `--coral` `--coral-soft` `--coral-deep` `--yellow` `--yellow-soft` `--ink` `--charcoal` `--charcoal-soft` `--charcoal-faint` `--line` `--paper`、`--font-body` `--font-head`、`--radius-lg/md/sm`）。**生の色コードを直書きしない。** 新色が要るときは `:root` に変数を足してから使う。インライン SVG の `fill` / `stroke` も `var(--coral)` のように変数で書く。
- 幅は `.container`（`min(100% - 40px, 1120px)`）に載せる。独自の max-width を作らない。
- セクション見出しは `.sec-head`（`.stripe-mark` ＋ `h2` ＋ `.sec-lead`）の組で書く。英字の eyebrow は使わない。
- セクションの外枠は `section.block`（余白）と `.is-tinted`（ミント地）で切り替える。
- ボタンは `.btn` ＋ `.btn-primary` / `.btn-outline` / `.btn-soft`（`.btn-sm` で小型）。
- レスポンシブは min-width 640px / 900px の2段階。**グリッド直下に画像を置くときは親に `min-width: 0` か `minmax(0, 1fr)` を付ける**（画像の固有幅で横にはみ出す）。
- 新しい CSS は、その要素が属するセクションの既存スタイルの近くに書く。ファイル末尾にまとめて足さない。

## アニメーション
- スクロール表示は `.reveal` クラスだけで動く（末尾の IntersectionObserver が `.visible` を付ける）。遅延は `.reveal-delay-1`〜`-3`。`prefers-reduced-motion` では全停止する。
- ヒーローの登場アニメーション（`hero-rise`）はページ表示時に1回だけ。他に自動再生のモーションを増やさない。
- 新しいライブラリ（GSAP・AOS 等）を入れない。JS は末尾の 1 ブロックに閉じる。

## リンクとアセット
- 内部リンクは `href="#about"` のようにセクション id を指す。
- 画像は必ず `alt` を書く（装飾画像は `alt=""`）。ロゴは `chiroom-logo.png`（透過・トリミング済み）、大学ロゴは `nagasaki-u.png`、OGP は `ogp.png`、favicon は `favicon-32.png` / `favicon-512.png` / `apple-touch-icon.png`。
- 本番ドメインは `https://childhome-nagasaki.vercel.app/`。canonical / og:url / og:image / JSON-LD の `url` に絶対 URL で書いてある。独自ドメインに変えたら4か所すべて直す。
- 外部リソースは https のみ。ライブラリ CDN は追加しない（フォント以外の外部依存を増やさない方針）。

## 文言
- 「わたしたちのこと」の3段落、キャッチコピー「ごはんで繋がる、笑顔の輪」、ヒーロー説明文、「こどもとのふれあい」の説明文は `改善点まとめ.pdf` で指定された文言。勝手に変えない。
- FAQ の回答のうち `<!-- 要確認 -->` コメントが付いているものは仮定。サークルに確認して直す。

## 編集の作法
- 行番号はすぐズレる。**文字列一致で編集する。**
- 変更したら `node tools/check.mjs`、見た目に関わるなら `node tools/serve.mjs` で実際に開いて確認する。
