import {$, state, mutate, wineFields, formData} from './shared.js';
import {webUrl} from './core.mjs';
$('#open').onclick = () => chrome.tabs.create({url: chrome.runtime.getURL('dashboard.html')});
let draft = {};
try {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id || !/^https?:/.test(tab.url || '')) throw new Error('请先打开酒商的商品详情页；也可以在这里手动填写。');
  if (/(^|\.)cellartracker\.com$/.test(new URL(tab.url).hostname)) throw new Error('这是 CellarTracker 页面。请在「我的清单」中编辑对应酒款，填入本页社区评分和链接。');
  const [result] = await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['extract.js']});
  draft = result.result || {};
  $('#capture-status').textContent = draft.warning + (!draft.currency ? ' 未识别币种，暂选 USD，请确认。' : '') + (draft.shippingHints?.length ? ' 页面运费提示：' + draft.shippingHints.join(' / ') : '');
} catch (error) {$('#capture-status').textContent = error.message;}
const current = await state();
const matches = current.wines.filter(w => draft.url && w.url === webUrl(draft.url) && w.status === 'watching');
const duplicate = matches.length === 1 ? matches[0] : null;
if (duplicate) {
  draft = {...duplicate, ...draft, size: draft.size || duplicate.size, vintage: draft.vintage || duplicate.vintage, currency: draft.currency || duplicate.currency, priceCents: draft.price ? Number(draft.price)*100 : duplicate.priceCents};
  $('#message').textContent = '已收藏这个链接。请确认是同一年份与规格，保存会更新原记录，并保留数量和 CT 评分。';
  $('#save').textContent = '更新已收藏酒款';
}
wineFields($('#wine-form'), draft);
$('#wine-form').onsubmit = async event => {
  event.preventDefault(); $('#save').disabled = true;
  try {
    const result = await mutate({type: 'saveWine', wine: {...(duplicate || {}), ...formData(event.target)}});
    $('#message').className = 'success';
    $('#message').textContent = (duplicate ? '收藏已更新。' : '已加入。到「我的清单」设置这家酒商的免运费门槛。') + (result.notificationFailed ? '系统通知未发出，请查看清单提示。' : '');
    $('#save').textContent = '已收藏 ✓';
  } catch(error) {$('#message').className = 'error'; $('#message').textContent = error.message; $('#save').disabled = false;}
};
