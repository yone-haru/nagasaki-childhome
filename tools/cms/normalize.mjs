// microCMS の生データ（settings / top / news）を、render.mjs が使える形にそろえる。
// 入力ミスで壊れたページを出さないように、ここで検査する。
//   - 致命的（ページが成り立たない）→ throw（ビルド失敗。本番は直前の版のまま）
//   - 直せる・無視できる → warnings に入れて、その項目を外して続ける

const SECTION_TYPES = ['about', 'activities', 'day', 'promise', 'flow', 'gallery', 'faq', 'join', 'profile', 'connect', 'free'];
const ICONS = { 'クリップボード': 'clipboard', 'しずく': 'drop', 'カギ': 'lock', 'ふたり': 'pair', 'ハート': 'heart', 'チェック': 'check' };
const LINK_TO = ['メール', 'LINE', 'Instagram', 'URLを入力'];
const MAX_NEWS = 5;
const MAX_HEADER = 5;

export class CmsError extends Error {}

const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
// セレクトは配列で返ってくる（単一選択でも）
const sel = (v) => str(Array.isArray(v) ? v[0] : v);
const bool = (v) => v === true;
const image = (v) => (v && typeof v === 'object' && str(v.url) ? { url: str(v.url), width: Number(v.width) || 0, height: Number(v.height) || 0 } : null);
const arr = (v) => (Array.isArray(v) ? v : []);

export function safeUrl(u) {
  const s = str(u);
  if (!s) return '';
  if (s.startsWith('#')) return s;
  try {
    const p = new URL(s);
    return ['https:', 'mailto:', 'tel:'].includes(p.protocol) ? s : '';
  } catch { return ''; }
}

