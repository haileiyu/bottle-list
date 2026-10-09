export const emptyState = () => ({version: 1, wines: [], merchants: {}});
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'HKD', 'JPY', 'AUD'];
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
export function cents(value, nullable = false) {
  if (nullable && (value === '' || value == null)) return null;
  if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 10000000) throw new Error('Enter a valid non-negative amount');
  return Math.round(Number(value) * 100);
}
export function normalizeWine(input) {
  const url = webUrl(input.url);
  const name = titleCase(String(input.name || '').trim()).slice(0, 500);
  if (!name) throw new Error('Enter the wine name');
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error('Quantity must be a whole number from 1 to 999');
  const currency = String(input.currency || '').toUpperCase();
  if (!CURRENCIES.includes(currency)) throw new Error('Choose a currency');
  const score = input.ctScore === '' || input.ctScore == null ? null : Number(input.ctScore);
  if (score != null && (!Number.isFinite(score) || score < 50 || score > 100)) throw new Error('CT score must be between 50 and 100; leave blank if there is none');
  const ctUrl = input.ctUrl ? webUrl(input.ctUrl) : '';
  if (ctUrl && !/(^|\.)cellartracker\.com$/.test(new URL(ctUrl).hostname)) throw new Error('The score source must be a CellarTracker link');
  return {
    id: input.id || crypto.randomUUID(), url, merchant: merchantId(url), name,
    vintage: String(input.vintage || '').slice(0, 20), size: titleCase(String(input.size || '750 ml')).slice(0, 40),
    priceCents: cents(input.price, true), currency, quantity, ctScore: score, ctUrl,
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
    if (!CURRENCIES.includes(m.currency)) throw new Error('Invalid currency');
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
  } else if (action.type === 'deleteWine') next.wines = next.wines.filter(w => w.id !== action.id);
  else if (action.type === 'import') {
    const backup = action.state;
    if (!Array.isArray(backup?.wines) || typeof backup.merchants !== 'object' || backup.merchants === null) throw new Error('This file is not a Bottle List backup');
    for (const w of backup.wines) {
      if (next.wines.some(existing => existing.id === w.id)) continue;
      let wine;
      try {wine = normalizeWine({...w, price: w.priceCents == null ? '' : w.priceCents / 100});} catch {continue;}
      if (!Number.isNaN(Date.parse(w.updatedAt))) wine.updatedAt = new Date(w.updatedAt).toISOString();
      if (next.wines.some(e => e.url === wine.url && e.vintage === wine.vintage && e.size === wine.size && e.status === wine.status)) continue;
      next.wines.push(wine);
      const m = backup.merchants[wine.merchant] || {};
      const validCase = Number.isInteger(m.caseSize) && m.caseSize >= 2 && m.caseSize <= 999 && Number.isFinite(m.caseDiscount) && m.caseDiscount > 0 && m.caseDiscount <= 100;
      next.merchants[wine.merchant] ||= {name: String(m.name || wine.merchant).slice(0, 200),
        currency: CURRENCIES.includes(m.currency) ? m.currency : wine.currency,
        thresholdCents: Number.isInteger(m.thresholdCents) && m.thresholdCents >= 0 ? m.thresholdCents : null,
        caseSize: validCase ? m.caseSize : null, caseDiscount: validCase ? m.caseDiscount : null,
        notes: String(m.notes || '').slice(0, 1000), notified: m.notified === true};
    }
  } else throw new Error('Unknown action');
  return next;
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
  const items = {meta: {version: state.version}};
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
  // A wine can sync to this device before its merchant does.
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
