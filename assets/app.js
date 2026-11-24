/* Content Hub — Lignarc (Global, EN) & Living Furniture (Local, VI)
 * Static app on GitHub Pages. Content plan lives in data/hub.json (written by Claude + the weekly agent workflow).
 * Posting status lives in data/state.json, written through the GitHub API with the user's token.
 * The COO engine reads the two sales dashboards (same GitHub Pages origin) after login and decrypts them in the browser.
 */
(() => {
'use strict';
const CFG = {
  OWNER: 'khoimr11', REPO: 'Content-Hub', BRANCH: 'main',
  SRC_GLOBAL: '/Lignarc-Dashboard/data/lignarc.enc.json',
  SRC_LOCAL: '/LF---B2C-Local/data/data.enc.json',
  SRC_KEYRING: '/LF---B2C-Local/data/keyring.json',
  LOCAL_PLAN: { '2026-11': 95, '2026-12': 300, '2027-01': 555, '2027-02': 333, '2027-03': 400, '2027-04': 480, '2027-05': 537 },
  LOCAL_WH_MONTH: 20000000,
  CG_FREE_DAYS: 90
};
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const te = new TextEncoder(), td = new TextDecoder();
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64e = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const store = {
  get: k => { try { return localStorage.getItem(k) || sessionStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v, keep = true) => { try { (keep ? localStorage : sessionStorage).setItem(k, v); } catch (e) {} },
  del: k => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) {} }
};
const n0 = v => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v || 0);
const usd = v => '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v || 0);
const vnd = v => n0(v) + ' ₫';
const todayISO = () => { const d = new Date(Date.now() + 7 * 3600e3); return d.toISOString().slice(0, 10); };
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diffDays = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
const dShort = s => { const [y, m, d] = s.split('-'); return `${+d}/${+m}`; };
const dLong = s => { const [y, m, d] = s.split('-'); return `${+d}/${+m}/${y}`; };
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const CH_LABEL = { instagram: 'Instagram', 'instagram-reels': 'IG Reels', 'instagram-story': 'IG Story', facebook: 'Facebook', 'facebook-story': 'FB Story', 'facebook-reels': 'FB Reels', 'facebook-group': 'FB Group', tiktok: 'TikTok', pinterest: 'Pinterest', reddit: 'Reddit', threads: 'Threads', 'youtube-shorts': 'YT Shorts', wayfair: 'Wayfair', amazon: 'Amazon', 'shopee-video': 'Shopee Video', 'shopee-feed': 'Shopee Feed', zalo: 'Zalo' };
const chl = c => CH_LABEL[c] || c;
const SKUN = { VESTRA: 'Vestra', ZENA: 'Zena', CALIX: 'Calix', 'CALIX-FLOAT': 'Calix Floating', PARKWAY: 'Caroline Parkway', VANITY: 'Bath vanities' };

/* ---------------- state ---------------- */
const S = { tab: store.get('ch-tab') || 'coo', ch: store.get('ch-ch') || 'all', postFilter: 'ready', sku: 'all', calMonth: todayISO().slice(0, 7), user: store.get('ch-user') || '', keys: {}, G: null, L: null, hub: null, st: { posts: {}, studio: {}, uploads: [], approvals: {} }, sha: null, open: {} };
const TABS = [['coo', 'Tổng quan', '◎'], ['posts', 'Bài đăng', '▤'], ['cal', 'Lịch', '▦'], ['studio', 'Studio', '◐'], ['seed', 'Seeding', '⌖'], ['lib', 'Thư viện', '▣'], ['agents', 'Agents', '✦']];

/* ---------------- crypto: open the two dashboards ---------------- */
async function pbkdf(user, pass, salt, iter = 250000) {
  const base = await crypto.subtle.importKey('raw', te.encode(user.trim().toLowerCase() + '\n' + pass), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
  return { key: () => crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']), bits: async () => new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, 256)) };
}
async function openWith(raw, file) { const k = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']); return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(file.iv) }, k, b64d(file.ct)))); }
const getJSON = async u => { const r = await fetch(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); };
async function unlockGlobal(user, pass) {
  const f = await getJSON(CFG.SRC_GLOBAL), h = hex(await crypto.subtle.digest('SHA-256', te.encode('lignarc|' + user.trim().toLowerCase()))).slice(0, 16);
  const slot = (f.users || []).find(u => u.h === h); if (!slot) throw new Error('no user');
  const raw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(slot.iv) }, await (await pbkdf(user, pass, b64d(slot.salt), f.iter || 250000)).key(), b64d(slot.wk)));
  return raw;
}
async function unlockLocal(user, pass) {
  try {
    const kr = await getJSON(CFG.SRC_KEYRING);
    return await Promise.any((kr.users || []).map(async u => { const raw = await (await pbkdf(user, pass, b64d(u.salt), u.iter || 250000)).bits(); const j = await openWith(raw, u); return b64d(j.shops.lf); }));
  } catch (e) {
    const f = await getJSON(CFG.SRC_LOCAL), raw = await (await pbkdf(user, pass, b64d(f.salt), f.iter || 250000)).bits(); await openWith(raw, f); return raw;
  }
}
async function loadSources() {
  const out = [];
  if (S.keys.lg) try { S.G = await openWith(b64d(S.keys.lg), await getJSON(CFG.SRC_GLOBAL)); out.push('Global'); } catch (e) { S.G = null; }
  if (S.keys.lf) try { S.L = await openWith(b64d(S.keys.lf), await getJSON(CFG.SRC_LOCAL)); out.push('Local'); } catch (e) { S.L = null; }
  return out;
}

