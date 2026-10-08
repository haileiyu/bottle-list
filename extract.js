// Runs only on the current page when the user clicks the extension.
(() => {
  const meta = key => document.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.content?.trim() || '';
  const products = [];
  function walk(value) {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object') return;
    if ([].concat(value['@type'] || []).some(t => /(^|\/)Product$/.test(t))) products.push(value);
    if (value['@graph']) walk(value['@graph']);
    if (value.mainEntity) walk(value.mainEntity);
  }
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { walk(JSON.parse(el.textContent)); } catch { /* Broken site metadata stays untrusted. */ }
  }
  const current = new URL(location.href);
  const samePage = value => { try { const u = new URL(value, location.href); return u.origin === current.origin && u.pathname === current.pathname; } catch {return false;} };
  const product = products.find(p => samePage(p.url || p['@id'])) || (products.length === 1 ? products[0] : null);
  const rawOffers = product ? [].concat(product.offers || []) : [];
  const offers = rawOffers.flatMap(o => o.offers ? [].concat(o.offers) : [o]);
  const variant = current.searchParams.get('variant');
  const selectedOffer = offers.find(o => {try {return variant && new URL(o.url, location.href).searchParams.get('variant') === variant;}catch{return false;}});
  const offer = selectedOffer || (offers.length === 1 ? offers[0] : {});
  const ambiguous = offers.length > 1 && !selectedOffer;
  const name = String(product?.name || meta('og:title') || document.querySelector('h1')?.textContent?.trim() || document.title).replace(/\s+/g, ' ').slice(0, 500);
  let rawPrice = ambiguous ? '' : (offer.price ?? (meta('product:price:amount') || ''));
  // Do not use aggregate lowPrice or a page-wide dollar regex: those can be a different wine or variant.
  const normalized = String(rawPrice).trim().replace(/^(?:US\$|\$|USD\s*)/, '').replace(/,/g, '');
  const price = /^\d+(\.\d{1,2})?$/.test(normalized) ? normalized : '';
  const currency = String(offer.priceCurrency || meta('product:price:currency') || '').toUpperCase();
  const availability = /OutOfStock|SoldOut|Discontinued/i.test(offer.availability || '') ? 'out' : /InStock|LimitedAvailability/i.test(offer.availability || '') ? 'in' : 'unknown';
  const body = document.body?.innerText || '';
  const shippingHints = [...body.matchAll(/[^\n.]{0,65}(?:free shipping|free delivery|免运费)[^\n.]{0,100}/gi)].slice(0, 3).map(m => m[0].trim());
  return {name, url: location.href, price, currency, availability, vintage: name.match(/\b(?:19|20)\d{2}\b/)?.[0] || '', size: name.match(/\b(?:\d{2,4}\s?ml|\d(?:\.\d+)?\s?[lL])\b/)?.[0] || '',
    shippingHints, warning: ambiguous ? '页面有多个规格价格，请手动确认当前规格的价格。' : price ? '价格来自网页标记，请核对年份、规格和折扣。' : '未找到可靠价格，请手动填写。'};
})();
