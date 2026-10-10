import {titleCase} from './core.mjs';
import {loadState} from './storage.mjs';
export const $ = selector => document.querySelector(selector);
export async function state() {
  const current = await loadState();
  // Wines saved before names were tidied show in Title Case too; they are stored that way on their next save.
  for (const wine of current.wines) {wine.name = titleCase(wine.name); wine.size = titleCase(wine.size);}
  return current;
}
export async function mutate(action) {
  const result = await chrome.runtime.sendMessage({channel: 'bottle-list', action});
  if (!result?.ok) throw new Error(result?.error || 'Save failed; reopen the extension');
  return result;
}
export function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
}
export function link(text, url, className) {
  const a = element('a', text, className); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
}
export function ctSearch(name) {return 'https://www.cellartracker.com/list.asp?Table=List&iUserOverride=0&szSearch=' + encodeURIComponent(name);}
export function wsSearch(name, vintage = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean).map(encodeURIComponent).join('+');
  if (!words) return 'https://www.wine-searcher.com/';
  return 'https://www.wine-searcher.com/find/' + words + (/^\d{4}$/.test(String(vintage).trim()) ? '/' + String(vintage).trim() : '');
}
export function formData(form) {
  const data = Object.fromEntries(new FormData(form));
  data.eligible = form.elements.eligible.checked;
  return data;
}
export function wineFields(form, wine = {}) {
  const fields = [
    ['name', 'Wine name', 'text', true], ['url', 'Product link', 'url', true],
    ['vintage', 'Vintage / NV', 'text'], ['size', 'Size (bottle or case)', 'text'],
    ['price', 'Unit price', 'number'], ['quantity', 'Quantity (in the size above)', 'number', true],
    ['currency', 'Currency', ['USD','EUR','GBP','CAD','HKD','JPY','AUD']],
    ['availability', 'Stock', [['unknown','Unverified'],['in','In stock'],['out','Out of stock']]],
    ['ctScore', 'CellarTracker community score', 'number'], ['ctNotes', 'Number of CT notes', 'number'], ['ctUrl', 'CellarTracker source link', 'url'],
    ['notes', 'Notes · Target price / promo code', 'text']
  ];
  const grid = element('div', null, 'form-grid');
  for (const [name, title, type, required] of fields) {
    const label = element('label', title, ['name','url','ctUrl','notes'].includes(name) ? 'wide' : '');
    const input = element(Array.isArray(type) ? 'select' : 'input');
    input.name = name; input.required = Boolean(required);
    if (Array.isArray(type)) for (const option of type) {
      const [value, text] = Array.isArray(option) ? option : [option, option];
      const el = element('option', text); el.value = value; input.append(el);
    } else input.type = type;
    if (type === 'number') {input.min = name === 'quantity' ? '1' : name === 'ctScore' ? '50' : '0'; input.step = ['quantity', 'ctNotes'].includes(name) ? '1' : '0.01'; input.max = name === 'quantity' ? '999' : name === 'ctScore' ? '100' : name === 'ctNotes' ? '1000000' : '10000000';}
    if (name === 'quantity') input.value = wine.quantity || 1;
    else if (name === 'price') input.value = wine.priceCents != null ? wine.priceCents / 100 : (wine.price ?? '');
    else if (name === 'currency') input.value = wine.currency || 'USD';
    else if (name === 'availability') input.value = wine.availability || 'unknown';
    else input.value = wine[name] ?? '';
    if (name === 'size') input.placeholder = 'e.g. 750 ml / 6 × 750 ml';
    if (name === 'ctScore') input.placeholder = 'Enter manually; leave blank if unknown';
    label.append(input); grid.append(label);
  }
  form.append(grid);
  const check = element('label', null, 'checkbox'); const input = element('input'); input.type = 'checkbox'; input.name = 'eligible'; input.checked = wine.eligible !== false;
  check.append(input, document.createTextNode('Count this wine toward free shipping')); form.append(check);
  const hint = element('p', 'Check the wine name and vintage before entering a CT score, or save first, then click Bottle List on the wine\'s CellarTracker page to fill it in. Wines with unknown price, no stock or a mismatched currency do not count toward the threshold.', 'muted tiny'); form.append(hint);
  const lookups = element('div', null, 'lookups');
  lookups.append(link('Find this wine on CellarTracker →', ctSearch(wine.name || ''), 'ct-search'), link('Find prices on Wine-Searcher →', wsSearch(wine.name || '', wine.vintage || ''), 'ws-search'));
  form.append(lookups);
  const refresh = () => {form.querySelector('.ct-search').href = ctSearch(form.elements.name.value); form.querySelector('.ws-search').href = wsSearch(form.elements.name.value, form.elements.vintage.value);};
  form.elements.name.addEventListener('input', refresh); form.elements.vintage.addEventListener('input', refresh);
}
export function download(filename, data, type) {
  const url = URL.createObjectURL(new Blob([data], {type}));
  const a = element('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