export function normalize(raw) {
  const warnings = [];
  const warn = (m) => warnings.push(m);
  if (!raw || !raw.settings || !raw.top) throw new CmsError('「サイト設定」または「トップページ」のデータがありません。');

  /* ---------- サイト設定 ---------- */
  const s = raw.settings;
  const settings = {
    siteTitle: str(s.siteTitle),
    description: str(s.description),
    ogDescription: str(s.ogDescription),
    ogImage: image(s.ogImage),
    lineUrl: safeUrl(s.lineUrl),
    lineId: str(s.lineId),
    instagramUrl: safeUrl(s.instagramUrl),
    instagramId: str(s.instagramId),
    facebookUrl: safeUrl(s.facebookUrl),
    linkedinUrl: safeUrl(s.linkedinUrl),
    email: str(s.email),
    jsonldDescription: str(s.jsonldDescription),
    footerText: str(s.footerText),
    stickyText: str(s.stickyText),
    stickySub: str(s.stickySub),
    stickyButton: str(s.stickyButton),
    copyright: str(s.copyright),
    // 空なら v5.0 の文言を使う
    siteName: str(s.siteName) || 'ちるーむ',
    siteAltName: str(s.siteAltName) || 'ちゃいるどほーむ',
    areaServed: str(s.areaServed) || '長崎県',
    headerLineLabel: str(s.headerLineLabel) || 'LINEで相談する',
    menuMailLabel: str(s.menuMailLabel) || 'メールで問い合わせる',
    footerNavTitle: str(s.footerNavTitle) || 'サイトマップ',
    footerSnsTitle: str(s.footerSnsTitle) || 'つながる',
    toTopLabel: str(s.toTopLabel) || 'ページの先頭へ',
  };
  if (!settings.siteTitle) throw new CmsError('サイト設定の「サイトのタイトル」が空です。');
  if (!settings.lineUrl) throw new CmsError('サイト設定の「LINE の URL」が空か、https:// で始まっていません。');
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(settings.email)) throw new CmsError('サイト設定の「メールアドレス」が空か、形がおかしいです。');
  for (const [k, label] of [['instagramUrl', 'Instagram'], ['facebookUrl', 'Facebook'], ['linkedinUrl', 'LinkedIn']]) {
    if (str(s[k]) && !settings[k]) warn(`サイト設定の「${label} の URL」が https:// で始まっていないので使いません。`);
  }

  /* ---------- リンク（本文中の語句をリンクにする） ---------- */
  const linkOf = (o, where) => {
    const linkWord = str(o.linkWord);
    const linkTo = sel(o.linkTo);
    if (!linkWord) return { linkWord: '', linkTo: '', linkUrl: '' };
    if (!LINK_TO.includes(linkTo)) { warn(`${where}: 「リンクにする語句」はあるのに「リンク先」が選ばれていないので、リンクにしません。`); return { linkWord: '', linkTo: '', linkUrl: '' }; }
    let linkUrl = '';
    if (linkTo === 'URLを入力') {
      linkUrl = safeUrl(o.linkUrl);
      if (!linkUrl) { warn(`${where}: リンク先の URL が空か https:// で始まっていないので、リンクにしません。`); return { linkWord: '', linkTo: '', linkUrl: '' }; }
    }
    if (linkTo === 'Instagram' && !settings.instagramUrl) { warn(`${where}: Instagram の URL が未設定なので、リンクにしません。`); return { linkWord: '', linkTo: '', linkUrl: '' }; }
    return { linkWord, linkTo, linkUrl };
  };

  /* ---------- トップページ ---------- */
  const t = raw.top;
  const heroSlides = arr(t.heroSlides).map((x, i) => {
    const img = image(x.image);
    if (!img) { warn(`ヒーローの写真 ${i + 1} に画像がないので外しました。`); return null; }
    return { image: img, alt: str(x.alt) };
  }).filter(Boolean);
  if (!heroSlides.length) throw new CmsError('ヒーローの写真が1枚もありません。最低1枚は入れてください。');

  const top = {
    heroSlides,
    heroCopy: str(t.heroCopy),
    heroLead: str(t.heroLead),
    heroPrimaryLabel: str(t.heroPrimaryLabel),
    heroSecondaryLabel: str(t.heroSecondaryLabel),
    heroPartnerLabel: str(t.heroPartnerLabel),
    heroAffilLabel: str(t.heroAffilLabel),
    newsTitle: str(t.newsTitle) || 'お知らせ',
    sections: [],
  };

  const seen = new Set();
  let freeN = 0;
  arr(t.sections).forEach((x, i) => {
    const type = str(x.fieldId).replace(/^sec_/, '');
    const where = `セクション ${i + 1}`;
    if (!SECTION_TYPES.includes(type)) { warn(`${where}: 知らない種類（${x.fieldId}）なので外しました。`); return; }
    if (type !== 'free' && seen.has(type)) { warn(`${where}: 「${type}」は1回しか使えないので、2つ目以降は外しました。`); return; }
    const sec = {
      type,
      menuLabel: str(x.menuLabel),
      headerLabel: str(x.headerLabel),
      footerLabel: str(x.footerLabel),
      tinted: type === 'join' ? false : bool(x.tinted),
      heading: str(x.heading),
      lead: str(x.lead),
    };
    if (!sec.heading) { warn(`${where}（${type}）: 見出しが空なので外しました。`); return; }
    const built = SECTION[type](x, sec, `${where}（${sec.heading}）`, { warn, linkOf });
    if (!built) return;
    seen.add(type);
    built.id = type === 'free' ? `free-${++freeN}` : type;
    top.sections.push(built);
  });
  if (!top.sections.length) throw new CmsError('表示できるセクションが1つもありません。');

  const headers = top.sections.filter((x) => x.headerLabel);
  if (headers.length > MAX_HEADER) {
    warn(`ヘッダーのメニューは${MAX_HEADER}個までです。6個目以降（${headers.slice(MAX_HEADER).map((x) => x.headerLabel).join('・')}）は出しません。`);
    headers.slice(MAX_HEADER).forEach((x) => { x.headerLabel = ''; });
  }
  top.sections.forEach((x, i) => {
    const next = top.sections[i + 1];
    if (x.tinted && next && next.tinted) warn(`「${x.heading}」と「${next.heading}」がどちらも色付き背景で、境目が見えにくくなります。`);
  });

  /* ---------- お知らせ ---------- */
  const rawNews = arr(raw.news && raw.news.contents ? raw.news.contents : raw.news);
  const newsAll = rawNews.map((n, i) => {
    const body = str(n.body);
    if (!body) { warn(`お知らせ ${i + 1}: 本文が空なので外しました。`); return null; }
    const date = str(n.date);
    const valid = date && !Number.isNaN(new Date(date).getTime());
    const dateLabel = str(n.dateLabel);
    if (!valid && !dateLabel) { warn(`お知らせ「${body.slice(0, 15)}」: 日付も「日付の代わりの文字」も空なので外しました。`); return null; }
    return { date: valid ? date : '', dateLabel, body, ...linkOf(n, `お知らせ「${body.slice(0, 15)}」`), _i: i };
  }).filter(Boolean);
  const dated = newsAll.filter((n) => n.date).sort((a, b) => new Date(b.date) - new Date(a.date));
  const undated = newsAll.filter((n) => !n.date);
  const news = [...dated, ...undated].slice(0, MAX_NEWS).map(({ _i, ...n }) => n);
  if (newsAll.length > MAX_NEWS) warn(`お知らせは新しい順に${MAX_NEWS}件だけ表示します（${newsAll.length}件あります）。`);

  return { data: { settings, top, news }, warnings };
}

