# プラン: サイトの文言を全部 CMS から変えられるようにする（#11）

## 目的
直書きで CMS から変えられない文言をなくす。ちるーむ側が確認して全部 microCMS で直せる状態にする。

## 追加するフィールド（空なら今の文言を使う）
settings（サイト設定）:
- siteName「ちるーむ」: ロゴの代替テキスト（ヘッダー・ヒーロー・フッター）・「◯◯ トップへ」・og:site_name・JSON-LD name
- siteAltName「ちゃいるどほーむ」: JSON-LD alternateName
- areaServed「長崎県」: JSON-LD areaServed
- headerLineLabel「LINEで相談する」: ヘッダー・スマホメニューの LINE ボタン
- menuMailLabel「メールで問い合わせる」: スマホメニューのメールボタン
- footerNavTitle「サイトマップ」/ footerSnsTitle「つながる」/ toTopLabel「ページの先頭へ」
top（トップページ）:
- newsTitle「お知らせ」（heroAffilLabel の後ろ）
- sec_profile: contactLineLabel「公式LINE」/ contactMailLabel「メール」

## 直書きのまま残すもの
- 読み上げ専用のラベル（本文へ移動・スライドショー操作・メニュー開閉）、SNS のサービス名

## 変更するファイル
cms/schema/settings.json, cms/schema/top.json, cms/seed/settings.json, cms/seed/top.json,
tools/cms/normalize.mjs, tools/cms/render.mjs, site/template.html, docs/cms-fields.md, docs/cms-manual.md

## 完了条件
- `node tools/check.mjs` exit 0
- 見本データでビルドした dist/index.html が変更前と同一
- 新フィールドに別の値を入れると出力が変わる（scratchpad で確認）
- verifier PASS
