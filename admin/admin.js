/* =====================================================================
   Administrácia webu T SERVICE, s.r.o.
   Obsah webu je v repozitári (_data/*.json). Uloženie = jeden commit cez backend
   webhunter-admin (Cloudflare Worker, id sk-tservice); GitHub Action potom web
   pregeneruje (~1 min). Vzor: administrace Breu / VOYAGE (8. 11. 2026).
   Prihlásenie menom a heslom: backend overuje jeden tajný reťazec „meno:heslo“
   (meno sa porovnáva bez ohľadu na veľké a malé písmená).
   ===================================================================== */
'use strict';
(() => {
const CFG = {
  id: 'sk-tservice', site: '../',
  api: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.search.includes('local') ? 'http://localhost:8787' : 'https://webhunter-admin.webhunter.workers.dev',
};
const FILES = { texty: '_data/texty.json', sluzby: '_data/sluzby.json', skupiny: '_data/skupiny.json', galeria: '_data/galeria.json', tim: '_data/tim.json', site: '_data/site.json' };
const LABEL = { texty: 'Texty', sluzby: 'Služby', skupiny: 'Skupiny služieb', galeria: 'Galéria', tim: 'Tím', site: 'Kontakty' };
const SK = 'tservice_admin';
const S = { sess: null, user: '', D: {}, snap: {}, pending: {}, preview: {}, saving: false, lib: null };
/* ---------------------------------------------------------------- ikony */
const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  home: I('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  users: I('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.3.3 4 2.2 4.5 5.4"/>'),
  text: I('<path d="M5 6h14M5 11h14M5 16h9"/>'),
  phone: I('<path d="M4 6l8 6 8-6"/><rect x="3" y="5" width="18" height="14" rx="2"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-2.8 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.8-1.2 2 2 0 1 1-2.8-2.8A1.7 1.7 0 0 0 3.3 14a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.8 2 2 0 1 1 2.8-2.8A1.7 1.7 0 0 0 10 3.3a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.8 1.2 2 2 0 1 1 2.8 2.8A1.7 1.7 0 0 0 20.7 10a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.3 1z"/>'),
  help: I('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h0"/>'),
  ext: I('<path d="M14 4h6v6M20 4L10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
  menu: I('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  x: I('<path d="M18 6L6 18M6 6l12 12"/>'),
  up: I('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: I('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  left: I('<path d="M15 18l-6-6 6-6"/>'),
  right: I('<path d="M9 18l6-6-6-6"/>'),
  trash: I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  chev: I('<path d="M6 9l6 6 6-6"/>'),
  eye: I('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'),
  upload: I('<path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  image: I('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
  logout: I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  mic: I('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  bolt: I('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h0"/>'),
};
const LOGO = '<span class="adm-logo"><img src="../logo.png" alt="T SERVICE" width="139" height="39"></span>';
/* ---------------------------------------------------------------- utils */
const $ = (s, c = document) => c.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 8);
const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
/* náhľad fotky: nahrané (img/uploads/…) sú na webe v origináli, pôvodné fotky webu majú zmenšeninu v admin/orig/ */
const imgSrc = (p) => {
  if (!p) return '';
  if (S.preview[p]) return S.preview[p];
  if (/^(https?:|blob:|data:)/.test(p)) return p;
  if (p.startsWith('img/uploads/')) return CFG.site + p;
  return CFG.site + 'admin/orig/' + p.replace(/\.[^.]+$/, '').replace(/\//g, '-') + '.webp';
};
const secret = (user, pw) => `${String(user).trim().toLowerCase()}:${pw}`;

function h(sel, props = {}, ...kids) {
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}
function toast(title, sub = '', type = '') {
  const el = h('div.toast' + (type ? '.' + type : ''), {}, h('b', {}, title), sub ? h('small', {}, sub) : null);
  $('#toasts').append(el);
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 450); }, type === 'err' ? 7000 : 4000);
}
function modal({ title, body, actions = [] }) {
  return new Promise((resolve) => {
    const close = (v) => { bg.remove(); resolve(v); };
    const box = h('div.modal', { role: 'dialog', 'aria-modal': 'true' }, h('h2', {}, title));
    if (typeof body === 'string') box.append(h('div', { html: body })); else if (body) box.append(body);
    box.append(h('div.modal-actions', {}, actions.map((a) => h('button.btn' + (a.cls ? '.' + a.cls : ''), { type: 'button', onclick: () => close(typeof a.value === 'function' ? a.value(box) : a.value) }, a.label))));
    const bg = h('div.modal-bg', { onclick: (e) => { if (e.target === bg) close(null); } }, box);
    $('#modal-root').append(bg);
    const f = box.querySelector('input,textarea,select,button.btn-primary'); if (f) setTimeout(() => f.focus(), 50);
  });
}
const confirmDlg = (title, text, ok = 'Zmazať', cls = 'btn-dark') => modal({ title, body: `<p>${esc(text)}</p>`, actions: [{ label: 'Zrušiť', value: false }, { label: ok, cls, value: true }] }).then((v) => v === true);

/* ---------------------------------------------------------------- API */
const b64e = (bytes) => { let s = ''; bytes = new Uint8Array(bytes); for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const utf8b64 = (str) => b64e(new TextEncoder().encode(str));
function saveSess() { localStorage.setItem(SK, JSON.stringify({ t: S.sess, u: S.user, exp: Date.now() + 11.5 * 3600e3 })); }
/* backend odpovedá česky – pre klienta preložíme najčastejšie hlášky */
function skMsg(status, m, path) {
  if (path === '/login' && status === 401) return 'Nesprávne meno alebo heslo.';
  if (status === 429) return 'Príliš veľa neúspešných pokusov. Skúste to prosím o 15 minút.';
  if (status === 401) return 'Prihlásenie vypršalo. Prihláste sa prosím znova.';
  if (status === 403 && /heslo/i.test(m)) return 'Súčasné heslo nesúhlasí.';
  if (status === 413) return 'Súbor je príliš veľký.';
  if (status >= 500) return 'Server teraz neodpovedá. Skúste to prosím o chvíľu.';
  return m;
}
async function api(path, opt = {}, retried = false) {
  const headers = { ...(typeof opt.body === 'string' ? { 'Content-Type': 'application/json' } : {}) };
  if (S.sess) headers.Authorization = 'Bearer ' + S.sess;
  let r;
  try { r = await fetch(`${CFG.api}/api/${CFG.id}${path}`, { ...opt, headers, cache: 'no-store' }); }
  catch { throw new Error('Nedá sa spojiť so serverom. Skontrolujte pripojenie na internet.'); }
  if (r.status === 401 && path !== '/login' && path !== '/password' && !retried && S.D.site) { if (await reauth()) return api(path, opt, true); }
  if (!r.ok) { let m = r.statusText; try { m = (await r.json()).error || m; } catch {} const e = new Error(skMsg(r.status, m, path)); e.status = r.status; throw e; }
  return opt.raw ? r.text() : r.json();
}
const readFile = (p) => api('/file?path=' + encodeURIComponent(p) + '&t=' + Date.now(), { raw: true });
async function commit(files, message) {
  const out = []; const queue = [...files];
  const worker = async () => { while (queue.length) { const f = queue.shift(); const { sha } = await api('/blob', { method: 'POST', body: JSON.stringify({ content: f.b64 ?? utf8b64(f.content), encoding: 'base64' }) }); out.push({ path: f.path, sha }); } };
  await Promise.all([worker(), worker(), worker()]);
  return (await api('/commit', { method: 'POST', body: JSON.stringify({ files: out, message }) })).sha;
}
async function reauth() {
  const inp = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Heslo' });
  const pw = await modal({ title: 'Prihlásenie vypršalo', body: h('div', {}, h('p', {}, `Zadajte prosím znova heslo pre meno „${S.user}“. Rozpracované zmeny zostanú zachované.`), inp), actions: [{ label: 'Zrušiť', value: null }, { label: 'Prihlásiť', cls: 'btn-primary', value: () => inp.value }] });
  if (!pw) return false;
  try { const r = await api('/login', { method: 'POST', body: JSON.stringify({ password: secret(S.user, pw) }) }); S.sess = r.token; saveSess(); return true; }
  catch (e) { toast('Prihlásenie sa nepodarilo', e.message, 'err'); return false; }
}

/* ---------------------------------------------------------------- data */
async function loadAll() {
  const keys = Object.keys(FILES);
  const res = await Promise.all(keys.map((k) => readFile(FILES[k]).then(JSON.parse)));
  keys.forEach((k, i) => { S.D[k] = res[i]; });
  snapshot();
}
function snapshot(keys = Object.keys(FILES)) { keys.forEach((k) => { S.snap[k] = JSON.stringify(S.D[k]); }); }
const dirtyKeys = () => Object.keys(FILES).filter((k) => S.D[k] && JSON.stringify(S.D[k]) !== S.snap[k]);
const changed = debounce(() => updateSavebar(), 100);
window.addEventListener('beforeunload', (e) => { if (dirtyKeys().length) { e.preventDefault(); e.returnValue = ''; } });

function validate() {
  const T = S.D.texty;
  if (!String(T.hero.nadpis || '').trim()) return 'Hlavný nadpis v úvode nesmie byť prázdny.';
  for (const s of S.D.sluzby) if (!String(s.nazev || '').trim()) return 'Jedna služba nemá názov.';
  for (const g of S.D.skupiny) if (!String(g.nazev || '').trim()) return 'Jedna skupina služieb nemá názov.';
  for (const c of S.D.tim) if (!String(c.meno || '').trim()) return 'Jeden člen tímu nemá meno.';
  for (const g of S.D.galeria) if (!g.foto) return 'V galérii je položka bez fotky.';
  const k = S.D.site.kontakt || {};
  if (k.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(k.email)) return 'E-mail v Kontaktoch nevyzerá správne.';
  return null;
}
async function saveAll() {
  const keys = dirtyKeys();
  if (!keys.length || S.saving) return;
  const err = validate(); if (err) return toast('Nedá sa uložiť', err, 'err');
  S.saving = true; updateSavebar();
  const bar = h('div.progress-line'); document.body.append(bar);
  try {
    const keys2 = dirtyKeys();
    if (keys2.includes('site')) {   // technické polia (adresa náhľadu, doména, formulár, menu) nastavujeme my – vziať aktuálne z repozitára
      const cur = JSON.parse(await readFile(FILES.site));
      ['slug', 'url', 'base', 'domena', 'navrh', 'formular', 'nav', 'lang', 'typ', 'og_image', 'theme_color', 'logo'].forEach((k) => { if (k in cur) S.D.site[k] = cur[k]; });
    }
    const files = keys2.map((k) => ({ path: FILES[k], content: JSON.stringify(S.D[k], null, k === 'site' ? 2 : 1) + '\n' }));
    const used = JSON.stringify(S.D);
    const imgs = Object.keys(S.pending).filter((p) => used.includes(p));
    imgs.forEach((p) => files.push({ path: p, b64: S.pending[p] }));
    const sha = await commit(files, keys2.map((k) => LABEL[k]).join(', ') + (imgs.length ? ` (+${imgs.length} foto)` : ''));
    imgs.forEach((p) => delete S.pending[p]);
    snapshot(keys2);
    toast('Uložené', 'Zmeny sa na webe objavia približne o minútu.', 'ok');
    watchPublish(sha);
  } catch (e) { toast('Uloženie sa nepodarilo', e.message, 'err'); }
  finally { S.saving = false; bar.remove(); updateSavebar(); }
}
function discard() { dirtyKeys().forEach((k) => { S.D[k] = JSON.parse(S.snap[k]); }); updateSavebar(); route(); toast('Zmeny zahodené'); }

/* zverejnenie — čaká, kým version.json na webe obsahuje nový commit */
let pubTimer = null;
function setPub(state, text) { const el = $('.pub'); if (el) { el.className = 'pub ' + state; el.innerHTML = `<i></i><span>${esc(text)}</span>`; } }
function watchPublish(sha) {
  localStorage.setItem(SK + '_pub', JSON.stringify({ sha, t: Date.now() }));
  clearInterval(pubTimer); setPub('busy', 'Zverejňujem zmeny…');
  const t0 = Date.now();
  pubTimer = setInterval(async () => {
    try {
      const v = await fetch(CFG.site + 'version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json());
      if (v.sha === sha) { clearInterval(pubTimer); localStorage.removeItem(SK + '_pub'); setPub('', 'Web je aktuálny'); toast('Zmeny sú na webe', 'Web bol práve aktualizovaný.', 'ok'); S.lib = null; return; }
    } catch {}
    if (Date.now() - t0 > 8 * 60000) { clearInterval(pubTimer); setPub('warn', 'Zverejnenie trvá dlhšie'); }
  }, 6000);
}
function initPub() { const p = JSON.parse(localStorage.getItem(SK + '_pub') || 'null'); if (p && Date.now() - p.t < 10 * 60000) watchPublish(p.sha); else setPub('', 'Web je aktuálny'); }

/* ---------------------------------------------------------------- fotky */
async function compress(file, max = 1920) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { throw new Error(`Súbor „${file.name}“ sa nedá načítať. Použite fotku JPG, PNG alebo WebP (fotky z iPhonu vo formáte HEIC najprv uložte ako JPG).`); }
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.84));
  if (!blob || blob.type !== 'image/webp') throw new Error('Tento prehliadač nevie fotku previesť. Skúste prosím Chrome, Safari alebo Edge.');
  return { blob, w: c.width, h: c.height };
}
async function upload(file, hint, max) {
  const { blob } = await compress(file, max);
  const d = new Date();
  const name = (slugify(hint) || slugify(file.name.replace(/\.[^.]+$/, '')) || 'foto').slice(0, 40);
  const path = `img/uploads/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}/${name}-${uid()}.webp`;
  S.pending[path] = b64e(await blob.arrayBuffer());
  S.preview[path] = URL.createObjectURL(blob);
  return path;
}
async function library() {
  if (!S.lib) { try { S.lib = await fetch(CFG.site + 'admin/images.json?t=' + Date.now()).then((r) => r.json()); } catch { S.lib = []; } }
  return [...Object.keys(S.pending), ...S.lib.filter((p) => !/^(logo|prijimac|og)\./.test(p))];
}
async function pickFromLibrary(title = 'Vybrať fotku z webu') {
  const list = await library();
  return new Promise((resolve) => {
    let done = false;
    const grid = h('div.lib', {}, list.map((p) => h('button', { type: 'button', onclick: () => { done = true; resolve(p); document.querySelector('.modal-bg')?.remove(); } }, h('img', { src: imgSrc(p), loading: 'lazy', alt: '' }))));
    modal({ title, body: grid, actions: [{ label: 'Zavrieť', value: null }] }).then(() => { if (!done) resolve(null); });
  });
}
function pickFile(multiple) {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept: 'image/*', multiple: multiple || null, hidden: true, onchange: () => { resolve([...inp.files]); inp.remove(); } });
    document.body.append(inp); inp.click();
    setTimeout(() => inp.remove(), 120000);
  });
}