/* ---------------- GitHub storage ---------------- */
const token = () => store.get('ch-token');
const api = (p, o = {}) => fetch(`https://api.github.com/repos/${CFG.OWNER}/${CFG.REPO}/${p}`, { ...o, headers: { Accept: 'application/vnd.github+json', ...(token() ? { Authorization: 'Bearer ' + token() } : {}), ...(o.headers || {}) } });
const utf8b64 = s => b64e(te.encode(s));
async function loadState() {
  try {
    if (token()) {
      const r = await api(`contents/data/state.json?ref=${CFG.BRANCH}&t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); S.sha = j.sha; S.st = JSON.parse(td.decode(b64d(j.content.replace(/\n/g, '')))); }
      else if (r.status === 404) S.sha = null;
    } else {
      const r = await fetch(`https://raw.githubusercontent.com/${CFG.OWNER}/${CFG.REPO}/${CFG.BRANCH}/data/state.json?t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) S.st = await r.json();
    }
  } catch (e) {}
  const pend = JSON.parse(store.get('ch-pending') || 'null'); if (pend) mergeState(pend);
  for (const k of ['posts', 'studio', 'approvals']) S.st[k] = S.st[k] || {}; S.st.uploads = S.st.uploads || [];
}
function mergeState(x) { for (const k of ['posts', 'studio', 'approvals']) S.st[k] = Object.assign(S.st[k] || {}, x[k] || {}); if (x.uploads) S.st.uploads = [...(S.st.uploads || []), ...x.uploads.filter(u => !(S.st.uploads || []).some(v => v.path === u.path))]; }
let saving = Promise.resolve();
function saveState(msg, patch) {
  mergeState(patch);
  const pend = JSON.parse(store.get('ch-pending') || '{}'); for (const k of ['posts', 'studio', 'approvals']) pend[k] = Object.assign(pend[k] || {}, patch[k] || {}); if (patch.uploads) pend.uploads = [...(pend.uploads || []), ...patch.uploads];
  store.set('ch-pending', JSON.stringify(pend));
  if (!token()) { toast('Đã lưu trên máy này. Thêm GitHub token trong Cài đặt để đồng bộ cho cả team.'); return Promise.resolve(); }
  saving = saving.then(async () => {
    for (let i = 0; i < 3; i++) {
      const body = { message: msg, content: utf8b64(JSON.stringify(S.st, null, 1)), branch: CFG.BRANCH }; if (S.sha) body.sha = S.sha;
      const r = await api('contents/data/state.json', { method: 'PUT', body: JSON.stringify(body) });
      if (r.ok) { S.sha = (await r.json()).content.sha; store.del('ch-pending'); return; }
      if (r.status === 409 || r.status === 422) { const keep = JSON.parse(store.get('ch-pending') || '{}'); await loadState(); mergeState(keep); continue; }
      toast('Không lưu được lên GitHub (' + r.status + ') — đã giữ trên máy'); return;
    }
  });
  return saving;
}
async function uploadFile(file, folder = 'media/up') {
  if (!token()) throw new Error('Cần GitHub token (Cài đặt) để tải file lên hub');
  if (file.size > 40e6) throw new Error('File > 40MB — nén nhỏ lại trước');
  const buf = new Uint8Array(await file.arrayBuffer()), name = `${Date.now().toString(36)}-${file.name.replace(/[^\w.\-]+/g, '-').toLowerCase()}`, path = `${folder}/${name}`;
  const r = await api(`contents/${path}`, { method: 'PUT', body: JSON.stringify({ message: 'upload: ' + name, content: b64e(buf), branch: CFG.BRANCH }) });
  if (!r.ok) throw new Error('Upload lỗi ' + r.status);
  return { path, kind: /^video/.test(file.type) ? 'video' : 'image', at: new Date().toISOString(), by: S.user };
}
const mediaURL = p => /^media\/up\//.test(p) ? `https://raw.githubusercontent.com/${CFG.OWNER}/${CFG.REPO}/${CFG.BRANCH}/${p}` : p;

/* ---------------- model helpers ---------------- */
const chOK = x => S.ch === 'all' || x.ch === S.ch;
function postStatus(p) {
  const st = S.st.posts[p.id];
  if (st && st.status === 'posted') return 'posted';
  const ap = S.st.approvals[p.id];
  if (ap && ap.verdict === 'reject') return 'rejected';
  if (p.status === 'needs-asset' && !(st && st.asset)) return 'need';
  if (p.status === 'review' && !(ap && ap.verdict === 'approve')) return 'review';
  return 'ready';
}
const postMedia = p => { const st = S.st.posts[p.id]; return (st && st.asset ? [st.asset] : []).concat(p.media || []); };
const skuOf = t => /vestra|cart|rolling/i.test(t) ? 'VESTRA' : /float/i.test(t) ? 'CALIX-FLOAT' : /calix|kathryn/i.test(t) ? 'CALIX' : /zena|vivian/i.test(t) ? 'ZENA' : /parkway|caroline/i.test(t) ? 'PARKWAY' : 'VANITY';
const skuMatch = (ps, sku) => !sku || ps === sku || (ps === 'VANITY' && sku !== 'VESTRA');
function postedIn(days, ch, sku) {
  const from = addDays(todayISO(), -days + 1);
  return (S.hub.posts || []).filter(p => (!ch || p.ch === ch) && skuMatch(p.sku, sku) && S.st.posts[p.id] && S.st.posts[p.id].status === 'posted' && (S.st.posts[p.id].at || '').slice(0, 10) >= from).length;
}

/* ---------------- COO engine ---------------- */
function cooGlobal() {
  const D = S.G; if (!D) return null;
  const today = todayISO(), P = D.products || {}, W = D.wf || {};
  const inbById = new Map((W.inb || []).map(x => [x.id, x]));
  const recvOf = po => (W.inbRecv && W.inbRecv[po.whs]) || po.recv || (inbById.get(po.whs) && (inbById.get(po.whs).recvStart || inbById.get(po.whs).gatedOut)) || null;
  const pos = (D.pos || []).map(p => ({ ...p, recv: recvOf(p) ? String(recvOf(p)).slice(0, 10) : null })).sort((a, b) => (a.recv || '9999').localeCompare(b.recv || '9999'));
  const ok = s => !/cancel|reject|void/i.test(s || '');
  const lines = [];
  for (const r of W.orders || []) { const st = (W.statusOv || {})[r[0]] || r[3]; if (!ok(st)) continue; const p = P[r[7]] || {}; lines.push({ part: r[7], qty: +r[11] || 0, date: String(r[17] || r[2] || '').slice(0, 10), rev: (/tried/i.test(r[14] || '') ? 0 : (p.base || +r[12] || 0) * (+r[11] || 0)) }); }
  for (const r of (D.amz && D.amz.orders) || []) { if (!ok(r[2])) continue; lines.push({ part: r[3], qty: +r[5] || 0, date: String(r[11] || r[1] || '').slice(0, 10), rev: (+r[6] || 0) * (+r[5] || 0) }); }
  lines.sort((a, b) => a.date.localeCompare(b.date));
  const layers = {};
  for (const po of pos) for (const [part, qty] of po.items || []) (layers[part] = layers[part] || []).push({ po: po.id, recv: po.recv, qty, left: qty });
  for (const l of lines) { let q = l.qty; for (const ly of layers[l.part] || []) { if (q <= 0) break; const t = Math.min(q, ly.left); ly.left -= t; q -= t; } }
  const sold30 = {}; for (const l of lines) if (l.date > addDays(today, -30)) sold30[l.part] = (sold30[l.part] || 0) + l.qty;
  const inv = {}; for (const r of W.inv || []) inv[r[0]] = { onHand: r[2] || 0, avail: r[3] || 0 };
  // per PO (CastleGate free storage)
  const poInfo = pos.filter(p => p.recv).map(po => {
    const end = addDays(po.recv, CFG.CG_FREE_DAYS), left = diffDays(today, end);
    const L = Object.entries(layers).flatMap(([part, ls]) => ls.filter(x => x.po === po.id).map(x => ({ part, ...x })));
    const recvU = L.reduce((s, x) => s + x.qty, 0), remain = L.reduce((s, x) => s + x.left, 0);
    const v30 = L.reduce((s, x) => s + (sold30[x.part] || 0), 0) / 30;
    return { id: po.id, whs: po.whs, recv: po.recv, end, left, recvU, remain, v30, proj: Math.max(0, Math.round(remain - v30 * Math.max(0, left))), needPerDay: left > 0 ? remain / left : remain, parts: L };
  });
  const openInb = (W.inb || []).filter(x => x.status === 'OPEN');
  // per family (listing)
  const fam = {};
  const keyOf = part => { const p = P[part] || {}; return p.fam || p.col || part; };
  const parts = new Set([...Object.keys(inv), ...Object.keys(layers)]);
  for (const part of parts) {
    const k = keyOf(part), p = P[part] || {};
    const f = fam[k] = fam[k] || { key: k, name: p.col ? `${p.col}${p.type && !/cart/i.test(p.type) ? ' ' + p.type : ''}` : (p.name || part), parts: [], onHand: 0, sold30: 0, oldestLeft: null, remainOld: 0, proj: 0 };
    f.sku = skuOf((p.name || '') + ' ' + (p.col || '') + ' ' + (p.type || '') + ' ' + (p.fam || ''));
    f.parts.push(part); f.onHand += (inv[part] || {}).onHand || 0; f.sold30 += sold30[part] || 0;
    for (const ly of layers[part] || []) if (ly.left > 0 && ly.recv) { const left = diffDays(today, addDays(ly.recv, CFG.CG_FREE_DAYS)); if (f.oldestLeft == null || left < f.oldestLeft) f.oldestLeft = left; f.remainOld += ly.left; }
  }
  // KPI month (revenue)
  const ym = today.slice(0, 7), K = D.kpi, ki = K && K.months ? K.months.indexOf(ym) : -1, goal = ki >= 0 ? (K.rev || [])[ki] || 0 : 0;
  const mtd = lines.filter(l => l.date.slice(0, 7) === ym).reduce((s, l) => s + l.rev, 0);
  const dIn = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate(), dNow = +today.slice(8, 10), pace = goal * dNow / dIn, proj = dNow ? mtd / dNow * dIn : 0;
  const kpiGap = goal ? Math.max(0, 1 - proj / goal) : 0;
  const rows = Object.values(fam).filter(f => f.onHand > 0 || f.remainOld > 0).map(f => {
    const v = f.sold30 / 30, cover = v ? f.onHand / v : (f.onHand ? 999 : 0);
    let sc = 0; const why = [];
    if (f.oldestLeft != null) { const s = f.oldestLeft <= 14 ? 40 : f.oldestLeft <= 30 ? 32 : f.oldestLeft <= 45 ? 26 : f.oldestLeft <= 90 ? 14 : 0; sc += s; if (s) why.push(`${Math.max(0, f.oldestLeft)} ngày free CastleGate`); if (f.oldestLeft < 0) { sc += 45; why.push('đã bắt đầu tính phí kho'); } }
    const projLeft = Math.max(0, f.remainOld - v * Math.max(0, f.oldestLeft || 0)); f.proj = Math.round(projLeft);
    if (f.remainOld) { const s = Math.round(Math.min(1, projLeft / f.remainOld) * 25); sc += s; if (projLeft > 0.5) why.push(`~${n0(projLeft)} units sẽ còn khi hết free`); }
    if (cover > 120) { sc += 12; why.push(`tồn đủ bán ${cover >= 999 ? '∞' : n0(cover)} ngày`); } else if (cover > 60) { sc += 6; why.push(`tồn ${n0(cover)} ngày`); }
    if (kpiGap > 0) { const s = Math.round(kpiGap * 20); sc += s; if (s >= 4) why.push(`KPI tháng hụt ${Math.round(kpiGap * 100)}%`); }
    sc = Math.min(100, sc);
    const quota = Math.max(2, Math.round(2 + sc / 9));
    return { ...f, v, cover, score: sc, why, quota, posted7: postedIn(7, 'global', f.sku) };
  }).sort((a, b) => b.score - a.score);
  return { today, poInfo, rows, openInb, kpi: { ym, goal, mtd, pace, proj, gap: kpiGap }, at: (D.meta && (D.meta.at || D.meta.today)) || '' };
}
function cooLocal() {
  const D = S.L; if (!D) return null;
  const TZ = 7 * 3600, today = todayISO(), ym = today.slice(0, 7);
  const ords = (D.orders || []).map(r => ({ t: r[1], s: r[3] || '', st: r[2], q: r[4] || 0, v: r[5] || 0, m: r[7] || '' })).filter(o => !(/hủy/i.test(o.s) || o.st === 5));
  const day = o => new Date((o.t + TZ) * 1000).toISOString().slice(0, 10);
  const mtdU = ords.filter(o => day(o).slice(0, 7) === ym).reduce((s, o) => s + o.q, 0);
  const u30 = ords.filter(o => day(o) > addDays(today, -30)).reduce((s, o) => s + o.q, 0);
  const plan = CFG.LOCAL_PLAN[ym] || 0, dIn = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate(), dNow = +today.slice(8, 10), left = dIn - dNow;
  const proj = dNow ? mtdU / dNow * dIn : 0, needDay = left > 0 ? Math.max(0, plan - mtdU) / left : 0;
  const stock = {}; for (const p of D.products || []) { const k = /xanh/i.test(p[3] || p[2] || '') ? 'Xanh rêu' : /tr[ắa]ng/i.test(p[3] || p[2] || '') ? 'Trắng gỗ' : (p[3] || 'Khác'); stock[k] = (stock[k] || 0) + (+p[7] || 0); }
  const byColor = {}; for (const o of ords) if (day(o) > addDays(today, -30)) { const k = /xanh/i.test(o.m) ? 'Xanh rêu' : /tr[ắa]ng/i.test(o.m) ? 'Trắng gỗ' : 'Khác'; byColor[k] = (byColor[k] || 0) + o.q; }
  const gap = plan ? Math.max(0, 1 - proj / plan) : 0;
  const sc = Math.min(100, Math.round(gap * 70 + (needDay > (u30 / 30) * 1.5 ? 20 : 0) + 10));
  return { ym, plan, mtdU, proj, needDay, v30: u30 / 30, left, stock, byColor, gap, score: sc, quota: Math.max(4, Math.round(4 + sc / 10)), posted7: postedIn(7, 'local'), whDay: CFG.LOCAL_WH_MONTH / 30 };
}

/* ---------------- UI primitives ---------------- */
const kpi = (l, v, m = '', acc = '') => `<div class="kpi glass" style="${acc ? `--accent:${acc}` : ''}"><div class="lbl">${l}</div><div class="val">${v}</div><div class="meta">${m}</div></div>`;
const pill = (t, c = '') => `<span class="pill ${c}"><i></i>${t}</span>`;
const chPill = ch => `<span class="pill ${ch === 'global' ? 'g' : 'l'}">${ch === 'global' ? 'Global · EN' : 'Local · VI'}</span>`;
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3200); }
function modal(html, onOpen) { const m = $('#modal'); m.innerHTML = `<div class="box">${html}</div>`; m.hidden = false; m.onclick = e => { if (e.target === m || e.target.closest('[data-close]')) m.hidden = true; }; onOpen && onOpen(m); }
const closeModal = () => $('#modal').hidden = true;
async function copy(t) { try { await navigator.clipboard.writeText(t); toast('Đã copy'); } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); toast('Đã copy'); } }

