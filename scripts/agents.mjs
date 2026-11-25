// Content Hub agent run — GitHub Actions + Gemini API FREE tier (text models only, no billing needed).
// Fills calendar slots in the next 14 days with new posts: Strategist+Copywriter → Guardian → Director (→ one revision).
// Images: picks the least-used new asset from the library; when all suitable assets are worn out, creates a Gemini Studio task instead.
import fs from 'fs';

const KEY = process.env.GEMINI_API_KEY;
const MAX = +(process.env.MAX_POSTS || 8);
const HUB = 'data/hub.json', STATE = 'data/state.json';
if (!KEY) { console.log('GEMINI_API_KEY not set — skipping agent run (add it in repo Settings → Secrets → Actions).'); process.exit(0); }
const hub = JSON.parse(fs.readFileSync(HUB, 'utf8'));
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { posts: {} };
const vnToday = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function pickModel() {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  try {
    const r = await fetch(`${BASE}/models?key=${KEY}&pageSize=200`); const j = await r.json();
    const names = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', ''));
    const ok = n => /flash/.test(n) && !/image|tts|audio|live|embedding|thinking-exp|preview-tts|veo|omni/.test(n);
    CANDS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-flash-lite-latest'].filter(n => names.includes(n)); console.log('models', names.filter(ok).join(','));
    return names.find(n => n === 'gemini-flash-latest') || names.filter(ok).filter(n => !/lite/.test(n)).sort().reverse()[0] || names.filter(ok).sort().reverse()[0] || 'gemini-flash-latest';
  } catch (e) { return 'gemini-flash-latest'; }
}
let MODEL, CANDS = [];
async function ask(system, user, tries = 4) {
  for (const m of [MODEL, ...CANDS.filter(c => c !== MODEL)].slice(0, 4)) { try { const out = await ask1(m, system, user, tries); if (MODEL !== m) { console.log('switch model ->', m); MODEL = m; } return out; } catch (e) { console.log('model fail', m, e.message.slice(0, 300)); if (!/quota|429|404|not found|NOT_FOUND|timeout/i.test(e.message)) throw e; } }
  throw new Error('Gemini quota/timeout');
}
async function ask1(MODEL, system, user, tries) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0.9, responseMimeType: 'application/json' } }) });
    if (r.status === 429 || r.status >= 500) { const b = await r.text(); console.log('http', r.status, MODEL, b.slice(0, 300)); if (r.status === 429 && /limit: 0|PerDay/.test(b)) throw new Error('quota 429 ' + b.slice(0, 200)); await sleep(15000 * (i + 1)); continue; }
    const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 400));
    const t = (((j.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text).join('') || '{}';
    try { return JSON.parse(t.replace(/^```json|```$/g, '')); } catch (e) { if (i === tries - 1) throw e; }
  }
  throw new Error('Gemini quota/timeout');
}
const A = id => hub.agents.find(a => a.id === id);
const prod = (ch, sku) => { if (ch === 'local') return hub.products.local; const V = hub.products.vanities || {};
  if (sku && sku !== 'VESTRA') { const v = V[sku]; if (v) return { ...v, specs: v.sizes + '; ' + v.specs, amazon: 'Amazon & Wayfair (search "Lignarc")' };
    return { name: 'Lignarc bathroom vanities (Zena, Calix, Calix Floating, Caroline Parkway)', specs: Object.values(V).map(v => v.name + ': ' + v.sizes + ', ' + v.specs).join(' | '), colors: ['Light Oak', 'Dark Oak', 'Black Oak', 'Grey'], amazon: 'Amazon & Wayfair' } }
  return hub.products.global_; };