/* ---------- セクションごとの整形 ---------- */
// 中身が1つもないセクションは、見出しだけの枠を出さずに外す（下書き途中の公開対策）
const dropEmpty = (warn, where, what) => { warn(`${where}: ${what}が1つもないので、セクションごと外しました。`); return null; };
const SECTION = {
  about(x, sec) {
    return {
      ...sec,
      photoMain: image(x.photoMain), photoMainAlt: str(x.photoMainAlt),
      photoSub: image(x.photoSub), photoSubAlt: str(x.photoSubAlt),
      story: str(x.story), nameNote: str(x.nameNote),
      bridgeTitle: str(x.bridgeTitle), bridgeIssueLabel: str(x.bridgeIssueLabel), bridgeAnswerLabel: str(x.bridgeAnswerLabel),
      bridge: arr(x.bridge).map((r) => ({ issue: str(r.issue), answer: str(r.answer) })).filter((r) => r.issue || r.answer),
    };
  },
  activities(x, sec, where, { warn }) {
    // 写真は任意（ない項目は文字だけで出す）
    const items = arr(x.items).filter((r) => str(r.title))
      .map((r) => ({ image: image(r.image), alt: str(r.alt), title: str(r.title), text: str(r.text) }));
    if (!items.length) return dropEmpty(warn, where, '題名のある項目');
    return { ...sec, items };
  },
  day(x, sec, where, { warn }) {
    const steps = [];
    arr(x.steps).forEach((r, i) => {
      const img = image(r.image);
      if (!str(r.title)) return;
      if (!img) { warn(`${where}: ステップ ${i + 1}「${str(r.title)}」に写真がないので外しました（この欄は写真が必須です）。`); return; }
      steps.push({ image: img, alt: str(r.alt), title: str(r.title), text: str(r.text) });
    });
    if (!steps.length) { warn(`${where}: 写真のあるステップが1つもないので、セクションごと外しました。`); return null; }
    return { ...sec, steps };
  },
  promise(x, sec, where, { warn }) {
    const items = arr(x.items).filter((r) => str(r.title)).map((r) => {
      const label = sel(r.icon);
      if (label && !ICONS[label]) warn(`${where}: アイコン「${label}」は使えないので、クリップボードにしました。`);
      return { icon: ICONS[label] || 'clipboard', title: str(r.title), text: str(r.text) };
    });
    if (!items.length) return dropEmpty(warn, where, '題名のある項目');
    return { ...sec, items };
  },
  flow(x, sec, where, { warn }) {
    const steps = arr(x.steps).filter((r) => str(r.title)).map((r) => ({ title: str(r.title), text: str(r.text), note: str(r.note) }));
    if (!steps.length) return dropEmpty(warn, where, '題名のある手順');
    return {
      ...sec,
      steps,
      asideTitle: str(x.asideTitle), asideText: str(x.asideText), asideButton: str(x.asideButton),
      bringTitle: str(x.bringTitle), bringItems: str(x.bringItems), bringNote: str(x.bringNote),
    };
  },
  gallery(x, sec, where, { warn }) {
    const photos = arr(x.photos).map((r) => ({ image: image(r.image), alt: str(r.alt) })).filter((r) => r.image);
    if (!photos.length) return dropEmpty(warn, where, '写真');
    return { ...sec, photos, footText: str(x.footText), policyText: str(x.policyText), buttonLabel: str(x.buttonLabel) };
  },
  faq(x, sec, where, { warn, linkOf }) {
    const items = (list) => arr(list).filter((q) => str(q.question) && str(q.answer))
      .map((q) => ({ question: str(q.question), answer: str(q.answer), ...linkOf(q, `${where}「${str(q.question).slice(0, 15)}」`) }));
    const studentItems = items(x.studentItems), partnerItems = items(x.partnerItems);
    if (!studentItems.length && !partnerItems.length) return dropEmpty(warn, where, '質問と答えがそろった項目');
    return {
      ...sec,
      buttonLabel: str(x.buttonLabel),
      studentTitle: str(x.studentTitle), studentItems,
      partnerTitle: str(x.partnerTitle), partnerItems,
    };
  },
  join(x, sec) {
    return {
      ...sec,
      photo: image(x.photo), photoAlt: str(x.photoAlt),
      wantedTitle: str(x.wantedTitle), wantedItems: str(x.wantedItems),
      lineLabel: str(x.lineLabel), lineTag: str(x.lineTag), instagramLabel: str(x.instagramLabel), mailLabel: str(x.mailLabel),
      channelNote: str(x.channelNote),
      showPartner: bool(x.showPartner),
      partnerMenuLabel: str(x.partnerMenuLabel), partnerHeading: str(x.partnerHeading) || 'こども食堂・地域の方へ',
      partnerText: str(x.partnerText), partnerItems: str(x.partnerItems), partnerButton: str(x.partnerButton),
      consultTitle: str(x.consultTitle),
      consultSteps: arr(x.consultSteps).filter((c) => str(c.title)).map((c) => ({ title: str(c.title), text: str(c.text) })),
    };
  },
  profile(x, sec, where, { warn }) {
    const rows = arr(x.rows).filter((r) => str(r.label) && str(r.value)).map((r) => ({ label: str(r.label), value: str(r.value) }));
    if (!rows.length) return dropEmpty(warn, where, '項目名と内容がそろった行');
    return {
      ...sec,
      rows,
      contactLabel: str(x.contactLabel),
      contactLineLabel: str(x.contactLineLabel) || '公式LINE',
      contactMailLabel: str(x.contactMailLabel) || 'メール',
    };
  },
  connect(x, sec) {
    return { ...sec, instagramDesc: str(x.instagramDesc), lineDesc: str(x.lineDesc), facebookDesc: str(x.facebookDesc), linkedinDesc: str(x.linkedinDesc) };
  },
  free(x, sec, where, { linkOf }) {
    return { ...sec, body: str(x.body), image: image(x.image), imageAlt: str(x.imageAlt), ...linkOf(x, where) };
  },
};
