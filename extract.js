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
  // Some shop themes build their JSON-LD from page variables, which is not valid JSON. Drop the variables and keep the rest.
  function parseLoose(text) {
    try { return JSON.parse(text); } catch { /* Try the repair below. */ }
    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start < 0) return null;
    try { return JSON.parse(text.slice(start, end + 1).replace(/:\s*(?!true\b|false\b|null\b)[A-Za-z_$][\w$.]*\s*(?=[,}\]])/g, ':null').replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
  }
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) walk(parseLoose(el.textContent));
  const current = new URL(location.href);
  const samePage = value => { try { const u = new URL(value, location.href); return u.origin === current.origin && u.pathname === current.pathname; } catch {return false;} };
  const product = products.find(p => samePage(p.url || p['@id'])) || (products.length === 1 ? products[0] : null);
  const rawOffers = product ? [].concat(product.offers || []) : [];
  const offers = rawOffers.flatMap(o => o.offers ? [].concat(o.offers) : [o]);
  // Shopify pages list every size with its price in cents. The cart form holds the size the shopper picked; forms for other products are skipped by id.
  let variants = [];
  for (const el of document.querySelectorAll('script:not([src])')) {
    const m = el.textContent.match(/var meta = (\{.*\});/);
    if (!m) continue;
    try { variants = [].concat(JSON.parse(m[1]).product?.variants || []); } catch { /* Not Shopify's product data. */ }
    break;
  }
  const variantIds = new Set(variants.map(v => String(v.id)));
  const variant = [...document.querySelectorAll('form[action*="/cart/add"] [name="id"]')].filter(el => el.type !== 'radio' || el.checked).map(el => String(el.value)).find(id => variantIds.has(id)) || current.searchParams.get('variant');
  const sizes = variants.length > 1;
  const shopifyVariant = sizes ? variants.find(v => String(v.id) === variant) : null;
  const selectedOffer = offers.find(o => {try {return variant && new URL(o.url, location.href).searchParams.get('variant') === variant;}catch{return false;}});
  // With several sizes, a lone JSON-LD offer may be for a size the shopper did not pick.
  const offer = selectedOffer || (offers.length === 1 && !sizes ? offers[0] : {});
  const ambiguous = sizes ? !shopifyVariant : offers.length > 1 && !selectedOffer;
  // Pages without JSON-LD often mark up their one offer with schema.org microdata.
  const microOffers = document.querySelectorAll('[itemprop="offers"]');
  const micro = microOffers.length === 1 && !sizes ? microOffers[0] : null;
  const microValue = prop => { const el = micro?.querySelector(`[itemprop="${prop}"]`); return String(el?.getAttribute('content') || el?.getAttribute('href') || el?.textContent || '').trim(); };
  const name = String(product?.name || meta('og:title') || document.querySelector('h1')?.textContent?.trim() || document.title).replace(/\s+/g, ' ').slice(0, 500);
  // Shopify and many shop platforms tag the price as og:price:* instead of product:price:*.
  let rawPrice = ambiguous ? '' : shopifyVariant ? (shopifyVariant.price / 100).toFixed(2) : (offer.price ?? (meta('product:price:amount') || meta('og:price:amount') || microValue('price') || ''));
  // Do not use aggregate lowPrice or a page-wide dollar regex: those can be a different wine or variant.
  const normalized = String(rawPrice).trim().replace(/^(?:US\$|\$|USD\s*)/, '').replace(/,/g, '');
  const price = /^\d+(\.\d{1,2})?$/.test(normalized) ? normalized : '';
  const currency = String(offer.priceCurrency || meta('product:price:currency') || meta('og:price:currency') || microValue('priceCurrency') || '').toUpperCase();
  const stock = offer.availability || microValue('availability');
  const availability = /OutOfStock|SoldOut|Discontinued/i.test(stock) ? 'out' : /InStock|LimitedAvailability/i.test(stock) ? 'in' : 'unknown';
  const sizeWord = /\b(?:\d{2,4}\s?ml|\d(?:\.\d+)?\s?[lL])\b/;
  // The producer, when the shop tags one. Some shops put their own name or an importer here, so the popup checks it against the name.
  const brand = [].concat(product?.brand || product?.manufacturer || [])[0];
  const producer = String((typeof brand === 'string' ? brand : brand?.name) || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const body = document.body?.innerText || '';
  const shippingHints = [...body.matchAll(/[^\n.]{0,65}(?:free shipping|free delivery|免运费)[^\n.]{0,100}/gi)].slice(0, 3).map(m => m[0].trim());
  return {name, url: location.href, producer, price, currency, availability, vintage: name.match(/\b(?:19|20)\d{2}\b/)?.[0] || '', size: (name.match(sizeWord) || String(shopifyVariant?.public_title || '').match(sizeWord))?.[0] || '',
    shippingHints, warning: ambiguous ? 'The page lists prices for several sizes; confirm the price for the selected size manually.' : price ? 'Price read from page metadata; check the vintage, size and discounts.' : 'No reliable price found; enter it manually.'};
})();
