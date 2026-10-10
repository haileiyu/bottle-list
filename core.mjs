export const emptyState = () => ({version: 1, wines: [], merchants: {}});
export function webUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Enter an http or https product link');
  url.hash = '';
  for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(k)) url.searchParams.delete(k);
  if (url.href.length > 2000) throw new Error('Link is too long (2,000 characters max)');
  return url.href;
}
export const merchantId = url => new URL(webUrl(url)).hostname.toLowerCase().replace(/^www\./, '');
// Shops write names in ALL CAPS or all lowercase; both become Title Case. A name that already
// mixes cases is kept as the shop wrote it. Wine conventions: linking words stay lowercase
// ("Châteauneuf-du-Pape", "Brunello di Montalcino", "Domaine de la Romanée-Conti"), labels and
// numerals stay capitals ("NV", "DOCG", "XIII"), and sizes read "750ml" or "1.5L".
const KEEP_UPPER = new Set(['NV', 'AOC', 'AOP', 'DOC', 'DOCG', 'IGT', 'IGP', 'AVA', 'VDP', 'VS', 'VSOP', 'XO', 'USA', 'UK', 'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XII', 'XIII']);
const KEEP_LOWER = new Set(['de', 'du', 'des', 'di', 'da', 'del', 'della', 'dei', 'do', 'dos', 'von', 'van', 'und', 'and', 'of', 'the', 'et', 'y', 'e', 'au', 'aux', 'sur', 'sous', 'en', 'x']);
const capital = text => text.charAt(0).toUpperCase() + text.slice(1);
export function titleCase(value) {
  const text = String(value ?? '');
  if (!/\p{L}/u.test(text) || (text !== text.toUpperCase() && text !== text.toLowerCase())) return text;
  let previous = '';
  return text.toLowerCase().split(' ').map((word, index) => {
    const [, before, core, after] = word.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
    const unit = core.match(/^(\d+(?:[.,]\d+)?)?(ml|cl|l)$/);
    let out;
    if (KEEP_UPPER.has(core.toUpperCase())) out = core.toUpperCase();
    else if (unit) out = (unit[1] || '') + (unit[2] === 'l' ? 'L' : unit[2]);
    else out = core.split('-').map((part, i) => {
      if ((index > 0 || i > 0) && (KEEP_LOWER.has(part) || (['la', 'le', 'les'].includes(part) && (i > 0 || previous === 'de')))) return part;
      const elided = part.match(/^([dl])['’](.+)$/);
      if (elided) return (index === 0 && i === 0 ? elided[1].toUpperCase() : elided[1]) + part[1] + capital(elided[2]);
      return capital(part);
    }).join('-');
    if (core) previous = core;
    return before + out + after;
  }).join(' ');
}
// Names read "<vintage> <producer> <wine>", like CellarTracker's. A leading year or NV is the vintage slot;
// otherwise the word equal to the vintage moves there. Other years stay put ("Cuvée 1855").
const fold = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const bare = word => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const isVintage = word => /^(?:(?:19|20)\d{2}|NV)$/i.test(bare(word));
const tidy = words => words.join(' ').replace(/\(\s*\)/g, '').replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '').replace(/\s+([,;:])/g, '$1').replace(/\s+/g, ' ');
export function vintageFirst(name, vintage) {
  const text = String(name ?? '').replace(/\s+/g, ' ').trim(), v = String(vintage ?? '').trim().toUpperCase();
  if (!text || !/^(?:(?:19|20)\d{2}|NV)$/.test(v)) return text;
  const words = text.split(' ');
  const at = isVintage(words[0]) ? 0 : words.findIndex(w => bare(w).toUpperCase() === v);
  if (at >= 0) words.splice(at, 1);
  const rest = tidy(words);
  return rest ? v + ' ' + rest : text;
}
// Moves the producer (the shop's "brand") right after the vintage, in the brand's spelling, when the
// name contains it as whole words; a hyphen and a space count as the same. Otherwise the name is kept.
export function producerFirst(name, producer, vintage, shop = '') {
  const pieces = text => fold(text).split(/[\s-]+/).map(bare).filter(Boolean);
  const want = pieces(producer), text = vintageFirst(name, vintage);
  const shopWords = pieces(String(shop).replace(/^www\./, '').replace(/\.[a-z.]+$/, '').replace(/[.]/g, ' '));
  if (!want.length || (shopWords.length && want.join('') === shopWords.join(''))) return text;
  const words = text.split(' ');
  const start = isVintage(words[0]) ? 1 : 0;
  for (let i = start; i < words.length; i++) {
    const got = [];
    for (let j = i; j < words.length && got.length < want.length; j++) {
      got.push(...pieces(words[j]));
      if (got.join(' ') === want.join(' ')) {
        const rest = tidy([...words.slice(start, i), ...words.slice(j + 1)]);
        return [...words.slice(0, start), String(producer).trim(), rest].filter(Boolean).join(' ');
      }
    }
  }
  return text;
}
// Words in a shop's name that CellarTracker's own wine names leave out (vintage, size, colour,
// classification, "Domaine"). Searching with them can come back empty, so search links drop them.
const SEARCH_DROP = new Set(['rouge', 'blanc', 'rosso', 'bianco', 'tinto', 'blanco', 'nv', 'aoc', 'aop', 'doc', 'docg', 'igt', 'igp', 'ava', 'domaine', 'chateau', 'maison', 'weingut', 'bottle', 'magnum']);
export function searchName(value) {
  const text = String(value ?? '').replace(/\b(?:1er|premier|grand) cru\b|\b(?:red|white) wine\b|\b\d+\s?x\b|\b\d+(?:[.,]\d+)?\s?(?:ml|cl|l)\b/gi, ' ');
  const words = text.split(/[\s,()\/]+/).filter(w => /[\p{L}\p{N}]/u.test(w) && !/^(?:19|20)\d{2}$/.test(w) && !SEARCH_DROP.has(w.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()));
  return words.join(' ') || String(value ?? '').trim();
}
export function cents(value, nullable = false) {
  if (nullable && (value === '' || value == null)) return null;
  if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 10000000) throw new Error('Enter a valid non-negative amount');
  return Math.round(Number(value) * 100);
}
function ctFields(input) {
  const blank = value => value === '' || value == null;
  const ctScore = blank(input.ctScore) ? null : Number(input.ctScore);
  if (ctScore != null && (!Number.isFinite(ctScore) || ctScore < 50 || ctScore > 100)) throw new Error('CT score must be between 50 and 100; leave blank if there is none');
  const ctNotes = blank(input.ctNotes) ? null : Number(input.ctNotes);
  if (ctNotes != null && (!Number.isInteger(ctNotes) || ctNotes < 0 || ctNotes > 1000000)) throw new Error('CT notes count must be a whole number; leave blank if unknown');
  const ctUrl = input.ctUrl ? webUrl(input.ctUrl) : '';
  if (ctUrl && !/(^|\.)cellartracker\.com$/.test(new URL(ctUrl).hostname)) throw new Error('The score source must be a CellarTracker link');
  return {ctScore, ctNotes, ctUrl};
}
export function normalizeWine(input) {
  const url = webUrl(input.url);
  const name = vintageFirst(titleCase(String(input.name || '').trim()), input.vintage).slice(0, 500);
  if (!name) throw new Error('Enter the wine name');
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error('Quantity must be a whole number from 1 to 999');
  const currency = String(input.currency || '').toUpperCase();
  if (!['USD', 'EUR', 'GBP', 'CAD', 'HKD', 'JPY', 'AUD'].includes(currency)) throw new Error('Choose a currency');
  const {ctScore, ctNotes, ctUrl} = ctFields(input);
  return {
    id: input.id || crypto.randomUUID(), url, merchant: merchantId(url), name,
    vintage: String(input.vintage || '').slice(0, 20), size: titleCase(String(input.size || '750 ml')).slice(0, 40),
    priceCents: cents(input.price, true), currency, quantity, ctScore, ctNotes, ctUrl,
    eligible: input.eligible !== false, availability: ['unknown', 'in', 'out'].includes(input.availability) ? input.availability : 'unknown',
    status: input.status === 'purchased' ? 'purchased' : 'watching',
    notes: String(input.notes || '').slice(0, 2000), updatedAt: new Date().toISOString()
  };
}
export function totals(state, id) {
  const m = state.merchants[id];
  const wines = state.wines.filter(w => w.merchant === id && w.status === 'watching');
  const included = wines.filter(w => w.eligible && w.availability !== 'out' && w.priceCents != null && w.currency === m.currency);
  const subtotal = included.reduce((s, w) => s + w.priceCents * w.quantity, 0);
  const bottles = included.reduce((s, w) => s + w.quantity, 0);
  // Case discount: percent off the whole counted order once it has at least caseSize items.
  const caseConfigured = m.caseSize != null && m.caseDiscount != null;
  const caseApplied = caseConfigured && bottles >= m.caseSize;
  const discount = caseApplied ? Math.round(subtotal * m.caseDiscount / 100) : 0;
  const total = subtotal - discount;
  const configured = m.thresholdCents != null;
  return {wines, included, subtotal, discount, total, bottles, configured, caseConfigured, caseApplied,
    bottlesToCase: caseConfigured ? Math.max(0, m.caseSize - bottles) : null,
    ready: configured && included.length > 0 && total >= m.thresholdCents,
    remaining: configured ? Math.max(0, m.thresholdCents - total) : null,
    excluded: wines.length - included.length};
}
export function applyOperation(state, action) {
  const next = structuredClone(state);
  if (action.type === 'saveWine') {
    const wine = normalizeWine(action.wine);
    if (action.wine.id && !next.wines.some(w => w.id === action.wine.id)) throw new Error('This wine has been deleted; reopen the list');
    const duplicate = next.wines.find(w => w.url === wine.url && w.status === 'watching' && w.id !== wine.id && w.vintage === wine.vintage && titleCase(w.size) === wine.size);
    if (duplicate && !action.wine.id) throw new Error('A wine with this link, vintage and size is already saved. Change its quantity or price in the list.');
    const index = next.wines.findIndex(w => w.id === wine.id);
    if (index < 0) next.wines.push(wine); else next.wines[index] = wine;
    next.merchants[wine.merchant] ||= {name: wine.merchant, currency: wine.currency, thresholdCents: null, caseSize: null, caseDiscount: null, notes: '', notified: false};
  } else if (action.type === 'saveMerchant') {
    if (!next.merchants[action.id]) throw new Error('Merchant not found');
    const m = action.merchant;
    if (!['USD', 'EUR', 'GBP', 'CAD', 'HKD', 'JPY', 'AUD'].includes(m.currency)) throw new Error('Invalid currency');
    const blank = value => value === '' || value == null;
    const caseSize = blank(m.caseSize) ? null : Number(m.caseSize);
    const caseDiscount = blank(m.caseDiscount) ? null : Number(m.caseDiscount);
    if (caseSize != null && (!Number.isInteger(caseSize) || caseSize < 2 || caseSize > 999)) throw new Error('Case size must be a whole number from 2 to 999');
    if (caseDiscount != null && (!Number.isFinite(caseDiscount) || caseDiscount <= 0 || caseDiscount > 100)) throw new Error('Case discount must be more than 0% and at most 100%');
    if ((caseSize == null) !== (caseDiscount == null)) throw new Error('Enter both the case size and the case discount, or leave both blank');
    Object.assign(next.merchants[action.id], {name: String(m.name || action.id).slice(0, 200), currency: m.currency, thresholdCents: cents(m.threshold, true), caseSize, caseDiscount, notes: String(m.notes || '').slice(0, 1000)});
  } else if (action.type === 'status') {
    const wine = next.wines.find(w => w.id === action.id);
    if (!wine) throw new Error('Wine not found');
    wine.status = action.status === 'purchased' ? 'purchased' : 'watching';
  } else if (action.type === 'setScore') {
    // Only the CT fields change; the rest of the saved wine is kept as stored.
    const wine = next.wines.find(w => w.id === action.id);
    if (!wine) throw new Error('This wine has been deleted; reopen the list');
    const fields = ctFields(action);
    if (fields.ctScore == null) throw new Error('Enter the CT community score');
    // Optionally takes CellarTracker's name for the wine, with the saved wine's vintage in front.
    if (action.name != null) {
      fields.name = vintageFirst(titleCase(String(action.name).trim()), wine.vintage).slice(0, 500);
      if (!fields.name) throw new Error('Enter the wine name');
    }
    Object.assign(wine, fields, {updatedAt: new Date().toISOString()});
  } else if (action.type === 'deleteWine') next.wines = next.wines.filter(w => w.id !== action.id);
  else throw new Error('Unknown action');
  return next;
}
// Orders the wines on the wish list by how well they match a CellarTracker page: same vintage first, then shared name words.
const words = text => new Set(String(text || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1 && !/^(?:19|20)\d{2}$/.test(w)));
export const sameVintage = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();
export function rankForScore(wines, page) {
  const target = words(page.name);
  const match = w => {
    const own = words(w.name);
    return (page.vintage && sameVintage(w.vintage, page.vintage) ? 1 : 0) + [...target].filter(t => own.has(t)).length / Math.max(1, target.size);
  };
  return wines.filter(w => w.status === 'watching').map(w => [match(w), w]).sort((a, b) => b[0] - a[0] || b[1].updatedAt.localeCompare(a[1].updatedAt)).map(([, w]) => w);
}
export function notificationTransitions(state) {
  const events = [];
  for (const [id, m] of Object.entries(state.merchants)) {
    const t = totals(state, id);
    if (t.ready && !m.notified) events.push({id, name: m.name, currency: m.currency, subtotal: t.subtotal, total: t.total, caseDiscount: t.caseApplied ? m.caseDiscount : null, bottles: t.bottles});
    m.notified = t.ready;
  }
  return events;
}
export const money = (amount, currency = 'USD') => amount == null ? 'TBD' : new Intl.NumberFormat('en-US', {style: 'currency', currency}).format(amount / 100);
// chrome.storage.sync allows 8 KB per item, so each wine and merchant is its own key.
export const SYNC_ITEM_BYTES = 8192;
export function pack(state) {
  const items = {};
  for (const [id, m] of Object.entries(state.merchants)) items['m:' + id] = m;
  for (const w of state.wines) items['w:' + w.id] = w;
  return items;
}
export function unpack(items = {}) {
  const state = emptyState();
  for (const [key, value] of Object.entries(items)) {
    if (key.startsWith('m:')) state.merchants[key.slice(2)] = value;
    else if (key.startsWith('w:')) state.wines.push(value);
  }
  // A wine can sync to this computer before its merchant does.
  for (const w of state.wines) state.merchants[w.merchant] ||= {name: w.merchant, currency: w.currency, thresholdCents: null, caseSize: null, caseDiscount: null, notes: '', notified: false};
  state.wines.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return state;
}
export function diff(prev, next) {
  const set = {}, remove = Object.keys(prev).filter(key => !(key in next));
  for (const [key, value] of Object.entries(next)) if (JSON.stringify(prev[key]) !== JSON.stringify(value)) set[key] = value;
  return {set, remove};
}
export const itemBytes = (key, value) => new TextEncoder().encode(key + JSON.stringify(value)).length;
// Adds the wines in `from` that `into` does not have yet. Merchants already in `into` keep their settings.
export function mergeState(into, from) {
  const next = structuredClone(into);
  for (const w of from.wines) {
    if (next.wines.some(e => e.id === w.id || (e.url === w.url && e.vintage === w.vintage && e.size === w.size && e.status === w.status))) continue;
    next.wines.push(w);
    if (from.merchants[w.merchant] && !next.merchants[w.merchant]) next.merchants[w.merchant] = from.merchants[w.merchant];
  }
  return next;
}
