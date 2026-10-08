import {emptyState} from './core.mjs';
export const $ = selector => document.querySelector(selector);
export const state = async () => (await chrome.storage.local.get('state')).state || emptyState();
export async function mutate(action) {
  const result = await chrome.runtime.sendMessage({channel: 'wine-queue', action});
  if (!result?.ok) throw new Error(result?.error || '保存失败，请重新打开插件');
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
export function formData(form) {
  const data = Object.fromEntries(new FormData(form));
  data.eligible = form.elements.eligible.checked;
  return data;
}
export function wineFields(form, wine = {}) {
  const fields = [
    ['name', '酒名', 'text', true], ['url', '商品链接', 'url', true],
    ['vintage', '年份 / NV', 'text'], ['size', '规格（单瓶或整箱）', 'text'],
    ['price', '单件价格', 'number'], ['quantity', '数量（按上述规格）', 'number', true],
    ['currency', '币种', ['USD','EUR','GBP','CAD','HKD','JPY','AUD']],
    ['availability', '库存', [['unknown','待核实'],['in','有货'],['out','缺货']]],
    ['ctScore', 'CellarTracker 社区分', 'number'], ['ctUrl', 'CellarTracker 来源链接', 'url'],
    ['notes', '备注 · 目标价 / 优惠码', 'text']
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
    if (type === 'number') {input.min = name === 'quantity' ? '1' : name === 'ctScore' ? '50' : '0'; input.step = name === 'quantity' ? '1' : '0.01'; input.max = name === 'quantity' ? '999' : name === 'ctScore' ? '100' : '10000000';}
    if (name === 'quantity') input.value = wine.quantity || 1;
    else if (name === 'price') input.value = wine.priceCents != null ? wine.priceCents / 100 : (wine.price ?? '');
    else if (name === 'currency') input.value = wine.currency || 'USD';
    else if (name === 'availability') input.value = wine.availability || 'unknown';
    else input.value = wine[name] ?? '';
    if (name === 'size') input.placeholder = '例如 750 ml / 6 × 750 ml';
    if (name === 'ctScore') input.placeholder = '手动填入，未知留空';
    label.append(input); grid.append(label);
  }
  form.append(grid);
  const check = element('label', null, 'checkbox'); const input = element('input'); input.type = 'checkbox'; input.name = 'eligible'; input.checked = wine.eligible !== false;
  check.append(input, document.createTextNode('这款酒计入免运费金额')); form.append(check);
  const hint = element('p', 'CT 分数请核对酒名与年份后填写。未知价格、缺货或币种不符的酒不计入门槛。', 'muted tiny'); form.append(hint);
  form.append(link('查找这款酒的 CellarTracker →', ctSearch(wine.name || ''), 'ct-search'));
  form.elements.name.addEventListener('input', () => {form.querySelector('.ct-search').href = ctSearch(form.elements.name.value);});
}
export function download(filename, data, type) {
  const url = URL.createObjectURL(new Blob([data], {type}));
  const a = element('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