/* ---------------- views ---------------- */
function viewCOO() {
  const H = S.hub, t = todayISO(), posts = H.posts.filter(chOK);
  const ready = posts.filter(p => postStatus(p) === 'ready'), need = posts.filter(p => postStatus(p) === 'need');
  const overdue = ready.filter(p => p.date < t), todayP = ready.filter(p => p.date === t);
  const p7 = posts.filter(p => S.st.posts[p.id] && S.st.posts[p.id].status === 'posted' && (S.st.posts[p.id].at || '').slice(0, 10) > addDays(t, -7)).length;
  const lastDate = posts.map(p => p.date).sort().pop() || t;
  const slots14 = H.calendar.filter(s => chOK(s) && s.date >= t && s.date <= addDays(t, 13)), filled = slots14.filter(s => s.post).length;
  const G = (S.ch !== 'local') ? cooGlobal() : null, L = (S.ch !== 'global') ? cooLocal() : null;
  const alerts = [];
  if (overdue.length) alerts.push(['crit', '!', `${overdue.length} bài đã đến hạn mà chưa bấm “Đã đăng”`, overdue.slice(0, 4).map(p => `${p.id} (${dShort(p.date)}, ${chl(p.channel)})`).join(' · ') + ' — đăng ngay hoặc dời lịch.']);
  if (need.length) alerts.push(['warn', '◐', `${need.length} bài đang chờ asset mới`, 'Quay clip thật hoặc tạo trong Studio (Gemini) rồi tải lên — COO tính vào chỉ tiêu tuần.']);
  if (G) for (const po of G.poInfo.filter(p => p.remain > 0 && p.left <= 60)) alerts.push([po.left <= 14 ? 'crit' : 'warn', '⏳', `CastleGate ${po.id}: còn ${Math.max(0, po.left)} ngày free (hết ${dLong(po.end)})`, `${n0(po.remain)}/${n0(po.recvU)} units còn tồn. Cần bán ~${po.needPerDay.toFixed(1)} units/ngày; tốc độ 30 ngày qua ${po.v30.toFixed(2)}/ngày → dự kiến còn ${n0(po.proj)} units khi bắt đầu tính phí.`]);
  if (G) { const behind = G.rows.filter(r => r.posted7 < r.quota && r.score >= 30); for (const r of behind.slice(0, 3)) alerts.push(['warn', '✎', `COO giao: ${r.name} cần ${r.quota} bài/tuần — 7 ngày qua mới đăng ${r.posted7}`, r.why.join(' · ')]); }
  if (L && L.plan) alerts.push([L.gap > 0.25 ? 'crit' : L.gap > 0 ? 'warn' : 'good', '▲', `Kệ 3 tầng Local: ${n0(L.mtdU)}/${n0(L.plan)} kệ tháng ${L.ym.slice(5)} · dự phóng ${n0(L.proj)}`, L.gap > 0 ? `Cần ~${L.needDay.toFixed(1)} kệ/ngày trong ${L.left} ngày còn lại (30 ngày qua: ${L.v30.toFixed(1)}/ngày). COO đặt chỉ tiêu ${L.quota} bài/tuần; 7 ngày qua đã đăng ${L.posted7}.` : 'Đang đúng kế hoạch — giữ nhịp đăng.']);
  if (!S.G && S.ch !== 'local') alerts.push(['warn', '⚿', 'Chưa kết nối Dashboard Global', 'Vào Cài đặt → kết nối bằng tài khoản Dashboard Global để COO đọc CastleGate, tồn kho, KPI.']);
  if (!S.L && S.ch !== 'global') alerts.push(['warn', '⚿', 'Chưa kết nối Dashboard Local', 'Vào Cài đặt → kết nối bằng tài khoản Dashboard Local (Living Furniture).']);
  const wf = H.posts.find(p => p.id === 'G-1203-WF'); if (wf && postStatus(wf) !== 'posted' && wf.date <= t && S.ch !== 'local') alerts.push(['crit', 'W', 'Wayfair (Waymore) chưa upload 2 ảnh mới', 'Việc của Global — hub theo dõi đến khi bấm “Đã đăng”.']);

  const cgCards = G ? G.poInfo.map(po => {
    const used = Math.min(1, Math.max(0, 1 - po.left / CFG.CG_FREE_DAYS));
    return `<div class="card glass cg"><div class="row" style="justify-content:space-between"><div><b>${esc(po.id)}</b><div class="sub">${esc(po.whs || '')} · nhận ${dLong(po.recv)}</div></div>${pill(po.left <= 14 ? 'Gấp' : po.left <= 45 ? 'Sắp hết' : po.left < 0 ? 'Đang tính phí' : 'Ổn', po.left <= 14 ? 'crit' : po.left <= 45 ? 'warn' : 'good')}</div>
      <div class="row" style="align-items:baseline;gap:10px"><span class="days">${Math.max(0, po.left)}</span><span class="sub">ngày free còn lại · hết ${dLong(po.end)}</span></div>
      <div class="prog"><i style="width:${used * 100}%"></i></div>
      <div class="row sub" style="justify-content:space-between"><span>Còn ${n0(po.remain)}/${n0(po.recvU)} units</span><span>Dự kiến tồn khi hết free: <b>${n0(po.proj)}</b></span></div></div>`;
  }).join('') + (G.openInb.length ? `<div class="card glass"><b>${G.openInb.length} lô đang về</b><div class="sub">Đồng hồ 90 ngày bắt đầu khi CastleGate “Receiving start”. Lên nội dung trước 2 tuần để hàng về là có bài đẩy.</div></div>` : '') : '';

  const pri = G ? `<div class="card glass"><div class="card-head"><div><h3>COO · SKU ưu tiên (Global)</h3><p class="sub">Điểm = ngày free CastleGate + hàng dự kiến tồn khi hết free + số ngày tồn + KPI doanh thu tháng. Chỉ tiêu bài/tuần tăng theo điểm.</p></div></div>
    <div class="tbl"><table><thead><tr><th>Điểm</th><th>Dòng sản phẩm</th><th class="r">Tồn</th><th class="r">Bán 30d</th><th>Lý do</th><th class="r">Chỉ tiêu/tuần</th><th class="r">Đã đăng 7d</th></tr></thead><tbody>
    ${G.rows.map(r => `<tr><td><span class="score ${r.score >= 60 ? 'hi' : r.score >= 30 ? 'md' : 'lo'}">${r.score}</span></td><td><b>${esc(r.name)}</b><div class="sub">${esc(r.parts.slice(0, 4).join(', '))}${r.parts.length > 4 ? '…' : ''}</div></td><td class="r">${n0(r.onHand)}</td><td class="r">${n0(r.sold30)}</td><td class="sub">${esc(r.why.join(' · ') || '—')}</td><td class="r"><b>${r.quota}</b></td><td class="r">${r.posted7 >= r.quota ? pill(r.posted7, 'good') : pill(r.posted7 + '/' + r.quota, 'crit')}</td></tr>`).join('')}
    </tbody></table></div>
    ${G.kpi.goal ? `<p class="sub">KPI doanh thu tháng ${G.kpi.ym.slice(5)}: ${usd(G.kpi.mtd)} / ${usd(G.kpi.goal)} · dự phóng ${usd(G.kpi.proj)} (ước tính nhanh theo giá bán, xem số chuẩn trên Dashboard Global).</p>` : ''}</div>` : '';
  const loc = L ? `<div class="card glass"><div class="card-head"><div><h3>COO · Kệ 3 tầng Local</h3><p class="sub">Kế hoạch ${n0(L.plan)} kệ tháng ${L.ym.slice(5)} · kho Suối Nghệ ~${vnd(L.whDay)}/ngày → hàng nằm kho là tốn tiền mỗi ngày.</p></div><span class="score ${L.score >= 60 ? 'hi' : L.score >= 30 ? 'md' : 'lo'}">${L.score}</span></div>
    <div class="grid g3">${kpi('Đã bán tháng này', n0(L.mtdU) + '<small>kệ</small>', `Dự phóng ${n0(L.proj)} / KH ${n0(L.plan)}`, 'var(--g-sage)')}${kpi('Cần mỗi ngày', L.needDay.toFixed(1) + '<small>kệ</small>', `30 ngày qua ${L.v30.toFixed(1)}/ngày`, 'var(--g-peach)')}${kpi('Chỉ tiêu bài/tuần', L.quota, `Đã đăng 7 ngày: ${L.posted7}`, 'var(--g-rose)')}</div>
    <div class="row sub" style="margin-top:10px">${Object.entries(L.stock).map(([k, v]) => pill(`Tồn Shopee ${k}: ${n0(v)}`)).join(' ')} ${Object.entries(L.byColor).map(([k, v]) => pill(`Bán 30d ${k}: ${n0(v)}`)).join(' ')}</div></div>` : '';

  return `<div class="page-head"><div><h1>Mission Control</h1><p class="sub">COO đọc dashboard → giao chỉ tiêu → đội content làm → Director duyệt → bạn đăng & bấm “Đã đăng”.</p></div></div>
  <div class="grid g4">${kpi('Sẵn sàng đăng', ready.length, `${todayP.length} bài hôm nay · ${overdue.length} quá hạn`, 'var(--g-peach)')}${kpi('Đã đăng 7 ngày', p7, 'bấm “Đã đăng” để tính', 'var(--g-sage)')}${kpi('Chờ asset mới', need.length, 'quay thật / Gemini Studio', 'var(--g-rose)')}${kpi('Lịch 14 ngày tới', `${filled}/${slots14.length}`, `slot đã có bài · lịch kéo tới ${dLong(H.meta.horizon)}`, 'var(--g-lilac)')}</div>
  <div style="height:14px"></div>
  <div class="split"><div>${alerts.map(a => `<div class="alert ${a[0]}"><span class="ic">${a[1]}</span><div><b>${esc(a[2])}</b><span>${esc(a[3])}</span></div></div>`).join('') || '<div class="alert good"><span class="ic">✓</span><div><b>Không có việc gấp</b></div></div>'}
    ${todayP.length ? `<h3 style="margin:16px 4px 10px">Đăng hôm nay</h3><div class="posts">${todayP.map(postCard).join('')}</div>` : ''}</div>
    <div class="grid" style="align-content:start">${cgCards}</div></div>
  <div style="height:14px"></div>${pri}${pri && loc ? '<div style="height:14px"></div>' : ''}${loc}`;
}