const BAN = /\b(marshall|smeg|ikea|target|walmart|best[- ]selling|#1|number one|cheapest|guarantee[ds]?|lowest price)\b|rẻ nhất|tốt nhất thị trường|số 1/i;

function usage() { const u = {}; for (const p of hub.posts) for (const m of p.media || []) u[m] = (u[m] || 0) + 1; return u; }
function pickMedia(ch, format, sku) {
  const u = usage(), want = /9:16|reel|video|tiktok/i.test(format) ? 'video' : 'image';
  const asp = /2:3|pin/i.test(format) ? '2:3' : /2:1|waymore/i.test(format) ? '2:1' : null;
  const pool = hub.media.filter(m => m.ch === ch && (ch === 'local' || m.sku === sku || (sku !== 'VESTRA' && m.sku === 'VANITY') || (sku === 'VANITY' && m.sku !== 'VESTRA')) && m.kind === want && (!asp || m.aspect === asp) && !/carousel-[2-5]/.test(m.path))
    .concat((state.uploads || []).filter(x => x.ch === ch && x.kind === want).map(x => ({ path: x.path })))
    .filter(m => !m.raw).map(m => ({ ...m, n: (u[m.path] || 0) + (/^v1/.test(m.source || '') ? 2 : 0) })).sort((a, b) => a.n - b.n);
  return pool.length && pool[0].n < 3 ? pool[0].path : null;
}
const recent = ch => hub.posts.filter(p => p.ch === ch).slice(-25).map(p => `- ${p.hook}`).join('\n');

async function writePost(slot, notes = '') {
  const P = prod(slot.ch, slot.sku), lang = slot.ch === 'global' ? 'English (US audience)' : 'Vietnamese (Vietnam Shopee shoppers)';
  const trends = (hub.meta.trends || {})[slot.ch] || [];
  const sys = [A('strategist').prompt, A('copy').prompt, A('trend').prompt].join('\n\n') + `\nWrite ONLY in ${lang}. Product facts you may use (never invent others): ${P.name}; ${P.specs}; colours: ${P.colors.join(', ')}. ` +
    (slot.ch === 'global' ? `Brand: Lignarc — warm, calm, design-led; sold on Amazon (${P.amazon}) and Wayfair. Product line for this slot: ${slot.sku}. Amazon Posts no longer exists.` : `Thương hiệu: Living Furniture — gần gũi, thực tế; bán trên Shopee (${P.shopee}).`) +
    ' Never mention other brands, never promise a price or % discount, never claim best/#1, never write fake testimonials. Seeding posts must disclose the brand.';
  const user = `Slot: ${slot.date} · channel ${slot.channel} · format ${slot.format} · theme "${slot.theme}"${slot.event ? ' · event ' + slot.event : ''}.
Trends to consider: ${trends.join(' | ') || 'n/a'}
Avoid repeating these recent hooks:\n${recent(slot.ch)}
${notes ? 'Director feedback to fix: ' + notes : ''}
Return JSON: {"hook": str, "title": str|null (Pinterest/Reddit only), "caption": str, "description": str|null (Pinterest only), "hashtags": str, "alt": str, "cta": str, "brief": str (shot list / visual direction in ${slot.ch === 'global' ? 'Vietnamese for the in-house team' : 'Vietnamese'}), "variants": {channel: caption} (0-2 extra channels), "image_prompt": str (English, photoreal lifestyle scene for Gemini image editing that keeps the product identical, unbranded props)}`;
  return ask(sys, user);
}
async function review(slot, post) {
  const issues = []; const txt = [post.hook, post.caption, post.description, post.title].join(' ');
  if (BAN.test(txt)) issues.push('banned claim/brand: ' + txt.match(BAN)[0]);
  if (/\d+\s?%/.test(txt)) issues.push('mentions a % discount');
  const d = await ask(A('director').prompt, `Market: ${slot.ch === 'global' ? 'US (English)' : 'Vietnam (Vietnamese)'}; channel ${slot.channel}; theme ${slot.theme}.\nPost JSON:\n${JSON.stringify(post)}\nGuardian issues: ${issues.join('; ') || 'none'}`);
  return { score: +d.score || 0, verdict: d.verdict, notes: d.notes || '', issues };
}

(async () => {
  MODEL = await pickModel(); console.log('model', MODEL);
  // weekly trend scout (Mondays) — model knowledge only, free tier
  if (new Date(vnToday + 'T00:00:00Z').getUTCDay() === 1 || !hub.meta.trends) {
    try {
      const g = await ask(A('trend').prompt, 'Market: United States, English. Return JSON {"trends": [3 short strings]}');
      const l = await ask(A('trend').prompt, 'Market: Vietnam (Shopee/TikTok/Facebook), write in Vietnamese. Return JSON {"trends": [3 short strings]}');
      hub.meta.trends = { global: g.trends || [], local: l.trends || [], at: vnToday };
    } catch (e) { console.log('trend skip', e.message); }
  }
  const slots = hub.calendar.filter(s => !s.post && s.date >= vnToday && s.date <= addDays(vnToday, 13)).sort((a, b) => a.date.localeCompare(b.date));
  let made = 0;
  for (const slot of slots) {
    if (made >= MAX) break;
    try {
      let post = await writePost(slot); await sleep(4000);
      let rv = await review(slot, post); await sleep(4000);
      if (rv.score < 80 && rv.score >= 60) { post = await writePost(slot, rv.notes + ' ' + rv.issues.join('; ')); await sleep(4000); rv = await review(slot, post); await sleep(4000); }
      const media = pickMedia(slot.ch, slot.format, slot.sku);
      const id = `${slot.ch === 'global' ? 'G' : 'L'}-${slot.date.slice(5).replace('-', '')}-${slot.channel.slice(0, 2).toUpperCase()}${Math.random().toString(36).slice(2, 4)}`;
      let status = rv.issues.length ? 'review' : rv.score >= 80 ? 'approved' : 'review';
      if (!media && status === 'approved') status = 'needs-asset';
      if (!media && post.image_prompt) hub.studio.push({ id: 'GS-' + id, ch: slot.ch, title: post.hook, aspect: /9:16/.test(slot.format) ? '9:16' : /2:3/.test(slot.format) ? '2:3' : '4:5', kind: /video|reel|9:16/i.test(slot.format) ? 'video' : 'image',
        prompt: post.image_prompt, refs: [slot.ch === 'local' ? 'media/ref/vestra-green-angle.jpg' : ({ ZENA: 'media/ref/zena60-light.jpg', CALIX: 'media/ref/calix60-dark.jpg', 'CALIX-FLOAT': 'media/ref/float24-black.jpg', PARKWAY: 'media/ref/parkway36-grey.jpg' }[slot.sku] || 'media/ref/vestra-white-angle.jpg')], status: 'todo', tool: 'Gemini app (Pro)' });
      hub.posts.push({ id, ch: slot.ch, date: slot.date, channel: slot.channel, also: Object.keys(post.variants || {}), format: slot.format, theme: slot.theme, sku: slot.sku, media: media ? [media] : [],
        hook: post.hook, title: post.title || undefined, caption: post.caption, description: post.description || undefined, hashtags: post.hashtags || '', alt: post.alt || '', cta: post.cta || '', brief: post.brief || '', variants: post.variants || undefined,
        status, review: { by: 'director', score: rv.score, notes: rv.notes, verdict: rv.verdict }, guardian: { pass_: !rv.issues.length, issues: rv.issues }, by: `Gemini ${MODEL} (agents)`, created: vnToday });
      slot.post = id; made++; console.log('post', id, rv.score, status);
    } catch (e) { console.log('slot fail', slot.id, e.message); if (/quota|429/.test(e.message)) break; }
  }
  // weekly analyst
  const posted = hub.posts.filter(p => state.posts[p.id] && state.posts[p.id].status === 'posted' && state.posts[p.id].metrics);
  if (posted.length >= 5 && new Date(vnToday + 'T00:00:00Z').getUTCDay() === 1) {
    try { const a = await ask(A('analyst').prompt, 'Data JSON:\n' + JSON.stringify(posted.map(p => ({ ch: p.ch, channel: p.channel, format: p.format, theme: p.theme, ...state.posts[p.id].metrics })) ) + '\nReturn JSON {"insights": [3 short strings in Vietnamese]}'); hub.meta.insights = { at: vnToday, list: a.insights || [] }; } catch (e) {}
  }
  hub.meta.updated = new Date().toISOString().slice(0, 19) + 'Z'; hub.meta.lastRun = `${vnToday} · ${made} bài mới · ${MODEL}`;
  fs.writeFileSync(HUB, JSON.stringify(hub, null, 1));
  console.log('done', made);
})();