/* ---------------------------------------------------------------- polia formulárov */
const bump = () => changed();
function fText(obj, key, label, o = {}) {
  const inp = o.multi
    ? h('textarea', { rows: o.rows || 4, placeholder: o.ph || '', oninput: (e) => { obj[key] = e.target.value; bump(); o.on?.(); } })
    : h('input', { type: o.type || 'text', placeholder: o.ph || '', inputmode: o.inputmode, autocomplete: 'off', oninput: (e) => { obj[key] = e.target.value; bump(); o.on?.(); } });
  inp.value = obj[key] ?? '';
  return h('label.field', {}, h('span', {}, label), inp, o.hint ? h('small', {}, o.hint) : null);
}
/** jedna fotka: obj[key] */
function fImage(obj, key, label, hint = '', o = {}) {
  const prev = h('img.prev', { src: imgSrc(obj[key]), alt: '' });
  const set = (p) => { obj[key] = p; prev.src = imgSrc(p); bump(); o.on?.(); };
  return h('div.field', {}, h('span', {}, label),
    h('div.img-field', {}, prev, h('div.acts', {},
      h('button.btn.btn-sm', { type: 'button', onclick: async () => {
        const [f] = await pickFile(false); if (!f) return;
        try { set(await upload(f, hint)); toast('Fotka pripravená', 'Na web sa nahrá po uložení.'); } catch (er) { toast('Fotku sa nepodarilo načítať', er.message, 'err'); }
      }, html: IC.upload + 'Nahrať novú' }),
      h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: async () => { const p = await pickFromLibrary(); if (p) set(p); }, html: IC.image + 'Vybrať z webu' }),
      o.removable && obj[key] ? h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: () => { set(''); o.rerender?.(); }, html: IC.trash + 'Bez fotky' }) : null)),
    o.hint ? h('small', {}, o.hint) : null);
}
/** zoznam položiek s rozbaľovaním, radením a mazaním; o.sync() po pridaní/zmazaní/presune */
function fList(arr, o) {
  const wrap = h('div');
  const mut = (fn) => { fn(); o.sync?.(); bump(); };
  const render = (openIdx = -1) => {
    wrap.replaceChildren();
    const items = h('div.items');
    if (!arr.length) items.append(h('p.empty', {}, o.empty || 'Zatiaľ tu nič nie je.'));
    arr.forEach((it, i) => {
      const title = h('b'), sub = h('small'), thumb = o.thumb ? h('img.thumb.cover', { alt: '' }) : null;
      const refresh = () => { title.textContent = o.title(it) || '(bez názvu)'; sub.textContent = o.sub ? o.sub(it) : ''; if (thumb) thumb.src = imgSrc(o.thumb(it)); };
      const body = h('div.item-body');
      let built = false;
      const el = h('div.item');
      const toggle = () => { if (!built) { o.body(it, body, refresh); built = true; } el.classList.toggle('open'); };
      const head = h('div.item-head', {},
        thumb, h('div.t', { onclick: toggle }, title, sub),
        h('div.item-tools', {},
          h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Posunúť vyššie', 'aria-label': 'Posunúť vyššie', disabled: i === 0, onclick: () => { mut(() => arr.splice(i - 1, 0, arr.splice(i, 1)[0])); render(); }, html: IC.up }),
          h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Posunúť nižšie', 'aria-label': 'Posunúť nižšie', disabled: i === arr.length - 1, onclick: () => { mut(() => arr.splice(i + 1, 0, arr.splice(i, 1)[0])); render(); }, html: IC.down }),
          h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Zmazať', 'aria-label': 'Zmazať', onclick: async () => { if (await confirmDlg('Zmazať položku?', `„${o.title(it) || 'bez názvu'}“ bude odstránená (po uložení).`)) { mut(() => arr.splice(i, 1)); render(); } }, html: IC.trash }),
          h('button.btn.btn-icon.btn-ghost.chev', { type: 'button', 'aria-label': 'Rozbaliť', onclick: toggle, html: IC.chev })));
      el.append(head, body); items.append(el); refresh();
      if (i === openIdx) toggle();
    });
    wrap.append(...[items, o.make ? h('button.btn.add', { type: 'button', onclick: () => { mut(() => arr.push(o.make())); render(arr.length - 1); }, html: IC.plus + (o.addLabel || 'Pridať') }) : null].filter(Boolean));
  };
  render(o.open ?? -1);
  return wrap;
}
/** zoznam textov (odstavce, parametre) */
function fStrList(arr, label, o = {}) {
  const box = h('div.field', {}, h('span', {}, label));
  const list = h('div');
  const render = () => {
    list.replaceChildren(...arr.map((v, i) => {
      const inp = o.multi ? h('textarea', { rows: o.rows || 3 }) : h('input', { type: 'text', placeholder: o.ph || '' });
      inp.value = v; inp.addEventListener('input', (e) => { arr[i] = e.target.value; bump(); o.on?.(); });
      return h('div', { style: 'display:flex;gap:.4rem;align-items:flex-start;margin-bottom:.45rem' }, inp,
        h('button.btn.btn-icon.btn-ghost', { type: 'button', 'aria-label': 'Posunúť vyššie', disabled: i === 0, onclick: () => { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); bump(); o.on?.(); render(); }, html: IC.up }),
        h('button.btn.btn-icon.btn-ghost', { type: 'button', 'aria-label': 'Zmazať', onclick: () => { arr.splice(i, 1); bump(); o.on?.(); render(); }, html: IC.trash }));
    }), h('button.btn.btn-sm', { type: 'button', onclick: () => { arr.push(''); bump(); render(); }, html: IC.plus + (o.add || 'Pridať') }));
  };
  render(); box.append(...[list, o.hint ? h('small', {}, o.hint) : null].filter(Boolean));
  return box;
}
const card = (title, hint, ...kids) => h('section.card', {}, title ? h('h2', {}, title) : null, hint ? h('p.hint', {}, hint) : null, ...kids);
const row2 = (...kids) => h('div.row2', {}, ...kids);
const view = (title, lead, ...kids) => { const m = $('main.view'); m.replaceChildren(h('div.view-head', {}, h('h1', {}, title), lead ? h('p', {}, lead) : null), ...kids); window.scrollTo(0, 0); };
const H3 = (t) => h('h3', { style: 'margin:1.2rem 0 .4rem;font-family:var(--serif);font-weight:700;font-size:1.15rem' }, t);
const nadpisSekcie = (o, label = 'Nadpis sekcie') => row2(fText(o, 'stitok', 'Štítok nad nadpisom'), fText(o, 'nadpis', label));

