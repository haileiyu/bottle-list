export const emptyState = () => ({version: 1, wines: [], merchants: {}});
export function webUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('请输入 http 或 https 商品链接');
  url.hash = '';
  for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(k)) url.searchParams.delete(k);
  return url.href;
}
export const merchantId = url => new URL(webUrl(url)).hostname.toLowerCase().replace(/^www\./, '');
export function cents(value, nullable = false) {
  if (nullable && (value === '' || value == null)) return null;
  if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 10000000) throw new Error('请输入有效的非负金额');
  return Math.round(Number(value) * 100);
}
export function normalizeWine(input) {
  const url = webUrl(input.url);
  const name = String(input.name || '').trim().slice(0, 500);
  if (!name) throw new Error('请填写酒名');
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error('数量应为 1–999 的整数');
  const currency = String(input.currency || '').toUpperCase();
  if (!['USD', 'EUR', 'GBP', 'CAD', 'HKD', 'JPY', 'AUD'].includes(currency)) throw new Error('请选择币种');
  const score = input.ctScore === '' || input.ctScore == null ? null : Number(input.ctScore);
  if (score != null && (!Number.isFinite(score) || score < 50 || score > 100)) throw new Error('CT 分数应在 50–100 之间；没有评分可留空');
  const ctUrl = input.ctUrl ? webUrl(input.ctUrl) : '';
  if (ctUrl && !/(^|\.)cellartracker\.com$/.test(new URL(ctUrl).hostname)) throw new Error('评分来源请填写 CellarTracker 链接');
  return {
    id: input.id || crypto.randomUUID(), url, merchant: merchantId(url), name,
    vintage: String(input.vintage || '').slice(0, 20), size: String(input.size || '750 ml').slice(0, 40),
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
  const configured = m.thresholdCents != null;
  return {wines, included, subtotal, bottles: included.reduce((s, w) => s + w.quantity, 0), configured,
    ready: configured && included.length > 0 && subtotal >= m.thresholdCents,
    remaining: configured ? Math.max(0, m.thresholdCents - subtotal) : null,
    excluded: wines.length - included.length};
}
export function applyOperation(state, action) {
  const next = structuredClone(state);
  if (action.type === 'saveWine') {
    const wine = normalizeWine(action.wine);
    if (action.wine.id && !next.wines.some(w => w.id === action.wine.id)) throw new Error('这款酒已被删除，请重新打开清单');
    const duplicate = next.wines.find(w => w.url === wine.url && w.status === 'watching' && w.id !== wine.id && w.vintage === wine.vintage && w.size === wine.size);
    if (duplicate && !action.wine.id) throw new Error('已收藏这个链接的同年份、同规格酒款。请在清单中修改数量或价格。');
    const index = next.wines.findIndex(w => w.id === wine.id);
    if (index < 0) next.wines.push(wine); else next.wines[index] = wine;
    next.merchants[wine.merchant] ||= {name: wine.merchant, currency: wine.currency, thresholdCents: null, notes: '', notified: false};
  } else if (action.type === 'saveMerchant') {
    if (!next.merchants[action.id]) throw new Error('找不到酒商');
    const m = action.merchant;
    if (!['USD', 'EUR', 'GBP', 'CAD', 'HKD', 'JPY', 'AUD'].includes(m.currency)) throw new Error('币种无效');
    Object.assign(next.merchants[action.id], {name: String(m.name || action.id).slice(0, 200), currency: m.currency, thresholdCents: cents(m.threshold, true), notes: String(m.notes || '').slice(0, 1000)});
  } else if (action.type === 'status') {
    const wine = next.wines.find(w => w.id === action.id);
    if (!wine) throw new Error('找不到酒款');
    wine.status = action.status === 'purchased' ? 'purchased' : 'watching';
  } else if (action.type === 'deleteWine') next.wines = next.wines.filter(w => w.id !== action.id);
  else throw new Error('未知操作');
  return next;
}
export function notificationTransitions(state) {
  const events = [];
  for (const [id, m] of Object.entries(state.merchants)) {
    const t = totals(state, id);
    if (t.ready && !m.notified) events.push({id, name: m.name, currency: m.currency, subtotal: t.subtotal, bottles: t.bottles});
    m.notified = t.ready;
  }
  return events;
}
export const money = (amount, currency = 'USD') => amount == null ? '待确认' : new Intl.NumberFormat('en-US', {style: 'currency', currency}).format(amount / 100);