function postCard(p) {
  const st = postStatus(p), sp = S.st.posts[p.id] || {}, md = postMedia(p), idx = S.open[p.id] || 0, cur = md[idx];
  const isVid = cur && /\.mp4$|video/i.test(cur);
  const mediaHTML = cur ? (isVid ? `<video src="${esc(mediaURL(cur))}" controls playsinline preload="metadata" poster="${esc((cur.replace('.mp4', '-poster.jpg')))}"></video>` : `<img src="${esc(mediaURL(cur))}" alt="${esc(p.alt || '')}" loading="lazy">`) : `<div class="empty"><div><b>Chờ asset</b><br>${esc(p.brief || p.cta || '')}</div></div>`;
  const rev = p.review || {}, ap = S.st.approvals[p.id];
  const stPill = { posted: pill('Đã đăng', 'good'), ready: pill('Sẵn sàng', 'warn'), need: pill('Chờ asset', 'crit'), review: pill('Chờ duyệt', 'warn'), rejected: pill('Bị loại', 'crit') }[st];
  return `<article class="post glass" data-id="${esc(p.id)}">
    <div class="media" style="aspect-ratio:${/2:3/.test(p.format) ? '2/3' : /9:16/.test(p.format) ? '9/14' : /2:1/.test(p.format) ? '2/1' : /1:1/.test(p.format) ? '1/1' : '4/5'}">${mediaHTML}
      <div class="tag">${chPill(p.ch)}</div>${md.length > 1 ? `<span class="cnt">${idx + 1}/${md.length}</span><div class="nav">${md.map((_, i) => `<b class="${i === idx ? 'on' : ''}" data-slide="${i}"></b>`).join('')}</div>` : ''}</div>
    <div class="body">
      <div class="meta">${stPill}<span>${DOW[new Date(p.date + 'T00:00:00Z').getUTCDay()]} ${dLong(p.date)}</span>·<b>${esc(chl(p.channel))}</b>${(p.also || []).length ? `<span class="muted">+ ${p.also.map(chl).join(', ')}</span>` : ''}</div>
      <h4>${esc(p.hook || p.theme)}</h4>
      <div class="meta">${pill(esc(SKUN[p.sku] || p.sku))}<span>${esc(p.format)}</span>·<span>${esc(p.theme)}</span></div>
      ${p.title ? `<div class="cap"><b>Tiêu đề:</b> ${esc(p.title)}</div>` : ''}
      <div class="cap">${esc(p.caption)}${p.description ? '\n\n' + esc(p.description) : ''}${p.hashtags ? '\n\n' + esc(p.hashtags) : ''}</div>
      ${p.note ? `<div class="sub">⚑ ${esc(p.note)}</div>` : ''}
      ${rev.score ? `<div class="rev"><span class="score ${rev.score >= 85 ? 'lo' : 'md'}" style="width:36px;height:36px">${rev.score}</span><div><b>Director</b> · ${esc(rev.notes)}</div></div>` : ''}
      ${ap ? `<div class="sub">Quản lý ${ap.verdict === 'approve' ? 'đã duyệt' : 'đã loại'} · ${esc(ap.by || '')}</div>` : ''}
      ${st === 'posted' ? `<div class="done-mark">✓ Đã đăng ${sp.at ? dLong(sp.at.slice(0, 10)) : ''} ${sp.by ? '· ' + esc(sp.by) : ''}${sp.url ? ` · <a href="${esc(sp.url)}" target="_blank" rel="noopener">xem bài</a>` : ''}</div>` : ''}
      <div class="actions">
        <button class="btn sm" data-act="copy" data-id="${esc(p.id)}">Copy caption</button>
        ${p.variants ? Object.keys(p.variants).map(k => `<button class="btn sm" data-act="copyv" data-k="${esc(k)}" data-id="${esc(p.id)}">Copy ${esc(chl(k))}</button>`).join('') : ''}
        ${md.length ? `<button class="btn sm" data-act="dl" data-id="${esc(p.id)}">Tải ${md.length > 1 ? md.length + ' file' : 'file'}</button>` : ''}
        ${st === 'need' ? `<button class="btn sm soft" data-act="asset" data-id="${esc(p.id)}">Tải asset lên</button>` : ''}
        ${st === 'review' ? `<button class="btn sm ok" data-act="approve" data-id="${esc(p.id)}">Duyệt</button><button class="btn sm" data-act="reject" data-id="${esc(p.id)}">Loại</button>` : ''}
        ${st === 'posted' ? `<button class="btn sm" data-act="unpost" data-id="${esc(p.id)}">Bỏ đánh dấu</button>` : `<button class="btn sm pri" data-act="post" data-id="${esc(p.id)}" ${st === 'need' || st === 'rejected' ? 'disabled' : ''}>Đã đăng</button>`}
      </div>
    </div></article>`;
}