/* ---------------------------------------------------------------- pohľady */
const NAV = [
  ['', 'Prehľad', 'home'], ['-'],
  ['uvod', 'Úvod', 'text', 'texty'], ['o-nas', 'O nás', 'info', 'texty'], ['sluzby', 'Služby', 'bolt', 'sluzby'],
  ['tlmocnicka', 'Tlmočnícka technika', 'mic', 'texty'], ['galeria', 'Galéria', 'image', 'galeria'], ['tim', 'Tím', 'users', 'tim'],
  ['kontakty', 'Kontakty', 'phone', 'site'], ['-'],
  ['navod', 'Návod', 'help'], ['nastavenia', 'Heslo a odhlásenie', 'gear'],
];

function vDash() {
  const tiles = [['uvod', 'Úvod', 'text', 'Nadpis, slogan, tlačidlá, fotka'], ['o-nas', 'O nás', 'info', 'Text o firme'], ['sluzby', 'Služby', 'bolt', 'Skupiny služieb a ich popis'],
    ['tlmocnicka', 'Tlmočnícka technika', 'mic', 'ISO kabíny, Taiden'], ['galeria', 'Galéria', 'image', 'Fotky z podujatí'], ['tim', 'Tím', 'users', 'Mená a fotky'],
    ['kontakty', 'Kontakty', 'phone', 'Telefón, e-mail, adresy']]
    .map(([id, label, ic, sub]) => h('a.tile', { href: '#/' + id }, h('span', { html: IC[ic] }), h('b', {}, label), h('small', {}, sub)));
  view('Dobrý deň 👋', 'Tu si upravujete svoj web: texty, služby, fotky v galérii, tím a kontakty. Zmeny uložíte tlačidlom „Uložiť zmeny“ dole, na webe sa objavia približne o minútu.',
    h('div.tiles', {}, tiles),
    card('Ako to funguje', null, h('div.help', { html: '<ol><li>Vľavo (na mobile v menu ☰) vyberte, čo chcete upraviť.</li><li>Prepíšte text alebo nahrajte fotky.</li><li>Dole sa objaví lišta – kliknite na <b>Uložiť zmeny</b>.</li><li>Hore uvidíte „Zverejňujem zmeny…“ a o chvíľu „Web je aktuálny“.</li></ol>' })),
    h('a.btn.btn-dark', { href: CFG.site, target: '_blank', rel: 'noopener', style: 'margin-top:.5rem', html: IC.ext + 'Otvoriť web' }));
}

