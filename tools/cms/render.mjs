// CMS のデータ（normalize 済み）から index.html を組み立てる。依存なし。
// マークアップは v5.0（a1663a5）の index.html と同じ形を出す。形を変えるときは CSS / JS との対応に注意。

export const SITE_URL = 'https://childhome-nagasaki.vercel.app/';

/* ---------- 文字の扱い ---------- */
export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// [[語句]] → 折り返さないまとまり
function phrase(html) {
  return html.replace(/\[\[(.+?)\]\]/g, '<span class="phrase">$1</span>');
}
// 本文用: エスケープ → [[ ]] → 改行は <br>
export function rich(s, { br = true } = {}) {
  let h = phrase(esc(String(s ?? '').trim()));
  h = br ? h.replace(/\r?\n/g, '<br>') : h.replace(/\s*\r?\n\s*/g, '');
  return h;
}
// 1行 = 1項目
export function lines(s) {
  return String(s ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}
// 本文中で最初に出てくる word をリンクにする（タグの中は触らない）
export function withLink(html, word, link) {
  if (!word || !link) return html;
  const w = esc(word);
  let done = false;
  return html.split(/(<[^>]+>)/).map((part) => {
    if (done || part.startsWith('<')) return part;
    const i = part.indexOf(w);
    if (i < 0) return part;
    done = true;
    return part.slice(0, i) + `<a href="${esc(link.href)}"${extAttrs(link.href)}>${w}</a>` + part.slice(i + w.length);
  }).join('');
}
export function extAttrs(href) {
  return /^https:/i.test(href) ? ' target="_blank" rel="noopener"' : '';
}

/* ---------- 画像 ---------- */
const MICROCMS_IMG = /^https:\/\/images\.microcms-assets\.io\//;
export function imgSrc(img, w) {
  const u = img.url;
  if (!MICROCMS_IMG.test(u)) return u;
  return u + (u.includes('?') ? '&' : '?') + `fm=webp&w=${w}`;
}
// SNS の共有画像は WebP 非対応の所があるので JPEG・1200×630 に切り抜く
function ogSrc(img) {
  const u = img.url;
  if (!MICROCMS_IMG.test(u)) return u;
  return u + (u.includes('?') ? '&' : '?') + 'w=1200&h=630&fit=crop&fm=jpg';
}
function img(image, alt, { w = 1200, lazy = true, extra = '' } = {}) {
  const size = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : '';
  const load = lazy ? ' loading="lazy" decoding="async"' : '';
  return `<img${extra} src="${esc(imgSrc(image, w))}" alt="${esc(alt)}"${size}${load}>`;
}

const ico = (id, cls = 'ico') => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${id}"/></svg>`;
const icoBox = (id) => `<svg class="ico" focusable="false"><use href="#i-${id}"/></svg>`;

/* ---------- 共通の部品 ---------- */
function secHead(sec, { cls = 'sec-head reveal', headingHtml } = {}) {
  const h = headingHtml ?? rich(sec.heading, { br: false });
  return [
    `    <div class="${cls}">`,
    `      <span class="stripe-mark" aria-hidden="true"></span>`,
    `      <h2 id="${sec.id}-title">${h}</h2>`,
    sec.lead ? `      <p class="sec-lead">${rich(sec.lead)}</p>` : '',
    `    </div>`,
  ].filter(Boolean).join('\n');
}
function blockOpen(sec, typeClass, containerClass = 'container') {
  const cls = ['block', sec.tinted ? 'is-tinted' : '', typeClass].filter(Boolean).join(' ');
  return `<section class="${cls}" id="${sec.id}" aria-labelledby="${sec.id}-title">\n  <div class="${containerClass}">`;
}
const blockClose = `  </div>\n</section>`;

/* ---------- セクション ---------- */
const R = {};

R.about = (s) => {
  const media = [];
  if (s.photoMain) media.push(`        <figure class="about-photo about-photo-main">${img(s.photoMain, s.photoMainAlt)}</figure>`);
  if (s.photoSub) media.push(`        <figure class="about-photo about-photo-sub">${img(s.photoSub, s.photoSubAlt)}</figure>`);
  const story = lines(s.story).map((p) => `        <p>${rich(p)}</p>`);
  if (s.nameNote) story.push(`        <p class="about-name">${rich(s.nameNote)}</p>`);
  const out = [
    blockOpen(s, 'about'),
    `    <div class="about-grid">`,
    secHead(s).replace(/^/gm, '  '),
    media.length ? `      <div class="about-media reveal">\n${media.join('\n')}\n      </div>` : '',
    story.length ? `      <div class="about-story reveal">\n${story.join('\n')}\n      </div>` : '',
    `    </div>`,
  ];
  if (s.bridge.length) {
    out.push('', `    <div class="bridge-wrap reveal">`);
    if (s.bridgeTitle) out.push(`      <h3 class="sub-title">${rich(s.bridgeTitle, { br: false })}</h3>`);
    if (s.bridgeIssueLabel || s.bridgeAnswerLabel) {
      out.push(`      <div class="bridge-head" aria-hidden="true"><span>${rich(s.bridgeIssueLabel, { br: false })}</span><span>${rich(s.bridgeAnswerLabel, { br: false })}</span></div>`);
    }
    out.push(`      <ul class="bridge">`);
    for (const r of s.bridge) {
      out.push(`        <li>`,
        `          <p class="bridge-issue">${rich(r.issue)}</p>`,
        `          ${ico('arrow', 'ico bridge-arrow')}`,
        `          <p class="bridge-answer">${rich(r.answer)}</p>`,
        `        </li>`);
    }
    out.push(`      </ul>`, `    </div>`);
  }
  out.push(blockClose);
  return out.filter((x) => x !== '').join('\n');
};

R.activities = (s) => [
  blockOpen(s, 'activities'),
  secHead(s),
  `    <ul class="acts">`,
  ...s.items.map((it) => [
    `      <li class="act reveal">`,
    it.image ? `        <figure class="act-photo">${img(it.image, it.alt)}</figure>` : '',
    `        <h3>${rich(it.title, { br: false })}</h3>`,
    it.text ? `        <p>${rich(it.text)}</p>` : '',
    `      </li>`,
  ].filter(Boolean).join('\n')),
  `    </ul>`,
  blockClose,
].join('\n');

R.day = (s) => {
  const steps = s.steps.map((st, i) => [
    `        <li class="day-step reveal${i === 0 ? ' is-active' : ''}">`,
    `          <figure class="day-photo">${img(st.image, st.alt)}</figure>`,
    `          <span class="day-num" aria-hidden="true">${i + 1}</span>`,
    `          <div class="day-text">`,
    `            <h3>${rich(st.title, { br: false })}</h3>`,
    st.text ? `            <p>${rich(st.text)}</p>` : '',
    `          </div>`,
    `        </li>`,
  ].filter(Boolean).join('\n'));
  const stage = s.steps.map((st, i) => `          ${img(st.image, '', { extra: i === 0 ? ' class="is-active"' : '' })}`);
  return [
    blockOpen(s, 'day'),
    secHead(s),
    `    <div class="day-layout">`,
    `      <ol class="day-steps">`,
    ...steps,
    `      </ol>`,
    `      <div class="day-stage" aria-hidden="true">`,
    `        <div class="day-stage-frame">`,
    ...stage,
    `        </div>`,
    `        <p class="day-stage-cap"><span class="day-stage-num">1</span><span class="day-stage-title">${rich(s.steps[0].title, { br: false })}</span></p>`,
    `      </div>`,
    `    </div>`,
    blockClose,
  ].join('\n');
};

R.promise = (s) => [
  blockOpen(s, ''),
  secHead(s),
  `    <ul class="promise-grid reveal">`,
  ...s.items.map((it) => [
    `      <li class="promise">`,
    `        <span class="promise-ico" aria-hidden="true">${icoBox(it.icon)}</span>`,
    `        <h3>${rich(it.title, { br: false })}</h3>`,
    it.text ? `        <p>${rich(it.text)}</p>` : '',
    `      </li>`,
  ].filter(Boolean).join('\n')),
  `    </ul>`,
  blockClose,
].join('\n');

R.flow = (s, ctx) => {
  const st = ctx.settings;
  const out = [
    blockOpen(s, 'flow'),
    secHead(s),
    `    <div class="flow-grid">`,
    `      <ol class="steps reveal">`,
    ...s.steps.map((it, i) => [
      `        <li class="step">`,
      `          <span class="step-num" aria-hidden="true">${i + 1}</span>`,
      `          <div>`,
      `            <h3>${rich(it.title, { br: false })}</h3>`,
      it.text ? `            <p>${rich(it.text)}</p>` : '',
      it.note ? `            <p class="step-note">${ico('heart')}${rich(it.note)}</p>` : '',
      `          </div>`,
      `        </li>`,
    ].filter(Boolean).join('\n')),
    `      </ol>`,
  ];
  const side = [];
  if (s.asideTitle || s.asideText || s.asideButton) {
    side.push(`        <aside class="line-card reveal" aria-labelledby="flow-aside-title">`,
      `          <h3 id="flow-aside-title">${rich(s.asideTitle, { br: false })}</h3>`);
    if (s.asideText) side.push(`          <p>${rich(s.asideText)}</p>`);
    if (s.asideButton) {
      side.push(`          <a class="btn btn-primary" href="${esc(st.lineUrl)}" target="_blank" rel="noopener">`,
        `            ${ico('line', 'ico ico-line')}`,
        `            ${rich(s.asideButton, { br: false })}`,
        `          </a>`);
    }
    if (st.lineId) side.push(`          <p class="line-id">LINE ID: ${esc(st.lineId)}</p>`);
    side.push(`        </aside>`);
  }
  const bring = lines(s.bringItems);
  if (bring.length) {
    side.push(`        <aside class="bring reveal" aria-labelledby="bring-title">`,
      `          <h3 id="bring-title">${rich(s.bringTitle, { br: false })}</h3>`,
      `          <ul class="check-list">`,
      ...bring.map((b) => `            <li>${ico('check')}${rich(b)}</li>`),
      `          </ul>`);
    if (s.bringNote) side.push(`          <p class="bring-note">${rich(s.bringNote)}</p>`);
    side.push(`        </aside>`);
  }
  if (side.length) out.push(`      <div class="flow-side">`, ...side, `      </div>`);
  out.push(`    </div>`, blockClose);
  return out.join('\n');
};

R.gallery = (s, ctx) => {
  const st = ctx.settings;
  const out = [
    blockOpen(s, 'gallery'),
    secHead(s),
    `    <ul class="gallery-grid reveal">`,
    ...s.photos.map((p, i) => `      <li class="g g${(i % 8) + 1}">${img(p.image, p.alt)}</li>`),
    `    </ul>`,
  ];
  const texts = [];
  if (s.footText) texts.push(`        <p>${rich(s.footText)}</p>`);
  if (s.policyText) texts.push(`        <p class="photo-policy">${rich(s.policyText)}</p>`);
  const button = s.buttonLabel && st.instagramUrl;
  if (texts.length || button) {
    out.push(`    <div class="gallery-foot reveal">`, `      <div>`, ...texts, `      </div>`);
    if (button) {
      out.push(`      <a class="btn btn-outline btn-sm" href="${esc(st.instagramUrl)}" target="_blank" rel="noopener">`,
        `        ${ico('instagram')}`,
        `        ${rich(s.buttonLabel, { br: false })}`,
        `      </a>`);
    }
    out.push(`    </div>`);
  }
  out.push(blockClose);
  return out.join('\n');
};

function faqGroup(title, items, cls, ctx) {
  if (!items.length) return '';
  return [
    `      <div class="${cls}">`,
    title ? `        <h3 class="faq-group-title">${rich(title, { br: false })}</h3>` : '',
    ...items.map((q) => [
      `        <details class="faq-item">`,
      `          <summary>${rich(q.question, { br: false })}<span class="plus" aria-hidden="true"></span></summary>`,
      `          <div class="faq-body">`,
      `            <p>${withLink(rich(q.answer), q.linkWord, ctx.link(q))}</p>`,
      `          </div>`,
      `        </details>`,
    ].join('\n')),
    `      </div>`,
  ].filter(Boolean).join('\n');
}
R.faq = (s, ctx) => {
  const st = ctx.settings;
  const head = [`    <div class="faq-head">`, secHead(s).replace(/^/gm, '  ')];
  if (s.buttonLabel) {
    head.push(`      <a class="btn btn-soft btn-sm reveal" href="${esc(st.lineUrl)}" target="_blank" rel="noopener">`,
      `        ${ico('line', 'ico ico-line')}`,
      `        ${rich(s.buttonLabel, { br: false })}`,
      `      </a>`);
  }
  head.push(`    </div>`);
  return [
    blockOpen(s, 'faq', 'container faq-grid'),
    ...head,
    `    <div class="faq-groups">`,
    faqGroup(s.studentTitle, s.studentItems, 'faq-group reveal', ctx),
    faqGroup(s.partnerTitle, s.partnerItems, 'faq-group is-partner reveal', ctx),
    `    </div>`,
    blockClose,
  ].filter(Boolean).join('\n');
};

function channel(kind, href, iconId, name, id) {
  return [
    `        <a class="channel is-${kind}" href="${esc(href)}"${extAttrs(href)}>`,
    `          <span class="channel-icon" aria-hidden="true">${icoBox(iconId)}</span>`,
    `          <span class="channel-text">`,
    `            <span class="channel-name">${name}</span>`,
    id ? `            <span class="channel-id">${esc(id)}</span>` : '',
    `          </span>`,
    `          ${ico('chev', 'ico channel-chev')}`,
    `        </a>`,
  ].filter(Boolean).join('\n');
}
R.join = (s, ctx) => {
  const st = ctx.settings;
  const wanted = lines(s.wantedItems);
  const left = [];
  if (s.photo) left.push(`        <figure class="join-photo">${img(s.photo, s.photoAlt)}</figure>`);
  if (s.wantedTitle) left.push(`        <h3>${rich(s.wantedTitle, { br: false })}</h3>`);
  if (wanted.length) left.push(`        <ul class="check-list">`, ...wanted.map((w) => `          <li>${ico('check')}${rich(w)}</li>`), `        </ul>`);
  const ch = [];
  if (s.lineLabel) ch.push(channel('line', st.lineUrl, 'line', rich(s.lineLabel, { br: false }) + (s.lineTag ? `<span class="tag">${rich(s.lineTag, { br: false })}</span>` : ''), st.lineId));
  if (s.instagramLabel && st.instagramUrl) ch.push(channel('instagram', st.instagramUrl, 'instagram', rich(s.instagramLabel, { br: false }), st.instagramId));
  if (s.mailLabel) ch.push(channel('mail', 'mailto:' + st.email, 'mail', rich(s.mailLabel, { br: false }), st.email));
  if (s.channelNote) ch.push(`        <p class="channel-note">${rich(s.channelNote)}</p>`);

  const out = [
    `<section class="join" id="join" aria-labelledby="join-title">`,
    `  <div class="container">`,
    secHead(s, { cls: 'join-head reveal', headingHtml: rich(s.heading) }),
    `    <div class="join-grid">`,
    left.length ? `      <div class="wanted reveal">\n${left.join('\n')}\n      </div>` : '',
    ch.length ? `      <div class="channels reveal">\n${ch.join('\n')}\n      </div>` : '',
    `    </div>`,
  ];
  if (s.showPartner) {
    const plist = lines(s.partnerItems);
    out.push('',
      `    <section class="partner reveal" id="partner" aria-labelledby="partner-title">`,
      `      <div class="partner-main">`,
      `        <span class="stripe-mark" aria-hidden="true"></span>`,
      `        <h2 id="partner-title">${rich(s.partnerHeading, { br: false })}</h2>`);
    if (s.partnerText) out.push(`        <p>${rich(s.partnerText)}</p>`);
    if (plist.length) out.push(`        <ul class="partner-list">`, ...plist.map((p) => `          <li>${rich(p)}</li>`), `        </ul>`);
    if (s.partnerButton) {
      out.push(`        <div class="partner-actions">`,
        `          <a class="btn btn-outline" href="mailto:${esc(st.email)}">`,
        `            ${ico('mail')}`,
        `            ${rich(s.partnerButton, { br: false })}`,
        `          </a>`,
        `          <span class="mail-text">${esc(st.email)}</span>`,
        `        </div>`);
    }
    out.push(`      </div>`);
    if (s.consultSteps.length) {
      out.push(`      <div class="consult">`);
      if (s.consultTitle) out.push(`        <h3>${rich(s.consultTitle, { br: false })}</h3>`);
      out.push(`        <ol>`,
        ...s.consultSteps.map((c, i) => `          <li><span class="consult-num" aria-hidden="true">${i + 1}</span><div><strong>${rich(c.title, { br: false })}</strong>${c.text ? `<p>${rich(c.text)}</p>` : ''}</div></li>`),
        `        </ol>`,
        `      </div>`);
    }
    out.push(`    </section>`);
  }
  out.push(`  </div>`, `</section>`);
  return out.filter((x) => x !== '').join('\n');
};

R.profile = (s, ctx) => {
  const st = ctx.settings;
  const rows = s.rows.map((r) => `      <div><dt>${rich(r.label, { br: false })}</dt><dd>${rich(r.value)}</dd></div>`);
  if (s.contactLabel) {
    rows.push(`      <div><dt>${rich(s.contactLabel, { br: false })}</dt><dd><a href="${esc(st.lineUrl)}" target="_blank" rel="noopener">${rich(s.contactLineLabel, { br: false })}</a> / <a href="mailto:${esc(st.email)}">${rich(s.contactMailLabel, { br: false })}</a></dd></div>`);
  }
  return [
    blockOpen(s, 'profile', 'container profile-grid'),
    secHead(s),
    rows.length ? `    <dl class="profile-list reveal">\n${rows.join('\n')}\n    </dl>` : '',
    blockClose,
  ].filter(Boolean).join('\n');
};

R.connect = (s, ctx) => {
  const st = ctx.settings;
  const list = [
    ['instagram', st.instagramUrl, 'Instagram', st.instagramId, s.instagramDesc],
    ['line', st.lineUrl, 'LINE公式アカウント', st.lineId, s.lineDesc],
    ['facebook', st.facebookUrl, 'Facebook', '', s.facebookDesc],
    ['linkedin', st.linkedinUrl, 'LinkedIn', '', s.linkedinDesc],
  ].filter((x) => x[1]);
  return [
    blockOpen(s, 'connect'),
    secHead(s),
    `    <ul class="sns-list reveal">`,
    ...list.map(([k, href, name, id, desc]) => [
      `      <li>`,
      `        <a class="sns-item is-${k}" href="${esc(href)}" target="_blank" rel="noopener">`,
      `          <span class="sns-icon" aria-hidden="true">${icoBox(k)}</span>`,
      `          <span class="sns-text">`,
      `            <span class="sns-name">${name}</span>`,
      id ? `            <span class="sns-id">${esc(id)}</span>` : '',
      desc ? `            <span class="sns-desc">${rich(desc, { br: false })}</span>` : '',
      `          </span>`,
      `        </a>`,
      `      </li>`,
    ].filter(Boolean).join('\n')),
    `    </ul>`,
    blockClose,
  ].join('\n');
};

R.free = (s, ctx) => {
  const link = ctx.link(s);
  let linked = false;
  const paras = lines(s.body).map((p) => {
    let h = rich(p);
    if (!linked) { const h2 = withLink(h, s.linkWord, link); linked = h2 !== h; h = h2; }
    return `      <p>${h}</p>`;
  });
  return [
    blockOpen(s, 'free'),
    secHead(s),
    paras.length ? `    <div class="free-body reveal">\n${paras.join('\n')}\n    </div>` : '',
    s.image ? `    <figure class="free-photo reveal">${img(s.image, s.imageAlt)}</figure>` : '',
    blockClose,
  ].filter(Boolean).join('\n');
};

/* ---------- ヒーロー・お知らせ ---------- */
function hero(top, ctx) {
  const slides = top.heroSlides;
  const multi = slides.length > 1;
  const figs = slides.map((sl, i) => i === 0
    ? `      <figure class="hero-slide is-active">${img(sl.image, sl.alt, { w: 1920, lazy: false })}</figure>`.replace(/(<img[^>]*?)>/, '$1 fetchpriority="high">')
    : `      <figure class="hero-slide" aria-hidden="true">${img(sl.image, sl.alt, { w: 1920 })}</figure>`);
  const out = [
    `<section class="hero" id="top" aria-labelledby="hero-title">`,
    `  <div class="hero-media">`,
    `    <div class="hero-slides">`,
    ...figs,
    `    </div>`,
  ];
  if (multi) {
    out.push(`    <div class="hero-controls" role="group" aria-label="写真のスライドショー" hidden>`,
      `      <button class="hero-toggle" type="button" aria-label="スライドショーを一時停止">`,
      `        ${ico('pause', 'ico ico-pause')}`,
      `        ${ico('play', 'ico ico-play')}`,
      `      </button>`,
      `      <div class="hero-dots">`,
      ...slides.map((_, i) => `        <button class="hero-dot" type="button" aria-label="写真 ${i + 1} を表示"${i === 0 ? ' aria-current="true"' : ''}></button>`),
      `      </div>`,
      `    </div>`);
  }
  out.push(`  </div>`,
    `  <div class="hero-panel">`,
    `    <div class="hero-panel-inner">`,
    `      <h1 class="hero-logo" id="hero-title"><img src="chiroom-logo.png" alt="${esc(ctx.settings.siteName)}" width="1200" height="467"></h1>`);
  if (top.heroCopy) out.push(`      <p class="hero-copy">${rich(top.heroCopy)}</p>`);
  if (top.heroLead) out.push(`      <p class="hero-lead">${rich(top.heroLead)}</p>`);
  const actions = [];
  if (top.heroPrimaryLabel) actions.push(`        <a class="btn btn-primary" href="${esc(ctx.settings.lineUrl)}" target="_blank" rel="noopener">${ico('line', 'ico ico-line')}${rich(top.heroPrimaryLabel, { br: false })}</a>`);
  if (top.heroSecondaryLabel && ctx.secondaryTarget) actions.push(`        <a class="btn btn-outline" href="#${ctx.secondaryTarget}">${rich(top.heroSecondaryLabel, { br: false })}</a>`);
  if (actions.length) out.push(`      <div class="hero-actions">`, ...actions, `      </div>`);
  const sub = [];
  if (top.heroPartnerLabel && ctx.hasPartner) sub.push(`        <p class="hero-partner"><a href="#partner">${rich(top.heroPartnerLabel, { br: false })}</a></p>`);
  if (top.heroAffilLabel) sub.push(`        <p class="hero-affil"><img src="nagasaki-u.png" alt="" width="2363" height="827">${rich(top.heroAffilLabel, { br: false })}</p>`);
  if (sub.length) out.push(`      <div class="hero-sub">`, ...sub, `      </div>`);
  out.push(`    </div>`, `  </div>`, `</section>`);
  return out.join('\n');
}

// 日付は日本時間で表示する
function jstDate(iso) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  const y = d.getUTCFullYear(), m = p(d.getUTCMonth() + 1), day = p(d.getUTCDate());
  return { attr: `${y}-${m}-${day}`, label: `${y}.${m}.${day}` };
}
function news(items, ctx) {
  if (!items.length) return '';
  return [
    `<section class="news" id="news" aria-labelledby="news-title">`,
    `  <div class="container news-inner">`,
    `    <h2 class="news-title" id="news-title">${rich(ctx.newsTitle, { br: false })}</h2>`,
    `    <ul class="news-list">`,
    ...items.map((n) => {
      const date = n.date
        ? (() => { const j = jstDate(n.date); return `<time class="news-date" datetime="${j.attr}">${j.label}</time>`; })()
        : `<span class="news-date">${rich(n.dateLabel, { br: false })}</span>`;
      return [`      <li>`, `        ${date}`, `        <span>${withLink(rich(n.body), n.linkWord, ctx.link(n))}</span>`, `      </li>`].join('\n');
    }),
    `    </ul>`,
    `  </div>`,
    `</section>`,
  ].join('\n');
}