function viewPosts() {
  const t = todayISO();
  const F = [['ready', 'Sẵn sàng'], ['today', 'Hôm nay'], ['need', 'Chờ asset'], ['review', 'Chờ duyệt'], ['posted', 'Đã đăng'], ['all', 'Tất cả']];
  let list = S.hub.posts.filter(chOK);
  const f = S.postFilter;
  const SK = [['all', 'Mọi sản phẩm'], ['VESTRA', 'Vestra / kệ 3 tầng'], ['ZENA', 'Zena'], ['CALIX', 'Calix'], ['CALIX-FLOAT', 'Calix Floating'], ['PARKWAY', 'Caroline Parkway']];
  if (S.sku !== 'all') list = list.filter(p => p.sku === S.sku || (p.sku === 'VANITY' && S.sku !== 'VESTRA'));
  list = list.filter(p => { const s = postStatus(p); return f === 'all' || (f === 'today' ? p.date === t && s !== 'posted' : s === f); });
  list.sort((a, b) => f === 'posted' ? (S.st.posts[b.id].at || '').localeCompare(S.st.posts[a.id].at || '') : a.date.localeCompare(b.date));
  const cnt = k => S.hub.posts.filter(chOK).filter(p => { const s = postStatus(p); return k === 'all' || (k === 'today' ? p.date === t && s !== 'posted' : s === k); }).length;
  return `<div class="page-head"><div><h1>Bài đăng</h1><p class="sub">Global đăng bằng tiếng Anh, Local bằng tiếng Việt. Đăng xong bấm <b>Đã đăng</b> (dán link bài) — hub cập nhật cho cả team.</p></div></div>
  <div class="toolbar">${F.map(([k, l]) => `<button class="chip" data-pf="${k}" aria-pressed="${f === k}">${l} · ${cnt(k)}</button>`).join('')}</div>
  <div class="toolbar">${SK.map(([k, l]) => `<button class="chip" data-sk="${k}" aria-pressed="${S.sku === k}">${l}</button>`).join('')}</div>
  ${list.length ? `<div class="posts">${list.map(postCard).join('')}</div>` : '<div class="empty glass card">Không có bài trong mục này.</div>'}`;
}