function vUvod() {
  const T = S.D.texty.hero;
  view('Úvod', 'Prvá obrazovka webu na žltom pozadí.',
    card('Texty v úvode', null,
      fText(T, 'stitok', 'Riadok nad nadpisom'),
      fText(T, 'nadpis', 'Hlavný nadpis'),
      fText(T, 'slogan', 'Slogan (veľkým písmom pod nadpisom)', { multi: true, rows: 2 }),
      fText(T, 'perex', 'Text pod sloganom', { multi: true, rows: 3 }),
      row2(fText(T, 'tlacitko', 'Tlačidlo (vedie na kontakt)'), fText(T, 'tlacitko2', 'Druhý odkaz (vedie na služby)')),
      fText(T, 'normy', 'Drobný text pod tlačidlami (normy)', { multi: true, rows: 2 })),
    card('Fotka v úvode', null, fImage(T, 'foto', 'Fotka vedľa nadpisu', 'uvod'), fText(T, 'alt', 'Popis fotky (pre Google a nevidiacich)')));
}

function vONas() {
  const T = S.D.texty.o_nas;
  view('O nás', null, card('Sekcia O nás', null, nadpisSekcie(T),
    fStrList(T.odstavce, 'Odstavce textu', { multi: true, rows: 4, add: 'Pridať odstavec' }),
    fText(T, 'zaver', 'Zvýraznená veta na konci (tučne)', { multi: true, rows: 2 })));
}

