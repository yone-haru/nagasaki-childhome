---
paths:
  - "index.html"
---

# index.html の規約（単一ファイル構成）

このサイトは `index.html` 1枚に CSS と JS を内包している。以下を守れば構成が崩れない。

## 構成の順序
`<head>`（meta / Google Fonts / `<style>`）→ `<body>` 直後に `<section class="hero">`（id なし）→ 以降 `<section>` 群 → `<footer>` → 末尾の `<script>` 1本。**`<header>` タグは存在しない。** ナビゲーション等を足すときも `<header>` を新設せず既存構成に合わせる。
セクションは `hero → about → activities → gallery → join → connect → contact` の順（id 付きは about 以降の6つ）。新しいセクションもこの並びに沿って挿入する。

## CSS
- 色・フォントは `:root` の変数を使う（`--mint` `--mint-soft` `--mint-deep` `--coral` `--coral-soft` `--coral-deep` `--yellow` `--teal` `--cream` `--charcoal` `--charcoal-soft` `--charcoal-faint`）。**生の色コードを直書きしない。** 新色が要るときは `:root` に変数を足してから使う。
- 幅は `.wrap`（max-width 720px / padding 24px）に載せる。モバイル前提のデザインなので、独自の max-width を作らない。
- 見出しは `.eyebrow`（英字ラベル）＋ `.section-title`（Hachi Maru Pop）の組で書く。
- フォントサイズの可変には `clamp()` を使う（既存の書き方に合わせる）。
- 新しい CSS は、その要素が属するセクションの既存スタイルの近くに書く。ファイル末尾にまとめて足さない。

## アニメーション
- スクロール表示は `.reveal` クラスだけで動く（末尾の IntersectionObserver が `.visible` を付ける）。遅延は `.reveal-delay-1`〜`.reveal-delay-4`（0.08s刻み）。
- 新しいライブラリ（GSAP・AOS 等）を入れない。JS は末尾の 1 ブロックに閉じる。

## リンクとアセット
- 内部リンクは `href="#about"` のようにセクション id を指す。**id を変えるときはリンク側も同時に直す**（`node tools/check.mjs` が検出する）。
- 画像は必ず `alt` を書く。ファイル名に日本語や全角スペースが含まれるものがあるので、`src` はファイル名と厳密に一致させる。
- 外部リソースは https のみ。ライブラリ CDN は追加しない（フォント以外の外部依存を増やさない方針）。

## 編集の作法
- 行番号はすぐズレる。**文字列一致で編集する。**
- 変更したら `node tools/check.mjs`、見た目に関わるなら `node tools/serve.mjs` で実際に開いて確認する。