function viewCal() {
  const t = todayISO(), [y, m] = S.calMonth.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)), start = addDays(first.toISOString().slice(0, 10), -((first.getUTCDay() + 6) % 7));
  const slots = S.hub.calendar.filter(chOK), byDay = {}; for (const s of slots) (byDay[s.date] = byDay[s.date] || []).push(s);
  const postsById = Object.fromEntries(S.hub.posts.map(p => [p.id, p]));
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), inM = +d.slice(5, 7) === m;
    const ev = (byDay[d] || []).map(s => s.event).filter(Boolean);
    cells += `<div class="day ${inM ? '' : 'out'} ${d === t ? 'today' : ''}"><div class="d"><span>${+d.slice(8)}</span></div>${ev.length ? `<div class="ev">${esc([...new Set(ev)].join(' · '))}</div>` : ''}
      ${(byDay[d] || []).map(s => { const p = s.post && postsById[s.post]; const st = p ? postStatus(p) : 'plan'; const cls = { posted: 'st-posted', ready: 'st-ready', need: 'st-need', review: 'st-ready', rejected: 'st-need', plan: 'st-plan' }[st]; return `<div class="slot ${s.ch === 'global' ? 'g' : 'l'} ${cls}" data-slot="${esc(s.id)}" title="${esc(s.theme)}">${st === 'posted' ? '✓ ' : ''}${esc(chl(p ? p.channel : s.channel))}${p ? '' : ' · ' + esc(s.theme.split(' — ').pop().slice(0, 22))}</div>`; }).join('')}</div>`;
    if (i >= 34 && addDays(start, i + 1).slice(5, 7) != String(m).padStart(2, '0') && (i + 1) % 7 === 0) break;
  }
  const mm = d => { const [a, b] = d.split('-').map(Number); return `Tháng ${b}/${a}`; };
  const prev = (() => { const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 7); })(), next = (() => { const d = new Date(Date.UTC(y, m, 1)); return d.toISOString().slice(0, 7); })();
  const inMonth = slots.filter(s => s.date.slice(0, 7) === S.calMonth), withPost = inMonth.filter(s => s.post).length;
  return `<div class="page-head"><div><h1>Lịch nội dung</h1><p class="sub">${slots.length} slot đến ${dLong(S.hub.meta.horizon)}. Planner tự viết bài cho các slot trong 14 ngày tới mỗi sáng; slot xa hơn là kế hoạch chủ đề.</p></div>
    <div class="row"><button class="btn sm" data-cal="${prev}">‹</button><b>${mm(S.calMonth)}</b><button class="btn sm" data-cal="${next}">›</button><button class="btn sm" data-cal="${t.slice(0, 7)}">Hôm nay</button></div></div>
  <div class="legend" style="margin:0 4px 10px">${pill('Global', 'g')} ${pill('Local', 'l')} <span>✓ viền xanh: đã đăng · viền nâu: bài sẵn sàng · viền cam đứt: chờ asset · mờ: kế hoạch chủ đề</span><span class="muted">${withPost}/${inMonth.length} slot tháng này đã có bài</span></div>
  <div class="cal glass card">${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => `<div class="dow">${d}</div>`).join('')}${cells}</div>`;
}

function viewStudio() {
  const items = S.hub.studio.filter(chOK);
  return `<div class="page-head"><div><h1>Gemini Studio</h1><p class="sub">Ảnh/video lifestyle chân thực tạo trong <b>app Gemini (gói Pro hiện có, không phát sinh phí)</b>: tải ảnh tham chiếu → dán prompt → tải kết quả lên đây. Prompt đã khoá hình dáng sản phẩm và cấm logo hãng khác.</p></div>
  <a class="btn pri" href="https://gemini.google.com/app" target="_blank" rel="noopener">Mở Gemini ↗</a></div>
  <div class="studio">${items.map(g => { const s = S.st.studio[g.id] || {}; return `<div class="card glass" data-gs="${esc(g.id)}"><div class="card-head"><div><div class="row">${chPill(g.ch)}${pill(g.kind === 'video' ? 'Video · Veo' : 'Ảnh · Nano Banana Pro')}${pill(g.aspect)}${s.asset ? pill('Đã có kết quả', 'good') : pill('Cần làm', 'warn')}</div><h3 style="margin-top:8px">${esc(g.id)} · ${esc(g.title)}</h3></div></div>
    <div class="row" style="margin-bottom:8px"><div class="refs">${g.refs.map(r => `<a href="${esc(r)}" download><img src="${esc(r)}" alt="ref"></a>`).join('')}</div><span class="sub">← tải ảnh tham chiếu, đính kèm vào Gemini</span></div>
    <div class="prompt">${esc(g.prompt)}</div>
    <div class="actions" style="margin-top:8px"><button class="btn sm" data-act="copyp" data-id="${esc(g.id)}">Copy prompt</button><button class="btn sm soft" data-act="gsup" data-id="${esc(g.id)}">Tải kết quả lên</button></div>
    ${s.asset ? `<div style="margin-top:10px">${/video|\.mp4|\.mov/i.test(s.asset) ? `<video src="${esc(mediaURL(s.asset))}" controls style="width:100%;border-radius:12px"></video>` : `<img src="${esc(mediaURL(s.asset))}" style="width:100%;border-radius:12px">`}<p class="sub">Tải lên bởi ${esc(s.by || '')} · ${s.at ? dLong(s.at.slice(0, 10)) : ''}. Guardian: kiểm tra đúng sản phẩm (3 tầng, viền khay cong, khung gỗ, 4 bánh) & không có logo.</p></div>` : ''}
  </div>`; }).join('')}</div>`;
}

function viewSeed() {
  const rows = S.hub.seeding.filter(chOK);
  const grp = {}; for (const r of rows) (grp[r.ch] = grp[r.ch] || []).push(r);
  return `<div class="page-head"><div><h1>Nơi seeding</h1><p class="sub">Đăng bằng tài khoản thật của brand/shop, ghi rõ là người bán. Không tạo nick ảo, không review giả (FTC, Amazon, Wayfair, Meta đều cấm và khoá tài khoản). Luôn đọc luật group/sub trước.</p></div></div>
  ${Object.entries(grp).map(([ch, list]) => `<div class="card glass" style="margin-bottom:14px"><div class="card-head"><h3>${ch === 'global' ? 'Global · US (tiếng Anh)' : 'Local · Việt Nam'}</h3></div><div class="tbl"><table><thead><tr><th>Kênh</th><th>Nơi đăng</th><th>Góc nội dung</th><th>Luật quảng cáo</th><th>Hợp</th></tr></thead><tbody>
  ${list.sort((a, b) => b.fit - a.fit).map(r => `<tr><td>${pill(esc(r.platform))}</td><td><a href="${esc(r.url)}" target="_blank" rel="noopener"><b>${esc(r.name)}</b></a>${r.verified ? '' : '<div class="sub">kiểm tra luật trước khi đăng</div>'}</td><td class="sub">${esc(r.angle)}</td><td class="sub">${esc(r.promo)}</td><td>${'★'.repeat(r.fit)}<span class="muted">${'★'.repeat(5 - r.fit)}</span></td></tr>`).join('')}
  </tbody></table></div></div>`).join('')}`;
}

function viewLib() {
  const items = S.hub.media.filter(chOK).concat((S.st.uploads || []).map(u => ({ id: u.path.split('/').pop(), path: u.path, kind: u.kind, title: 'Tải lên · ' + (u.by || ''), ch: u.ch || 'all', source: 'Upload', created: (u.at || '').slice(0, 10) })));
  const used = {}; for (const p of S.hub.posts) for (const x of p.media || []) used[x] = (used[x] || 0) + 1;
  return `<div class="page-head"><div><h1>Thư viện asset</h1><p class="sub">Toàn bộ là thiết kế mới cho hub, dựng từ ảnh sản phẩm tách nền (không dùng lại nguyên ảnh listing cũ). Số lần dùng giúp tránh lặp hình — asset dùng ≥ 3 lần sẽ được agent hạn chế.</p></div></div>
  <div class="lib">${items.map(i => `<div class="it">${i.kind === 'video' ? `<video src="${esc(mediaURL(i.path))}" muted playsinline preload="metadata" poster="${esc(i.poster || '')}"></video>` : `<img src="${esc(mediaURL(i.path))}" loading="lazy" alt="">`}<div><b>${esc(i.title)}</b><br><span class="muted">${esc(i.aspect || '')} · dùng ${used[i.path] || 0} lần</span> · <a href="${esc(mediaURL(i.path))}" download>tải</a></div></div>`).join('')}</div>`;
}