function vSluzby() {
  const SG = S.D.skupiny;
  const sync = () => {   // služby sú v dátach jeden zoznam – poradie podľa skupín
    const known = new Set(SG.map((g) => g.id));
    S.D.sluzby = [...SG.flatMap((g) => groups[g.id]), ...S.D.sluzby.filter((s) => !known.has(s.skupina))];
  };
  const groups = Object.fromEntries(SG.map((g) => [g.id, S.D.sluzby.filter((s) => s.skupina === g.id)]));
  view('Služby', 'Služby sú rozdelené do skupín, každá skupina má fotku. Pri službe môžete upraviť názov, popis a krátke parametre (štítky pod popisom).',
    card('Nadpis sekcie', null, nadpisSekcie(S.D.texty.sluzby)),
    ...SG.map((g) => card(g.nazev || 'Skupina', null,
      fText(g, 'nazev', 'Názov skupiny'),
      fImage(g, 'foto', 'Fotka skupiny', 'sluzby'),
      fText(g, 'alt', 'Popis fotky (pre Google a nevidiacich)'),
      H3('Služby v skupine'),
      fList(groups[g.id], { sync, title: (s) => s.nazev, sub: (s) => s.popis, addLabel: 'Pridať službu', make: () => ({ nazev: '', popis: '', spec: [], foto: '', skupina: g.id }),
        body: (s, box, r) => {
          s.spec = s.spec || [];
          const fotoBox = h('div');
          const renderFoto = () => fotoBox.replaceChildren(fImage(s, 'foto', 'Malá fotka produktu (nepovinná)', 'produkt', { removable: true, rerender: renderFoto }));
          renderFoto();
          box.append(fText(s, 'nazev', 'Názov služby', { on: r }), fText(s, 'popis', 'Popis', { multi: true, rows: 3, on: r }),
            fStrList(s.spec, 'Parametre (štítky)', { add: 'Pridať parameter', ph: 'napr. LED stena až 70 m²' }), fotoBox);
        } }))));
}