/* ---------- ナビ・フッター ---------- */
function navItems(sections) {
  // [{id, menu, header, footer}] を画面に出る順で
  const out = [];
  for (const s of sections) {
    out.push({ id: s.id, menu: s.menuLabel, header: s.headerLabel, footer: s.footerLabel || s.menuLabel });
    if (s.type === 'join' && s.showPartner && s.partnerMenuLabel) {
      out.push({ id: 'partner', menu: s.partnerMenuLabel, header: '', footer: s.partnerMenuLabel });
    }
  }
  return out;
}

/* ---------- ページ全体 ---------- */
export function renderPage(template, data) {
  const { settings: st, top, news: newsItems } = data;
  const sections = top.sections;
  const link = (o) => {
    switch (o.linkTo) {
      case 'メール': return { href: 'mailto:' + st.email };
      case 'LINE': return st.lineUrl ? { href: st.lineUrl } : null;
      case 'Instagram': return st.instagramUrl ? { href: st.instagramUrl } : null;
      case 'URLを入力': return o.linkUrl ? { href: o.linkUrl } : null;
      default: return null;
    }
  };
  const ids = sections.map((s) => s.id);
  const ctx = {
    settings: st,
    link,
    newsTitle: top.newsTitle,
    hasPartner: sections.some((s) => s.type === 'join' && s.showPartner),
    secondaryTarget: ids.includes('activities') ? 'activities' : ids[0],
  };

  const main = [hero(top, ctx), news(newsItems, ctx), ...sections.map((s) => R[s.type](s, ctx))].filter(Boolean).join('\n\n');

  const nav = navItems(sections);
  const headerNav = nav.filter((n) => n.header).slice(0, 5).map((n) => `        <li><a href="#${n.id}">${rich(n.header, { br: false })}</a></li>`).join('\n');
  const menuNav = nav.filter((n) => n.menu).map((n) => `    <li><a class="menu-link" href="#${n.id}">${rich(n.menu, { br: false })}${ico('chev')}</a></li>`).join('\n');
  const footerNav = nav.filter((n) => n.footer).map((n) => `          <li><a href="#${n.id}">${rich(n.footer, { br: false })}</a></li>`).join('\n');

  const sns = [
    ['instagram', st.instagramUrl, 'Instagram'],
    ['line', st.lineUrl, 'LINE公式アカウント'],
    ['facebook', st.facebookUrl, 'Facebook'],
    ['linkedin', st.linkedinUrl, 'LinkedIn'],
  ].filter((x) => x[1]);
  const menuSns = sns.filter((x) => x[0] !== 'line')
    .map(([k, href, name]) => `    <a href="${esc(href)}" target="_blank" rel="noopener" aria-label="${name}">${ico(k)}</a>`).join('\n');
  const footerSns = [
    ...sns.map(([k, href, name]) => `          <li><a href="${esc(href)}" target="_blank" rel="noopener">${ico(k)}${name}</a></li>`),
    `          <li><a href="mailto:${esc(st.email)}">${ico('mail')}${esc(st.email)}</a></li>`,
  ].join('\n');

  const ldObj = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: st.siteName,
    alternateName: st.siteAltName,
    description: st.jsonldDescription || st.description,
    url: SITE_URL,
    logo: SITE_URL + 'ogp.png',
    email: st.email,
    areaServed: st.areaServed,
    sameAs: [st.instagramUrl, st.facebookUrl, st.linkedinUrl, st.lineUrl].filter(Boolean),
  };
  const jsonld = JSON.stringify(ldObj, null, 2).replace(/</g, '\\u003c');

  const first = top.heroSlides[0];
  const heroPreload = first ? `<link rel="preload" as="image" href="${esc(imgSrc(first.image, 1920))}" fetchpriority="high">` : '';
  const jstYear = new Date(Date.now() + 9 * 3600 * 1000).getUTCFullYear();

  const tokens = {
    title: esc(st.siteTitle),
    description: esc(st.description),
    ogDescription: esc(st.ogDescription || st.description),
    ogImage: esc(st.ogImage ? ogSrc(st.ogImage) : SITE_URL + 'ogp.png'),
    heroPreload,
    jsonld,
    lineUrl: esc(st.lineUrl),
    email: esc(st.email),
    headerNav, menuNav, menuSns, footerNav, footerSns,
    main,
    footerText: rich(st.footerText),
    year: String(jstYear),
    copyright: esc(st.copyright),
    stickyText: esc(st.stickyText),
    stickySub: esc(st.stickySub),
    stickyButton: esc(st.stickyButton),
    siteName: esc(st.siteName),
    headerLineLabel: esc(st.headerLineLabel),
    menuMailLabel: esc(st.menuMailLabel),
    footerNavTitle: esc(st.footerNavTitle),
    footerSnsTitle: esc(st.footerSnsTitle),
    toTopLabel: esc(st.toTopLabel),
  };
  // 置換は1回で（差し込んだ文章の中の {{ }} を再び置換しない）
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m));
}