function viewAgents() {
  const H = S.hub, teams = ['Chỉ huy', 'Sáng tạo', 'Phân phối', 'Kiểm soát'];
  return `<div class="page-head"><div><h1>Đội agent</h1><p class="sub">${esc(H.meta.note)} · Cập nhật lần cuối: ${esc((H.meta.updated || '').replace('T', ' ').slice(0, 16))} UTC${H.meta.lastRun ? ` · agent chạy: ${esc(H.meta.lastRun)}` : ''}</p></div></div>
  ${(H.meta.trends || H.meta.insights) ? `<div class="grid g2" style="margin-bottom:14px">${H.meta.trends ? `<div class="card glass"><h3>Trend Scout · ${esc(H.meta.trends.at || '')}</h3><p class="sub"><b>US:</b> ${esc((H.meta.trends.global || []).join(' · '))}</p><p class="sub"><b>VN:</b> ${esc((H.meta.trends.local || []).join(' · '))}</p></div>` : ''}${H.meta.insights ? `<div class="card glass"><h3>Performance Analyst · ${esc(H.meta.insights.at)}</h3>${H.meta.insights.list.map(x => `<p class="sub">• ${esc(x)}</p>`).join('')}</div>` : ''}</div>` : ''}
  <div class="card glass" style="margin-bottom:14px"><div class="flow"><span>COO chấm SKU</span>→<span>Planner xếp slot</span>→<span>Trend Scout</span>→<span>Strategist viết brief</span>→<span>Visual / Motion tạo asset</span>→<span>Copywriter đa kênh</span>→<span>Guardian soát luật</span>→<span>Director duyệt ≥ 80</span>→<span>Bạn đăng · bấm Đã đăng</span>→<span>Analyst học lại</span></div></div>
  ${teams.map(t => `<h3 style="margin:16px 4px 10px">${t}</h3><div class="agents">${H.agents.filter(a => a.team === t).map(a => `<div class="agent glass" data-team="${esc(a.team)}"><div class="row"><span class="av">${esc(a.icon)}</span><b>${esc(a.name)}</b></div><div class="sub">${esc(a.role)}</div><details><summary class="sub">System prompt</summary><div class="prompt">${esc(a.prompt)}</div></details></div>`).join('')}</div>`).join('')}`;
}

/* ---------------- modals ---------------- */
function postModal(p) {
  const chans = [p.channel, ...(p.also || [])];
  modal(`<h3>Đánh dấu đã đăng · ${esc(p.id)}</h3><p class="sub">${esc(p.hook || p.theme)}</p>
    <div class="row">${chans.map(c => `<label class="chk"><input type="checkbox" data-ch="${esc(c)}" checked> ${esc(chl(c))}</label>`).join('')}</div>
    <label>Link bài đăng (không bắt buộc)<input id="pUrl" placeholder="https://…"></label>
    <div class="grid g3"><label>Reach<input id="pReach" inputmode="numeric"></label><label>Click<input id="pClick" inputmode="numeric"></label><label>Đơn<input id="pOrd" inputmode="numeric"></label></div>
    <p class="sub">Số liệu có thể bổ sung sau — Performance Analyst dùng để chọn dạng bài hiệu quả.</p>
    <div class="foot"><button class="btn" data-close>Huỷ</button><button class="btn pri" id="pGo">Đã đăng</button></div>`, m => {
    $('#pGo', m).onclick = async () => {
      const rec = { status: 'posted', at: new Date().toISOString(), by: S.user, url: $('#pUrl', m).value.trim(), channels: $$('input[data-ch]', m).filter(x => x.checked).map(x => x.dataset.ch), metrics: { reach: +$('#pReach', m).value || null, clicks: +$('#pClick', m).value || null, orders: +$('#pOrd', m).value || null } };
      closeModal(); await saveState(`posted: ${p.id}`, { posts: { [p.id]: Object.assign({}, S.st.posts[p.id] || {}, rec) } }); toast('✓ Đã đánh dấu đăng'); render();
    };
  });
}
function uploadModal(title, onDone) {
  modal(`<h3>${esc(title)}</h3><div class="drop" id="drop">Kéo thả ảnh/video vào đây hoặc bấm để chọn<input type="file" id="file" accept="image/*,video/*" hidden></div><p class="sub" id="upMsg"></p><div class="foot"><button class="btn" data-close>Đóng</button></div>`, m => {
    const d = $('#drop', m), f = $('#file', m);
    const go = async file => { $('#upMsg', m).textContent = 'Đang tải lên…'; try { const u = await uploadFile(file); await onDone(u); closeModal(); toast('Đã tải lên'); render(); } catch (e) { $('#upMsg', m).textContent = e.message; } };
    d.onclick = () => f.click(); f.onchange = () => f.files[0] && go(f.files[0]);
    d.ondragover = e => { e.preventDefault(); d.classList.add('on'); }; d.ondragleave = () => d.classList.remove('on');
    d.ondrop = e => { e.preventDefault(); d.classList.remove('on'); e.dataTransfer.files[0] && go(e.dataTransfer.files[0]); };
  });
}
function settingsModal() {
  const t = token();
  modal(`<h3>Cài đặt</h3>
    <div class="card" style="background:rgba(255,255,255,.6)"><b>GitHub token (đồng bộ “Đã đăng” & tải file)</b><p class="sub">Tạo fine-grained token: GitHub → Settings → Developer settings → Fine-grained tokens → chỉ chọn repo <b>Content-Hub</b> → Contents: <b>Read and write</b>. Token chỉ lưu trên thiết bị này.</p>
      <label>Token<input id="tok" type="password" placeholder="${t ? '•••••••• (đã lưu)' : 'github_pat_…'}"></label><div class="row"><button class="btn sm pri" id="tokSave">Lưu token</button>${t ? '<button class="btn sm" id="tokDel">Xoá token</button>' : ''}</div></div>
    <div class="card" style="background:rgba(255,255,255,.6)"><b>Kết nối dashboard</b><p class="sub">Global: ${S.G ? '✓ đã kết nối' : '✗ chưa'} · Local: ${S.L ? '✓ đã kết nối' : '✗ chưa'}</p>
      <div class="grid g2"><label>Tài khoản<input id="cU"></label><label>Mật khẩu<input id="cP" type="password"></label></div><button class="btn sm pri" id="cGo">Kết nối</button><p class="sub" id="cMsg"></p></div>
    <div class="row"><label style="flex:1">Tên hiển thị khi bấm “Đã đăng”<input id="who" value="${esc(S.user)}"></label></div>
    <div class="foot"><button class="btn" id="logout">Đăng xuất</button><button class="btn pri" data-close>Xong</button></div>`, m => {
    $('#tokSave', m).onclick = async () => { const v = $('#tok', m).value.trim(); if (!v) return; const r = await fetch(`https://api.github.com/repos/${CFG.OWNER}/${CFG.REPO}`, { headers: { Authorization: 'Bearer ' + v } }); if (!r.ok) return toast('Token không đọc được repo (' + r.status + ')'); const j = await r.json(); if (j.permissions && !j.permissions.push) return toast('Token chưa có quyền ghi'); store.set('ch-token', v); toast('Đã lưu token'); await loadState(); const pend = store.get('ch-pending'); if (pend) await saveState('sync pending', JSON.parse(pend)); closeModal(); render(); };
    const del = $('#tokDel', m); if (del) del.onclick = () => { store.del('ch-token'); toast('Đã xoá token'); closeModal(); };
    $('#cGo', m).onclick = async () => { const u = $('#cU', m).value, p = $('#cP', m).value; $('#cMsg', m).textContent = 'Đang mở…'; const r = await tryUnlock(u, p); $('#cMsg', m).textContent = r.length ? '✓ ' + r.join(', ') : 'Sai tài khoản/mật khẩu'; if (r.length) { await loadSources(); render(); } };
    $('#who', m).onchange = e => { S.user = e.target.value.trim(); store.set('ch-user', S.user); };
    $('#logout', m).onclick = () => { ['ch-lg', 'ch-lf'].forEach(store.del); location.reload(); };
  });
}