function vTlmocnicka() {
  const T = S.D.texty.tlmocenie;
  view('Tlmočnícka technika', 'Sekcia o ISO kabínach a prijímačoch Taiden.',
    card('Texty', null, nadpisSekcie(T),
      fStrList(T.odstavce, 'Odstavce textu', { multi: true, rows: 4, add: 'Pridať odstavec' })),
    card('Fotka', null, fImage(T, 'foto', 'Fotka sekcie', 'tlmocnicka-technika'), fText(T, 'alt', 'Popis fotky (pre Google a nevidiacich)')));
}

function vGaleria() {
  const G = S.D.galeria;
  const wrap = h('div');
  const render = () => {
    const grid = h('div.photos');
    G.forEach((p, i) => {
      const cap = h('input', { type: 'text', placeholder: 'Popisok na fotke (nepovinný)', 'aria-label': 'Popisok na fotke', oninput: (e) => { p.popis = e.target.value; bump(); } }); cap.value = p.popis || '';
      const alt = h('textarea', { rows: 2, placeholder: 'Čo je na fotke (pre Google)', 'aria-label': 'Popis fotky pre Google', oninput: (e) => { p.alt = e.target.value; bump(); } }); alt.value = p.alt || '';
      const img = h('img', { src: imgSrc(p.foto), alt: '', title: 'Vymeniť fotku', onclick: () => replace(i) });
      grid.append(h('div.photo', {}, img,
        h('div.ph-tools', {},
          h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Posunúť dopredu', 'aria-label': 'Posunúť dopredu', disabled: i === 0, onclick: () => { G.splice(i - 1, 0, G.splice(i, 1)[0]); bump(); render(); }, html: IC.left }),
          h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Zmazať fotku', 'aria-label': 'Zmazať fotku', onclick: async () => { if (await confirmDlg('Zmazať fotku?', 'Fotka zmizne z galérie (po uložení).')) { G.splice(i, 1); bump(); render(); } }, html: IC.trash }),
          h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Posunúť dozadu', 'aria-label': 'Posunúť dozadu', disabled: i === G.length - 1, onclick: () => { G.splice(i + 1, 0, G.splice(i, 1)[0]); bump(); render(); }, html: IC.right })),
        cap, alt));
    });
    grid.append(h('button.photo-add', { type: 'button', onclick: async () => {
      const fs = await pickFile(true); let n = 0;
      for (const f of fs) { try { G.push({ foto: await upload(f, 'galeria'), popis: '', alt: '' }); n++; } catch (er) { toast('Fotku sa nepodarilo načítať', er.message, 'err'); } }
      if (n) { bump(); render(); toast(n === 1 ? 'Fotka pridaná' : `Pridané fotky: ${n}`, 'Doplňte popis a uložte zmeny.'); }
    }, html: IC.upload + '<span>Nahrať fotky<br><small>môžete vybrať viac naraz</small></span>' }));
    grid.append(h('button.photo-add', { type: 'button', onclick: async () => { const p = await pickFromLibrary(); if (p) { G.push({ foto: p, popis: '', alt: '' }); bump(); render(); } }, html: IC.image + '<span>Vybrať z fotiek na webe</span>' }));
    wrap.replaceChildren(grid);
  };
  const replace = async (i) => {
    const r = await modal({ title: 'Vymeniť fotku', body: '<p>Nahrajte novú fotku alebo vyberte niektorú z fotiek, ktoré už na webe sú. Popis zostane.</p>', actions: [{ label: 'Zrušiť', value: null }, { label: 'Vybrať z webu', value: 'lib' }, { label: 'Nahrať novú', cls: 'btn-primary', value: 'up' }] });
    if (r === 'lib') { const p = await pickFromLibrary(); if (p) { G[i].foto = p; bump(); render(); } }
    if (r === 'up') {
      const [f] = await pickFile(false); if (!f) return;
      try { G[i].foto = await upload(f, 'galeria'); bump(); render(); toast('Fotka vymenená', 'Na web sa nahrá po uložení.'); } catch (er) { toast('Fotku sa nepodarilo načítať', er.message, 'err'); }
    }
  };
  render();
  view('Galéria', 'Fotky z podujatí. Kliknutím na fotku ju vymeníte, šípkami zmeníte poradie. Fotky sa pri nahraní samy zmenšia.',
    card('Fotky', 'Popisok sa zobrazí priamo na fotke (napr. „Konferencia Itapa“). Druhé pole opíše fotku pre Google a nevidiacich.', wrap),
    card('Nadpis sekcie', null, nadpisSekcie(S.D.texty.galeria)));
}

function vTim() {
  const TM = S.D.tim;
  view('Tím', 'Ľudia vo firme. Fotky sa na webe zobrazujú čiernobielo a štvorcovo.',
    card('Členovia tímu', null, fList(TM, { title: (c) => c.meno, sub: (c) => c.pozicia || '', thumb: (c) => c.foto, addLabel: 'Pridať člena tímu', make: () => ({ foto: '', meno: '' }),
      body: (c, box, r) => box.append(fText(c, 'meno', 'Meno a priezvisko', { on: r }), fText(c, 'pozicia', 'Pozícia (nepovinná)', { on: r, ph: 'napr. technik' }),
        fImage(c, 'foto', 'Fotka', 'tim', { on: r })) })),
    card('Nadpis sekcie', null, nadpisSekcie(S.D.texty.tim)));
}

function vKontakty() {
  const s = S.D.site; const k = s.kontakt; k.adresa = k.adresa || {};
  const K = S.D.texty.kontakt;
  view('Kontakty', 'Hlavný telefón a e-mail sú v hlavičke a päte webu. Adresy v sekcii Kontakt upravíte nižšie. Kam chodia správy z formulára, nastavujeme my – stačí nám napísať.',
    card('Hlavný kontakt (hlavička a päta)', null, row2(fText(k, 'telefon', 'Telefón', { type: 'tel' }), fText(k, 'email', 'E-mail', { type: 'email' })),
      fText(k.adresa, 'ulice', 'Adresa (ulica a číslo)'), row2(fText(k.adresa, 'psc', 'PSČ'), fText(k.adresa, 'mesto', 'Obec'))),
    card('Sekcia Kontakt', null, nadpisSekcie(K), fText(K, 'text', 'Text nad formulárom', { multi: true, rows: 2 })),
    card('Adresy a kontakty v sekcii Kontakt', 'Každý riadok je samostatný. Telefónne číslo a e-mail sa na webe samy zmenia na klikací odkaz.',
      fList(K.bloky, { title: (b) => b.nadpis, sub: (b) => b.riadky.filter(Boolean).join(', '), addLabel: 'Pridať blok', make: () => ({ nadpis: '', riadky: [''] }),
        body: (b, box, r) => box.append(fText(b, 'nadpis', 'Nadpis bloku', { on: r, ph: 'napr. Technik Košice' }), fStrList(b.riadky, 'Riadky', { add: 'Pridať riadok', on: r })) })),
    card('Navigácia', null, fText(K, 'google', 'Odkaz na Google Mapy', { type: 'url' }), fText(K, 'waze', 'Odkaz na Waze', { type: 'url' })),
    card('Firma', null, row2(fText(s, 'nazev', 'Názov firmy (päta, Google)'), fText(s, 'ico', 'IČO', { inputmode: 'numeric' })),
      fText(s, 'popis', 'Popis webu (Google, zdieľanie na sociálnych sieťach)', { multi: true, rows: 3, hint: 'Ideálne 120–160 znakov.' })));
}

function vNavod() {
  view('Návod', null,
    card('Pridať fotky do galérie', null, h('div.help', { html: '<ol><li>Otvorte <b>Galéria</b> a kliknite na <b>Nahrať fotky</b> (môžete vybrať viac fotiek naraz, aj z mobilu).</li><li>Ku každej fotke doplňte popis.</li><li>Šípkami zmeníte poradie, košom fotku zmažete, kliknutím na fotku ju vymeníte.</li><li>Dole kliknite na <b>Uložiť zmeny</b>.</li></ol>' })),
    card('Zmeniť text', null, h('div.help', { html: '<ol><li>Vyberte časť webu: <b>Úvod</b>, <b>O nás</b>, <b>Služby</b>, <b>Tlmočnícka technika</b> alebo <b>Kontakty</b>.</li><li>Prepíšte text a uložte.</li></ol>' })),
    card('Upraviť tím', null, h('div.help', { html: '<ol><li>V časti <b>Tím</b> kliknite na meno, upravte ho alebo vymeňte fotku.</li><li>Nového kolegu pridáte tlačidlom <b>Pridať člena tímu</b>.</li></ol>' })),
    card('Niečo nejde?', null, h('p', {}, 'Napíšte nám na info.webhunter@email.cz, radi pomôžeme.')));
}

function vSettings() {
  const f = { old: '', pw: '', pw2: '' };
  const msg = h('p', { style: 'color:var(--err);font-size:.9rem;min-height:1.2rem' });
  const pwInput = (key, label, ac) => h('label.field', {}, h('span', {}, label), h('input', { type: 'password', autocomplete: ac, oninput: (e) => { f[key] = e.target.value; } }));
  view('Heslo a odhlásenie', `Prihlasovacie meno: ${S.user}`,
    card('Zmeniť heslo', 'Po zmene hesla sa odhlásia všetky ostatné zariadenia. Heslo musí mať aspoň 8 znakov. Prihlasovacie meno zostáva rovnaké.',
      pwInput('old', 'Súčasné heslo', 'current-password'), pwInput('pw', 'Nové heslo', 'new-password'), pwInput('pw2', 'Nové heslo znova', 'new-password'), msg,
      h('button.btn.btn-primary', { type: 'button', onclick: async (e) => {
        msg.textContent = '';
        if (f.pw.length < 8) return (msg.textContent = 'Nové heslo musí mať aspoň 8 znakov.');
        if (f.pw !== f.pw2) return (msg.textContent = 'Nové heslá sa nezhodujú.');
        e.target.disabled = true;
        try { const r = await api('/password', { method: 'POST', body: JSON.stringify({ old: secret(S.user, f.old), password: secret(S.user, f.pw) }) }); S.sess = r.token; saveSess(); toast('Heslo zmenené', 'Nabudúce sa prihláste novým heslom.', 'ok'); route(); }
        catch (er) { msg.textContent = er.message; } finally { e.target.disabled = false; }
      } }, 'Uložiť nové heslo')),
    card('Odhlásiť sa', null, h('button.btn', { type: 'button', onclick: logout, html: IC.logout + 'Odhlásiť' })));
}

/* ---------------------------------------------------------------- rám */
function renderShell() {
  const nav = h('nav.nav', { id: 'nav', 'aria-label': 'Sekcie administrácie' },
    h('button.btn.btn-icon.btn-ghost.nav-close', { type: 'button', 'aria-label': 'Zavrieť menu', onclick: () => nav.classList.remove('open'), html: IC.x }),
    NAV.map(([id, label, ic, key]) => id === '-' ? h('hr') : h('a', { href: '#/' + id, 'data-id': id, 'data-key': key || '', onclick: () => nav.classList.remove('open'), html: IC[ic] + `<span>${esc(label)}</span>` })),
    h('hr'), h('a', { href: CFG.site, target: '_blank', rel: 'noopener', html: IC.ext + '<span>Zobraziť web</span>' }));
  const bar = h('div.savebar', { id: 'savebar' }, h('span', {}, ''),
    h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: async () => { if (await confirmDlg('Zahodiť zmeny?', 'Neuložené úpravy sa stratia.', 'Zahodiť')) discard(); } }, 'Zahodiť'),
    h('button.btn.btn-primary', { type: 'button', onclick: saveAll }, 'Uložiť zmeny'));
  $('#app').replaceChildren(h('div.shell', {},
    h('header.top', {},
      h('button.btn.btn-icon.btn-ghost.menu-btn', { type: 'button', 'aria-label': 'Menu', onclick: () => nav.classList.add('open'), html: IC.menu }),
      h('a.top-logo.brand', { href: '#/', html: LOGO + '<span>Administrácia</span>' }),
      h('div.pub'), h('a.btn.btn-sm', { href: CFG.site, target: '_blank', rel: 'noopener', html: IC.eye + '<span>Web</span>' })),
    h('div.layout', {}, nav, h('main.view'))), bar);
  initPub();
}
function updateSavebar() {
  const keys = dirtyKeys(); const bar = $('#savebar'); if (!bar) return;
  bar.classList.toggle('on', keys.length > 0 || S.saving);
  bar.querySelector('span').textContent = S.saving ? 'Ukladám…' : `Neuložené zmeny: ${keys.map((k) => LABEL[k]).join(', ')}`;
  bar.querySelectorAll('button').forEach((b) => { b.disabled = S.saving; });
  document.querySelectorAll('.nav a[data-key]').forEach((a) => { a.querySelector('.dot')?.remove(); if (keys.includes(a.dataset.key) || (a.dataset.key === 'sluzby' && keys.includes('skupiny'))) a.append(h('i.dot')); });
}
const VIEWS = { '': vDash, uvod: vUvod, 'o-nas': vONas, sluzby: vSluzby, tlmocnicka: vTlmocnicka, galeria: vGaleria, tim: vTim, kontakty: vKontakty, navod: vNavod, nastavenia: vSettings };
function route() {
  const [id, arg] = location.hash.replace(/^#\/?/, '').split('/');
  (VIEWS[id] || vDash)(arg);
  document.querySelectorAll('.nav a[data-id]').forEach((a) => a.classList.toggle('on', a.dataset.id === (VIEWS[id] ? id : '')));
  updateSavebar();
}
window.addEventListener('hashchange', route);

/* ---------------------------------------------------------------- prihlásenie */
function renderLogin(msg = '') {
  const user = h('input', { type: 'text', id: 'user', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', placeholder: 'Meno', required: true });
  user.value = S.user || '';
  const inp = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', placeholder: 'Heslo', required: true });
  const err = h('p.login-err', {}, msg);
  const btn = h('button.btn.btn-primary', { type: 'submit' }, 'Prihlásiť sa');
  const form = h('form.login-card', { onsubmit: async (e) => {
    e.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Prihlasujem…';
    try {
      const u = user.value.trim().toLowerCase();
      const r = await api('/login', { method: 'POST', body: JSON.stringify({ password: secret(u, inp.value) }) });
      S.sess = r.token; S.user = u; saveSess(); await start();
    } catch (er) { err.textContent = er.message; btn.disabled = false; btn.textContent = 'Prihlásiť sa'; inp.select(); }
  } },
  h('div.brand', { html: LOGO }), h('h1', {}, 'Administrácia webu'), h('p', {}, 'Prihláste sa menom a heslom.'),
  h('label.field', {}, h('span', {}, 'Meno'), user),
  h('label.field', {}, h('span', {}, 'Heslo'), h('div.pw-wrap', {}, inp, h('button.pw-eye', { type: 'button', 'aria-label': 'Zobraziť heslo', onclick: () => { inp.type = inp.type === 'password' ? 'text' : 'password'; }, html: IC.eye }))),
  btn, err);
  $('#app').replaceChildren(h('div.login', {}, form));
  setTimeout(() => (user.value ? inp : user).focus(), 50);
}
function logout() {
  if (dirtyKeys().length && !confirm('Máte neuložené zmeny. Naozaj sa odhlásiť?')) return;
  localStorage.removeItem(SK); S.sess = null; S.D = {}; renderLogin();
}
async function start() {
  $('#app').innerHTML = `<div class="boot"><div class="brand">${LOGO}</div><span class="spin"></span></div>`;
  try { await loadAll(); } catch (e) {
    if (e.status === 401) { localStorage.removeItem(SK); S.sess = null; return renderLogin('Prihlásenie vypršalo, prihláste sa prosím znova.'); }
    return renderLogin('Obsah webu sa nepodarilo načítať: ' + e.message);
  }
  renderShell(); route();
}
function boot() {
  let s = null; try { s = JSON.parse(localStorage.getItem(SK) || 'null'); } catch {}
  if (s && s.exp > Date.now()) { S.sess = s.t; S.user = s.u || ''; start(); } else { S.user = (s && s.u) || ''; renderLogin(); }
}
boot();
})();