/* ---------------- render & events ---------------- */
function counts() { const t = todayISO(); return { posts: S.hub.posts.filter(chOK).filter(p => { const s = postStatus(p); return s === 'ready' && p.date <= t; }).length }; }
function render() {
  const c = counts();
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${l}${k === 'posts' && c.posts ? `<span class="n">${c.posts}</span>` : ''}</button>`).join('');
  $('#tabbar').innerHTML = TABS.filter(t => t[0] !== 'lib').map(([k, l, i]) => `<button data-tab="${k}" aria-selected="${S.tab === k}"><b>${i}</b>${l}</button>`).join('');
  $$('#chSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.ch === S.ch));
  const v = { coo: viewCOO, posts: viewPosts, cal: viewCal, studio: viewStudio, seed: viewSeed, lib: viewLib, agents: viewAgents }[S.tab] || viewCOO;
  $('#view').innerHTML = v();
  $('#stamp').textContent = `Nội dung cập nhật ${(S.hub.meta.updated || '').slice(0, 10)} · ${[S.G && 'Global', S.L && 'Local'].filter(Boolean).join(' + ') || 'chưa nối dashboard'}`;
}
document.addEventListener('click', async e => {
  const tb = e.target.closest('[data-tab]'); if (tb) { S.tab = tb.dataset.tab; store.set('ch-tab', S.tab); render(); scrollTo({ top: 0, behavior: 'smooth' }); return; }
  const cs = e.target.closest('#chSeg button'); if (cs) { S.ch = cs.dataset.ch; store.set('ch-ch', S.ch); render(); return; }
  const sk = e.target.closest('[data-sk]'); if (sk) { S.sku = sk.dataset.sk; render(); return; }
  const pf = e.target.closest('[data-pf]'); if (pf) { S.postFilter = pf.dataset.pf; render(); return; }
  const cm = e.target.closest('[data-cal]'); if (cm) { S.calMonth = cm.dataset.cal; render(); return; }
  const sl = e.target.closest('[data-slide]'); if (sl) { const id = sl.closest('.post').dataset.id; S.open[id] = +sl.dataset.slide; render(); return; }
  const md = e.target.closest('.post .media img'); if (md) { const card = md.closest('.post'), p = S.hub.posts.find(x => x.id === card.dataset.id), n = postMedia(p).length; if (n > 1) { S.open[p.id] = ((S.open[p.id] || 0) + 1) % n; render(); } return; }
  const slot = e.target.closest('[data-slot]'); if (slot) {
    const s = S.hub.calendar.find(x => x.id === slot.dataset.slot), p = s.post && S.hub.posts.find(x => x.id === s.post);
    if (p) modal(`<div class="posts" style="grid-template-columns:1fr">${postCard(p)}</div><div class="foot"><button class="btn" data-close>Đóng</button></div>`);
    else modal(`<h3>${dLong(s.date)} · ${esc(chl(s.channel))}</h3>${chPill(s.ch)}<p><b>Chủ đề:</b> ${esc(s.theme)}</p><p class="sub">Định dạng: ${esc(s.format)} · SKU: ${esc(s.sku)}${s.event ? ' · Sự kiện: ' + esc(s.event) : ''}</p><p class="sub">Strategist + Copywriter sẽ viết bài cho slot này khi nó vào cửa sổ 14 ngày; Director duyệt trước khi hiện ở tab Bài đăng.</p><div class="foot"><button class="btn" data-close>Đóng</button></div>`);
    return;
  }
  if (e.target.closest('#settingsBtn')) { settingsModal(); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const id = a.dataset.id, p = S.hub.posts.find(x => x.id === id);
  switch (a.dataset.act) {
    case 'copy': copy([p.title ? p.title : '', p.caption, p.description || '', p.hashtags || ''].filter(Boolean).join('\n\n')); break;
    case 'copyv': copy(p.variants[a.dataset.k]); break;
    case 'dl': for (const x of postMedia(p)) { const l = document.createElement('a'); l.href = mediaURL(x); l.download = x.split('/').pop(); document.body.appendChild(l); l.click(); l.remove(); await new Promise(r => setTimeout(r, 250)); } break;
    case 'post': postModal(p); break;
    case 'unpost': await saveState(`unposted: ${id}`, { posts: { [id]: { status: 'planned', at: null } } }); render(); break;
    case 'approve': case 'reject': await saveState(`${a.dataset.act}: ${id}`, { approvals: { [id]: { verdict: a.dataset.act, by: S.user, at: new Date().toISOString() } } }); render(); break;
    case 'asset': uploadModal('Tải asset cho ' + id, async u => { u.ch = p.ch; await saveState(`asset: ${id}`, { posts: { [id]: Object.assign({}, S.st.posts[id] || {}, { asset: u.path }) }, uploads: [u] }); }); break;
    case 'copyp': copy(S.hub.studio.find(g => g.id === id).prompt); break;
    case 'gsup': { const g = S.hub.studio.find(x => x.id === id); uploadModal('Kết quả Gemini · ' + id, async u => { u.ch = g.ch; await saveState(`studio: ${id}`, { studio: { [id]: { status: 'done', asset: u.path, by: S.user, at: u.at } }, uploads: [u] }); }); break; }
  }
});

/* ---------------- boot ---------------- */
async function tryUnlock(user, pass) {
  const ok = [];
  const [g, l] = await Promise.allSettled([unlockGlobal(user, pass), unlockLocal(user, pass)]);
  const keep = $('#remember') ? $('#remember').checked : true;
  if (g.status === 'fulfilled') { S.keys.lg = b64e(g.value); store.set('ch-lg', S.keys.lg, keep); ok.push('Global'); }
  if (l.status === 'fulfilled') { S.keys.lf = b64e(l.value); store.set('ch-lf', S.keys.lf, keep); ok.push('Local'); }
  return ok;
}
async function boot() {
  S.hub = await getJSON('data/hub.json');
  await Promise.all([loadState(), loadSources()]);
  $('#login').hidden = true; $('#app').hidden = false; render();
  setInterval(async () => { if (document.hidden) return; await loadState(); if (!$('#modal').hidden) return; const y = scrollY; render(); scrollTo(0, y); }, 60000);
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const err = $('#loginErr'), btn = $('#loginBtn'); err.hidden = true; btn.disabled = true; btn.textContent = 'Đang mở dữ liệu…';
  const u = $('#user').value, p = $('#pass').value;
  try { const r = await tryUnlock(u, p); if (!r.length) throw new Error('Tài khoản hoặc mật khẩu không đúng với Dashboard Global/Local.'); if (!S.user) { S.user = u.split('@')[0]; store.set('ch-user', S.user); } await boot(); }
  catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Đăng nhập'; }
});
S.keys.lg = store.get('ch-lg'); S.keys.lf = store.get('ch-lf');
if (S.keys.lg || S.keys.lf) boot().catch(() => { $('#login').hidden = false; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
